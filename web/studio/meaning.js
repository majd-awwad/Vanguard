// The meaning phrase of a value: a short, RELATIVE statement ("high compared with this dataset"), never a weather claim.
// It uses the same level as the recording (low / mid / high from the documented breakpoints), so what is said matches what is heard.
// Temperature has no recording but gets the same three levels from the 33rd / 66th percentiles of its 13,000 values.
// Pure functions: no DOM, no audio. Documented in docs/earth-map/SONIFICATION_MAPPING.md.
import { DOCUMENTED_BREAKPOINTS, MIN_VALUE } from "./ambience-core.js";

/** Temperature: 33rd / 66th percentile of all 13,000 values across the 13 sampled dates (degrees C). A test keeps it equal to the catalog. */
export const TEMPERATURE_BREAKPOINTS = Object.freeze({ low: 18.51815947475313, high: 26.74104031232913 });
/** Breakpoints for every phenomenon that gets a meaning phrase. */
export const MEANING_BREAKPOINTS = Object.freeze({ ...DOCUMENTED_BREAKPOINTS, temperature: TEMPERATURE_BREAKPOINTS });
export const MEANING_PHENOMENA = Object.freeze(["dust", "rainfall", "temperature", "wind"]);

const valid = (v) => typeof v === "number" && Number.isFinite(v);

/** "missing" | "none" (no measurable rain) | "low" | "mid" | "high" | null (a phenomenon without a meaning phrase). */
export function meaningLevel({ phenomenon, value, breakpoints = MEANING_BREAKPOINTS[phenomenon] }) {
  if (!MEANING_PHENOMENA.includes(phenomenon)) return null;
  if (!valid(value)) return "missing";
  if (value < (MIN_VALUE[phenomenon] ?? -Infinity)) return "none";
  if (!breakpoints) return null;
  if (value <= breakpoints.low) return "low";
  if (value <= breakpoints.high) return "mid";
  return "high";
}

export const meaningCopy = {
  en: {
    dust: { low: "Dust: low compared with this dataset", mid: "Dust: moderate compared with this dataset", high: "Dust: high compared with this dataset" },
    rainfall: { none: "Rain: no measurable rain", low: "Rain: light compared with this dataset", mid: "Rain: moderate compared with this dataset", high: "Rain: high compared with this dataset" },
    wind: { low: "Wind: low compared with this dataset", mid: "Wind: moderate compared with this dataset", high: "Wind: high compared with this dataset" },
    temperature: { low: "Temperature: cooler compared with this dataset", mid: "Temperature: middle compared with this dataset", high: "Temperature: warmer compared with this dataset" },
    missing: "no data here",
  },
  ar: {
    dust: { low: "غبار منخفض مقارنة ببقية البيانات", mid: "غبار متوسط مقارنة ببقية البيانات", high: "غبار مرتفع مقارنة ببقية البيانات" },
    rainfall: { none: "لا يوجد مطر يُقاس", low: "مطر قليل مقارنة ببقية البيانات", mid: "مطر متوسط مقارنة ببقية البيانات", high: "مطر مرتفع مقارنة ببقية البيانات" },
    wind: { low: "رياح ضعيفة مقارنة ببقية البيانات", mid: "رياح متوسطة مقارنة ببقية البيانات", high: "رياح قوية مقارنة ببقية البيانات" },
    temperature: { low: "حرارة أبرد مقارنة ببقية البيانات", mid: "حرارة متوسطة مقارنة ببقية البيانات", high: "حرارة أدفأ مقارنة ببقية البيانات" },
    missing: "لا توجد بيانات هنا",
  },
};

/** The phrase for a value, or null when the phenomenon has none. */
export function meaningPhrase({ phenomenon, value, breakpoints, language = "en" }) {
  const level = meaningLevel({ phenomenon, value, breakpoints });
  if (level === null) return null;
  const copy = meaningCopy[language] ?? meaningCopy.en;
  return level === "missing" ? copy.missing : copy[phenomenon][level];
}

/** Sensible spoken rounding: rain and dust 2 decimals, wind 1, temperature whole degrees. */
const SPOKEN_DECIMALS = Object.freeze({ dust: 2, rainfall: 2, wind: 1, temperature: 0 });
export const spokenNumber = (phenomenon, value) => {
  const n = Number(value.toFixed(SPOKEN_DECIMALS[phenomenon] ?? 2));
  return String(Object.is(n, -0) ? 0 : n);
};
