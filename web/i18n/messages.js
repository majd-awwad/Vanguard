const ar = {
  skip: "انتقل إلى الاستكشاف", nav: "المعرض", navExplore: "استكشف", navScience: "العلم",
  heroLabel: "دراسة ميدانية / ناسا GEDI", titleLine: "الغابة", titleAccent: "غير المرئية.",
  intro: "مرّت نبضات ليزر فوق البرازيل. استمع إلى الإشارة العائدة، بصمة تلو أخرى.",
  begin: "استمع على امتداد المسار", beginSilent: "استكشف دون صوت", location: "السيرادو، البرازيل",
  photo: "صورة توضيحية لغابة · إيغور جوستو", sonicLens: "عدسة الاستماع", lens: "اتبع صدى الليزر.",
  lensIntro: "ثبّت نطاقًا من الارتفاعات، ثم قارن عائد الليزر عبر ست بصمات مقاسة.",
  acquired: "18 أبريل 2019 · البرازيل", modes: "محور المسح", horizontal: "على امتداد المسار",
  vertical: "عبر ارتفاعات البصمة", footprint: "البصمة", heightRange: "نطاق الارتفاع", from: "من (م)", to: "إلى (م)",
  heightStep: "شريحة الارتفاع", play: "تشغيل", pause: "إيقاف مؤقت", replay: "إعادة", previous: "الخطوة السابقة",
  next: "الخطوة التالية", speed: "سرعة التشغيل", detective: "محقّق الأرض", question: "أين يظهر العائد الأقوى؟",
  questionIntro: "قارن البصمتين 02 و06 بين 4 و10 أمتار فوق سطح الأرض المقدّر.",
  pair: "مقارنة بصمتين", reveal: "اكشف نتيجة المقارنة", open: "استكشف المسار كاملًا",
  currentReturn: "العائد الحالي", inspect: "افحص هذا الرصد", studio: "استوديو الصوت",
  volume: "مستوى الصوت", mute: "اكتم نغمات البيانات", runSound: "شغّل المسح بالصوت", runSilent: "شغّل المسح دون صوت",
  mapping: "تردد النغمة ثابت عند 440 هرتز. الكسب يساوي 0.32 مضروبًا في الجذر التربيعي لحصّة العائد. عند سرعة 1×، يمر المسح العمودي بمعدل 0.13 ثانية لكل متر، والمسح الأفقي بمعدل 65 مترًا لكل ثانية تشغيل.",
  evidence: "أدلة الرصد ومصادره", science: "ماذا عاد إلى المستشعر؟",
  scienceBody: "يقيس GEDI ضوء الليزر المنعكس من البصمة. تمثّل النغمات حصّة من الإشارة المصحّحة فوق عتبة الضجيج، ضمن نافذة ثابتة من −10 إلى 22 مترًا قياسًا إلى سطح الأرض المقدّر.",
  scienceLimits: "تؤثر التضاريس والانعكاسية والغطاء النباتي في العائد. لا تحدد هذه الإشارة وحدها كثافة الأوراق أو عدد الأشجار أو الكتلة الحيوية. لا توجد قياسات في الفجوات بين بصمات هذا المرور.",
  scienceMethod: "نطرح تقدير خلفية الجهاز وثلاثة انحرافات معيارية للضجيج، ثم نجمع الباقي الموجب في شرائح بعرض متر. نقسم الناتج على مجموع النافذة نفسها لكل بصمة.",
  dictionary: "توثيق موجة GEDI", returnToLens: "استكشف البصمات الست",
  frameAlt: "خريطة ناسا لارتفاعات الغطاء النباتي من GEDI، مع مسارات رصد ملوّنة ومقياس للارتفاع.",
  frameLink: "ارتفاع الغابات من GEDI · استوديو التصور العلمي في ناسا",
  frameScope: "سياق المهمة بمقياس RH100 من L2B. لم تتحقق مطابقة هذا الإطار مع البصمات الست من L1B وL2A.",
  footer: "الغابة غير المرئية · فريق Vanguard",
};

const strings = {
  axisHorizontal: ["Fixed height band · discrete footprints", "نطاق ارتفاع ثابت · بصمات منفصلة"],
  axisVertical: ["Fixed footprint · one-metre height bins", "بصمة ثابتة · شرائح ارتفاع بعرض متر"],
  keyHorizontal: ["Brighter bands carry a larger return share. Gaps are unsampled.", "تشير الشرائح الأفتح إلى حصّة أكبر من العائد. لا توجد عينات في الفجوات."],
  keyVertical: ["Bar length shows the return share in each one-metre band.", "يمثّل طول الشريط حصّة العائد في كل شريحة بعرض متر."],
  footprint: ["Footprint", ar.footprint],
  plotHeight: ["Height above estimated ground", "الارتفاع فوق الأرض المقدّرة"],
  plotDistance: ["Sampled footprints in acquisition order", "البصمات حسب ترتيب الرصد"],
  plotShare: ["Share of residual return by height", "حصّة العائد المتبقي حسب الارتفاع"],
  starting: ["Starting audio…", "تهيئة الصوت…"], playing: ["Playing", "التشغيل جارٍ"],
  playingSilent: ["Visual playback", "تشغيل مرئي"], paused: ["Paused", "متوقف مؤقتًا"],
  ended: ["Scan complete", "اكتمل المسح"], ready: ["Ready", "جاهز"],
  fallback: ["Audio unavailable. Visual playback is active.", "الصوت غير متاح. التشغيل المرئي يعمل."],
  below: ["Below processing threshold", "دون عتبة المعالجة"],
  missing: ["Measurement unavailable", "الرصد غير متاح"], excluded: ["Excluded by quality screening", "مستبعد حسب فحص الجودة"],
  measured: ["Derived from verified GEDI return", "مشتق من إشارة GEDI المتحققة"],
  observationId: ["GEDI shot number", "معرّف لقطة GEDI"], heightBand: ["Height range", "نطاق الارتفاع"],
  returnShare: ["Return share", "حصّة العائد"], time: ["Acquisition (UTC)", "وقت الرصد (UTC)"],
  center: ["Footprint centre (WGS84)", "مركز البصمة (WGS84)"], orbit: ["Orbit / track / beam", "المدار / المسار / الشعاع"],
  distance: ["Distance along track", "المسافة على المسار"], rh100: ["L2A RH100", "مقياس RH100 من L2A"],
  ground: ["Estimated ground (WGS84 ellipsoid)", "الأرض المقدّرة (إهليلج WGS84)"],
  acquisitionQuality: ["Quality / degrade / sensitivity", "الجودة / التدهور / الحساسية"],
  rxIndex: ["L1B waveform start (one-based) / count", "بداية موجة L1B (ترقيم من 1) / عدد العينات"],
  evidenceStatus: ["Evidence status", "حالة الدليل"], mappingVersion: ["Mapping version", "إصدار التحويل"],
  sampleLink: ["Verified sample JSON", "ملف العيّنة المتحققة JSON"], manifestLink: ["Provenance manifest and checksums", "سجل المصادر والبصمات الرقمية"],
  sourceNote: ["Historical release V001, preserved in checksummed rGEDI subsets of NASA granules.", "الإصدار التاريخي V001 محفوظ في مقتطفات rGEDI من ملفات ناسا، مع بصمات رقمية متحققة."],
  windowNote: ["Percentages use the same −10 to 22 m normalization window for every footprint.", "تستخدم النسب نافذة التطبيع نفسها لكل بصمة، من −10 إلى 22 مترًا."],
  error: ["The verified GEDI data could not be loaded. Rebuild the exhibit and retry.", "تعذّر تحميل بيانات GEDI المتحققة. أعد تجميع المعرض وحاول مجددًا."],
  meters: ["m", "م"], of: ["of", "من"],
};

export function messages(language) {
  return (key) => strings[key]?.[language === "ar" ? 1 : 0] ?? key;
}

export function localizePage(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = language === "ar" ? "الغابة غير المرئية · EARTHPULSE" : "The Invisible Forest · EARTHPULSE";
  for (const [attribute, target] of [["copy", null], ["label", "aria-label"], ["alt", "alt"]]) {
    for (const element of document.querySelectorAll(`[data-${attribute}]`)) {
      if (!element.dataset.english) element.dataset.english = target ? element.getAttribute(target) : element.textContent;
      const text = language === "ar" ? ar[element.dataset[attribute]] : element.dataset.english;
      if (target) element.setAttribute(target, text);
      else element.textContent = text;
    }
  }
  const toggle = document.querySelector("#locale");
  toggle.textContent = language === "ar" ? "English" : "العربية";
  toggle.lang = language === "ar" ? "en" : "ar";
}
