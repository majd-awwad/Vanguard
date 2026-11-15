import { mapCopy } from "./earthmap-copy.js";

// Copy added by the final UI pass: the map-app chrome (tool rail, inspector, help sheet, timeline). Merged over mapCopy.
const ui = {
  en: {
    tools: { explore: "Explore", area: "Area", path: "Path", compare: "Compare", hunter: "Find signals", echo: "Find similar" },
    phen: { short: { dust: "Dust", rainfall: "Rain", temperature: "Temperature", wind: "Wind", forests: "Forests" } },
    help: {
      mapping: "What the sound means",
      keyboard: "Keyboard",
      data: "About the data",
      mapHint: "Map. Arrow keys move one cell, R reads the value, Space replays the sound, plus and minus zoom, Home resets the view.",
      shortcuts: [["← ↑ → ↓", "move one cell (left is always west)"], ["Enter", "select the cell and play it"], ["R", "read the value aloud"], ["Space", "replay the sound"], ["+ −", "zoom"], ["Shift + arrows", "pan the map"], ["Home", "reset the view"], ["Esc", "stop speech, close a panel"], ["?", "open this help"]],
      notes: ["Each square is one model cell, {cellLat}° × {cellLon}°. Colours are blended for clarity; the value always belongs to the square.", "Values come from NASA's GEOS-FP model analysis, not from a direct observation.", "Hatched squares have no value.", "Coverage is North Africa and the Mediterranean only."],
    },
    info: { how: "How was this computed?", collapse: "Collapse details", modelBadge: "model (GEOS-FP)", panelShow: "Show the side panel", panelHide: "Hide the side panel" },
    mobile: { expand: "Resize panel" },
    sound: { timePlay: "Play through the dates", timePause: "Pause the date sequence", pill: "Sound" },
  },
  ar: {
    tools: { explore: "استكشاف", area: "منطقة", path: "مسار", compare: "مقارنة", hunter: "البحث عن إشارات", echo: "البحث عن أماكن مشابهة" },
    phen: { short: { dust: "غبار", rainfall: "مطر", temperature: "حرارة", wind: "رياح", forests: "غابات" } },
    help: {
      mapping: "ماذا يعني الصوت",
      keyboard: "لوحة المفاتيح",
      data: "عن البيانات",
      mapHint: "الخريطة. مفاتيح الأسهم تحرّك خلية واحدة، وR تقرأ القيمة، والمسافة تعيد الصوت، وزائد وناقص للتكبير، وHome لإعادة العرض.",
      shortcuts: [["← ↑ → ↓", "تحريك خلية واحدة (اليسار دائمًا غرب)"], ["Enter", "اختيار الخلية وتشغيلها"], ["R", "قراءة القيمة بصوت مسموع"], ["Space", "إعادة تشغيل الصوت"], ["+ −", "تكبير وتصغير"], ["Shift + الأسهم", "تحريك الخريطة"], ["Home", "إعادة ضبط العرض"], ["Esc", "إيقاف الصوت وإغلاق اللوحة"], ["?", "فتح هذه المساعدة"]],
      notes: ["كل مربع هو خلية نموذج واحدة، {cellLat}° × {cellLon}°. الألوان ممزوجة للوضوح، والقيمة تخص المربع دائمًا.", "القيم من تحليل نموذج GEOS-FP التابع لناسا، وليست رصدًا مباشرًا.", "المربعات المخططة بلا قيمة.", "التغطية: شمال أفريقيا والمتوسط فقط."],
    },
    info: { how: "كيف حُسبت هذه القيمة؟", collapse: "طيّ التفاصيل", modelBadge: "نموذج (GEOS-FP)", panelShow: "إظهار اللوحة الجانبية", panelHide: "إخفاء اللوحة الجانبية" },
    mobile: { expand: "تغيير حجم اللوحة" },
    sound: { timePlay: "تشغيل التواريخ بالتتابع", timePause: "إيقاف التتابع مؤقتًا", pill: "الصوت" },
  },
};

const merge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? merge(a[k], v) : v;
  return out;
};

export const copyFor = (language) => merge(mapCopy[language], ui[language]);
