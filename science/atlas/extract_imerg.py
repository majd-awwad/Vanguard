"""Extract a few verified IMERG cells with bounded HTTP ranges (h5py required)."""
import csv
from datetime import date, timedelta
from functools import lru_cache
from io import RawIOBase
from pathlib import Path
from urllib.request import Request, urlopen

import h5py

HERE = Path(__file__).resolve().parent
ROOT = "https://data.gdex.ucar.edu/d734000/gpm_3imergdf_v07"
DAYS = [date(2024, 9, 24) + timedelta(days=index) for index in range(5)]


def source_url(day):
    return f"{ROOT}/{day:%Y/%m}/3B-DAY.MS.MRG.3IMERG.{day:%Y%m%d}-S000000-E235959.V07B.nc4"


class RangeFile(RawIOBase):
    block_size = 65536

    def __init__(self, url):
        self.url = url
        self.position = 0
        self.transferred = 0
        with urlopen(Request(url, method="HEAD"), timeout=12) as response:
            self.size = int(response.headers["Content-Length"])

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = (0, self.position, self.size)[whence] + offset
        return self.position

    @lru_cache(maxsize=128)
    def block(self, start):
        end = min(self.size - 1, start + self.block_size - 1)
        if self.transferred + end - start + 1 > 5_000_000:
            raise RuntimeError("IMERG extraction exceeded its per-file range budget")
        # Include the requested block in the URL for intermediaries with range-insensitive caches.
        request = Request(f"{self.url}?block={start}", headers={"Range": f"bytes={start}-{end}"})
        with urlopen(request, timeout=12) as response:
            content_range = response.headers.get("Content-Range", "")
            if response.status != 206 or not content_range.lower().startswith(f"bytes {start}-{end}/"):
                raise RuntimeError(f"The mirror did not honor {start}-{end}: HTTP {response.status}, {content_range!r}")
            data = response.read(end - start + 2)
        if len(data) != end - start + 1:
            raise RuntimeError("Incomplete IMERG byte range")
        self.transferred += len(data)
        return data

    def read(self, size=-1):
        end = min(self.size, self.position + size) if size >= 0 else self.size
        chunks = []
        while self.position < end:
            start = self.position // self.block_size * self.block_size
            chunk = self.block(start)
            stop = min(end, start + len(chunk))
            chunks.append(chunk[self.position - start:stop - start])
            self.position = stop
        return b"".join(chunks)

    def readinto(self, buffer):
        data = self.read(len(buffer))
        buffer[:len(data)] = data
        return len(data)


def extract(day):
    url = source_url(day)
    remote = RangeFile(url)
    with h5py.File(remote, "r") as source:
        rain, count = source["precipitation"], source["precipitation_cnt"]
        assert rain.attrs["units"] in ("mm/day", b"mm/day")
        time = source["time"]
        units = time.attrs["units"]
        if hasattr(units, "item"):
            units = units.item()
        if isinstance(units, bytes):
            units = units.decode()
        unit, origin = units.split(" since ")
        assert unit == "days" and date.fromisoformat(origin[:10]) + timedelta(days=float(time[0])) == day
        lats, lons = source["lat"][:], source["lon"][:]
        y = [i for i, lat in enumerate(lats) if 23 <= lat <= 39 and round((float(lat) - 23.05) * 10) % 20 == 0]
        x = [i for i, lon in enumerate(lons) if -91 <= lon <= -75 and round((float(lon) + 90.95) * 10) % 20 == 0]
        assert len(y) == len(x) == 8
        values, counts = rain[0, x[0]:x[-1]+1:20, y[0]:y[-1]+1:20], count[0, x[0]:x[-1]+1:20, y[0]:y[-1]+1:20]
        for i, lon in enumerate(lons[x]):
            for j, lat in enumerate(lats[y]):
                amount, valid = float(values[i, j]), int(counts[i, j])
                yield (day, round(float(lat), 2), round(float(lon), 2), round(amount, 5) if amount >= 0 else "", valid, url)
    print(day, remote.transferred, "bytes", flush=True)
    remote.block.cache_clear()


if __name__ == "__main__":
    rows = [row for day in DAYS for row in extract(day)]
    with (HERE / "imerg.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(("date", "lat", "lon", "rate_mm_day", "valid_half_hours", "granule_url"))
        writer.writerows(rows)
