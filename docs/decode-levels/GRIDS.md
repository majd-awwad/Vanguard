# Decode levels: grids, data and thresholds

The Decode game has exactly five levels. Every level uses the real GEOS-FP model data of the verified package
(`web/assets/earthpulse-json/`: Dust `DUEXTTAU`, Rainfall `PRECTOT` in mm/h, Wind `U10M`/`V10M`). Nothing is invented and nothing is measured:
it is model output, shown on the same coverage as the rest of EarthPulse (W -20, E 50, S 15, N 45).

## Grid aggregation (`web/experiences/levels/aggregate.js`)

The package grid is 25 rows x 40 columns (1.2 x 1.75 degrees). A level grid is a coarser re-binning of it over the same coverage.

- **Level cell = area-weighted mean of the package cells it overlaps.** A package cell that is only partly inside the level cell counts by the
  overlapping part. The weight of an overlap is its spherical area: `(sin(lat_north) - sin(lat_south)) x (lon_east - lon_west in radians)`.
- **Missing values:** if any overlapped package cell is missing (null or not finite), the level cell is missing (null). It is never turned into
  zero or into "no change". (The package has no missing cell in this release; the rule is tested on synthetic data.)
- **Wind:** U and V are averaged first, then speed = hypot(U, V) and the meteorological direction (the direction the wind comes FROM, 0 = north,
  90 = east) are derived. Directions and speeds are never averaged. Speed under 0.3 m/s is calm and has no direction.
- **Rain:** values below 0.1 mm/h count as "no measurable rain" (silence), as everywhere in EarthPulse.
- **Test:** `tests/decode-levels.test.mjs` recomputes every cell of every grid on real dust and rain with an independent method (a 160 x 160
  lattice of sample points per level cell, weighted by cos(latitude), each point read from the package cell that contains it) and requires
  agreement within 0.4% of the field's range. It also checks the overlap weights add up to the level cell's spherical area, exactness on aligned
  cells, constant fields, and the missing-value rule.

| Level | Grid | Cells | Difficulty |
|---|---|---|---|
| 1 | 3 x 4 | 12 | Beginner |
| 2 | 4 x 4 | 16 | Easy |
| 3 | 5 x 6 | 30 | Medium |
| 4 | 6 x 6 | 36 | Hard |
| 5 | 6 x 8 | 48 | Expert |

## Thresholds: the levels of the sound

The recordings have three levels (low / mid / high), chosen from the documented breakpoints (`docs/earth-map/SONIFICATION_MAPPING.md`).
**Every answer must be decidable by ear**, so thresholds are sound levels, not free numbers:

| Phenomenon | none | low | mid | high |
|---|---|---|---|---|
| Dust (unitless) | | up to 0.0382 | up to 0.1247 | above 0.1247 |
| Rain (mm/h) | below 0.1 (silence, no measurable rain) | up to 0.1637 | up to 0.3115 | above 0.3115 |
| Wind speed (m/s) | | up to 2.477 | up to 4.068 | above 4.068 |

> **Deviation from the brief, on purpose:** the addendum asked for the dust threshold 0.20 "like today". With three recordings a listener cannot tell
> 0.15 from 0.25 (both are "high"), so a mission "mark every cell above 0.20" would be impossible to solve by sound. The Decode levels use the
> dust "high" level (above 0.1247) instead. The original single-case Decode challenge (page `index.html`) is untouched and keeps 0.20.

## Level data

| Level | Name | Data | Date(s) | Build group | Objectives |
|---|---|---|---|---|---|
| 1 | Dust Discovery | Dust | 2025-03-15 | A\* is not used; group B | 3 |
| 2 | Rainfall Explorer | Rain (wet date) | 2025-11-15 | group B | 4 |
| 3 | Wind Investigator | Wind speed and direction | 2025-06-15 | group B | 5 |
| 4 | Earth Pattern Detective | Dust + rain + wind, same date | 2025-05-15 | group B | 6 (3 stages) |
| 5 | Earth Master | Dust + rain + wind, change between two dates | 2025-04-15 -> 2025-05-15 | group B (both dates) | 9 (3 stages) |

Group B is `GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp` (the package's `compatibilityGroups`). Each level builds only if all the dates it
uses belong to ONE group (`buildLevelData` throws otherwise), so level 4 never combines phenomena of different builds and level 5 compares two
dates of the same build. **No level uses the dust dates 2025-08-15 or 2025-08-19** (the original challenge date and its neighbour stay locked
until Decode is finished).

Pairs and answers are deterministic: the same level always asks the same questions.

## Missions (real checks)

`mark-set` = mark every cell that satisfies a rule (scored by F1, pass at 0.8); `find-max` = pick a cell in the highest level of the (optionally
restricted) cells; `pick-higher` = of two cells that differ in sound level, which is higher; `direction` = read the wind arrow and name the
compass direction the wind comes FROM.

- **L1 (3):** pick the higher dust cell; find a cell with high dust; mark all cells with high dust.
- **L2 (4):** pick the rainier cell; mark cells with measurable rain; find a cell with the highest rain level; mark cells with moderate or heavier rain (above 0.1637 mm/h).
- **L3 (5):** pick the windier cell; find a cell with high wind; mark all cells with high wind; name the direction the wind comes from at your windiest cell; mark the windy cells (mid or high) with wind from the west (225 to 315 degrees).
- **L4 (6, three stages, never causation):** pick the higher dust cell; mark cells with measurable rain; mark cells with high wind; mark cells that have BOTH high dust and measurable rain; among the rainy cells find the windiest level; mark cells with BOTH high dust and high wind. Questions ask where things occur together, not why.
- **L5 (9, three stages):** mark cells where dust rose between the two dates; where dust fell; where rain rose; where wind rose; find the windiest cell on the second date; name the direction of its wind; mark cells with high dust and measurable rain; pick the higher dust cell; mark cells where dust is mid or high, there is measurable rain and the wind is mid or high.
  "Rose" means the sound level went up (for example low to mid); both dates are played (first date, then second date).

## Scoring

100 points per level, 500 in total. A level's points are split over its objectives by weight (always summing to exactly 100). A wrong attempt costs
15% of the objective's points, a hint 10%, and an objective never pays less than 40%. After three wrong attempts the answer may be shown
(the objective then pays the 40% floor). Hints: level 1 and 2 allow 3 per objective, level 3 and 4 allow 2, level 5 allows 1. The best score of a
level is kept on replay and never lowered.

## Answer safety

The level's values live only inside the engine (`web/experiences/levels/engine.js`). The player-facing view has cell positions and the sound cue
(the level a recording plays), never a number. Only after an objective is completed does the engine reveal the values of the layers it used.
