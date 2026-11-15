export const orchestraCopy = {
  en: {
    compatibleCount: "compatible", enabledCount: "enabled", audibleCount: "currently audible",
    jumpLabel: "Jump to channel", mapLayer: "Map layer", windowIndependent: "Map colors and listening window are independent.",
    sounding: "Sounding", zeroGain: "Silent · channel volume is zero", masterOff: "Master output is off; check the speaker and volume.",
    dryExplanation: "Intentionally silent · accumulation ≤0.002 mm over this hour; no rainfall pulses.",
    windowUnavailable: "The selected listening window is unavailable for this location/date. Your choice has been kept.",
    selectedWindowUnavailable: "Selected window unavailable", alternativeAvailable: "Available alternative:", noAlternative: "No compatible alternative is available.", useAlternative: "Use available window",
    title: "Scientific Orchestra", open: "Orchestra", close: "Collapse Orchestra", eyebrow: "ADVANCED LISTENING", loading: "Checking scientific compatibility…", ready: "Ready", partial: "Partial data", unavailable: "Unavailable", playing: "Playing", paused: "Paused", stopped: "Stopped", ended: "Complete", idle: "Ready", starting: "Starting…",
    channels: "Orchestra channels and playback", scrollHint: "Scroll within this workspace to reach all four channels.",
    play: "Play", pause: "Pause", stop: "Stop", replay: "Replay", explain: "Explain sound", mute: "Mute", solo: "Solo", enabled: "Active", gain: "Listening volume", window: "Listening window", hour: "19:00–20:00 UTC · Rain / Temperature / Wind", dustWindow: "18:00–21:00 UTC · Dust", select: "Select a cell on the map to listen.", note: "12 seconds of the selected model mean, not a recording or a time series. Volume changes listening balance, never measurements. Each variable keeps its own fixed scale.", source: "NASA GMAO GEOS-FP · model output", valid: "Compatible", dry: "Dry · silent", muted: "Muted", isolated: "Solo", off: "Inactive", excluded: "Excluded by Solo", mutedAll: "No audible channels selected", error: "Audio unavailable. Check your browser’s audio permissions.", comparison: "Orchestra uses absolute values. Return to the value map to listen.",
    names: { rainfall: "Rainfall", temperature: "Temperature", wind: "Wind", dust: "Dust" },
    reasons: {
      catalog: "Collection metadata conflicts with the verified master catalog or source snapshot. This observation is disabled until the publisher reconciles it.",
      locked: "Unlock this dust case in the existing timeline first.", missing: "No supported value at this location and date.", integrity: "Verified data integrity is required for Orchestra.", geography: "The physical grid footprints do not match.", time: "Different averaging windows: hourly layers use 19:00–20:00 UTC; dust uses 18:00–21:00 UTC. They cannot be mixed.", source: "Source, model build or provenance is incompatible.", quality: "The aggregation or data-quality contract is unverified.", variable: "Variable, units or derived values failed validation.", load: "This dataset could not be loaded and verified." },
    mapping: {
      rainfall: "PRECTOT × 3600 s → mm over this exact hour. Square-root scale 0–4 mm; 1.5–14 triangle pulses/s at 520 Hz. ≤0.002 mm is silent.",
      temperature: "T2M − 273.15 → °C at 2 m. Fixed −15–45 °C scale; warmer values raise a sine tone from 220 to 880 Hz.",
      wind: "Speed of the aggregated U10M/V10M vector at 10 m. Fixed 0–16 m/s scale → 2–16 triangle pulses/s at 180 Hz. Eastward flow pans right, westward left; calm is centered.",
      dust: "DUEXTTAU: dust extinction aerosol optical depth at 550 nm, dimensionless. Fixed logarithmic 0.001–2.5 scale → 3–24 pulses/s, 900–2546 Hz; timbre changes from triangle to square to sawtooth. Not ground-level PM concentration.",
    },
  },
  ar: {
    compatibleCount: "متوافقة", enabledCount: "مفعلة", audibleCount: "مسموعة الآن",
    jumpLabel: "انتقل إلى القناة", mapLayer: "طبقة الخريطة", windowIndependent: "ألوان الخريطة وفترة الاستماع مستقلتان.",
    sounding: "مسموعة", zeroGain: "صامتة · مستوى القناة صفر", masterOff: "المخرج الرئيسي متوقف؛ تحقق من زر الصوت ومستواه.",
    dryExplanation: "صامتة عمدًا · تراكم المطر خلال الساعة \u2066≤0.002 mm\u2069؛ لا تُولّد نبضات مطر.",
    windowUnavailable: "فترة الاستماع المحددة غير متاحة لهذا الموقع أو التاريخ. احتُفظ باختيارك.",
    selectedWindowUnavailable: "الفترة المحددة غير متاحة", alternativeAvailable: "الفترة البديلة المتاحة:", noAlternative: "لا توجد فترة بديلة متوافقة.", useAlternative: "استخدم الفترة المتاحة",
    title: "الأوركسترا العلمية", open: "الأوركسترا", close: "طي الأوركسترا", eyebrow: "استماع متقدم", loading: "جارٍ التحقق من التوافق العلمي…", ready: "جاهزة", partial: "بيانات جزئية", unavailable: "غير متاحة", playing: "قيد التشغيل", paused: "متوقفة مؤقتًا", stopped: "متوقفة", ended: "اكتمل التشغيل", idle: "جاهزة", starting: "جارٍ التشغيل…",
    channels: "قنوات الأوركسترا والتشغيل", scrollHint: "مرّر داخل مساحة الاستماع للوصول إلى القنوات الأربع.",
    play: "تشغيل", pause: "إيقاف مؤقت", stop: "إيقاف", replay: "إعادة", explain: "تفسير الصوت", mute: "كتم", solo: "عزل", enabled: "تفعيل", gain: "مستوى الاستماع", window: "فترة الاستماع", hour: "\u206619:00–20:00 UTC\u2069 · المطر / الحرارة / الرياح", dustWindow: "\u206618:00–21:00 UTC\u2069 · الغبار", select: "اختر خلية من الخريطة للاستماع.", note: "١٢ ثانية لتمثيل متوسط النموذج المحدد، وليست تسجيلًا أو سلسلة زمنية. مستوى الصوت يوازن الاستماع ولا يغيّر القياسات. لكل متغير مقياسه الثابت.", source: "NASA GMAO GEOS-FP · مخرجات نموذج", valid: "متوافقة", dry: "جفاف · صامتة", muted: "مكتومة", isolated: "معزولة", off: "غير مفعّلة", excluded: "مستبعدة بالعزل", mutedAll: "لم تُحدّد قنوات مسموعة", error: "الصوت غير متاح. تحقق من أذونات الصوت في المتصفح.", comparison: "تستخدم الأوركسترا القيم المطلقة. عد إلى خريطة القيم للاستماع.",
    names: { rainfall: "الأمطار", temperature: "الحرارة", wind: "الرياح", dust: "الغبار" },
    reasons: {
      catalog: "بيانات فهرس المجموعة تتعارض مع الفهرس الرئيسي أو العينة الموثقة. العينة معطلة إلى أن يصحح الناشر البيانات الوصفية.",
      locked: "افتح حالة الغبار أولًا من الخط الزمني الحالي.", missing: "لا توجد قيمة مدعومة لهذا الموقع والتاريخ.", integrity: "تتطلب الأوركسترا التحقق من سلامة البيانات.", geography: "الحدود الجغرافية الفعلية للخلايا غير متطابقة.", time: "فترات المتوسط مختلفة: الطبقات الساعية 19:00–20:00 UTC والغبار 18:00–21:00 UTC. لا يمكن مزجها.", source: "المصدر أو إصدار النموذج أو توثيقه غير متوافق.", quality: "طريقة التجميع أو جودة البيانات غير موثقة.", variable: "فشل التحقق من المتغير أو الوحدة أو القيم المشتقة.", load: "تعذر تحميل مجموعة البيانات والتحقق منها." },
    mapping: {
      rainfall: "PRECTOT × 3600 s ← تراكم بالملليمتر لهذه الساعة فقط. مقياس جذر تربيعي 0–4 mm ينتج 1.5–14 نبضة مثلثية في الثانية بتردد 520 Hz. القيم ≤0.002 mm صامتة.",
      temperature: "T2M − 273.15 ← درجة مئوية على ارتفاع مترين. مقياس ثابت من ‎−15 إلى 45 °C؛ ارتفاع الحرارة يرفع نغمة جيبية من 220 إلى 880 Hz.",
      wind: "سرعة متجه U10M/V10M المجمّع على ارتفاع 10 أمتار. مقياس ثابت 0–16 m/s ينتج 2–16 نبضة مثلثية في الثانية بتردد 180 Hz. التدفق شرقًا يمينًا وغربًا يسارًا؛ السكون في الوسط.",
      dust: "DUEXTTAU: العمق البصري لانطفاء ضوء 550 nm بسبب الغبار، بلا وحدة. مقياس لوغاريتمي ثابت 0.001–2.5 ينتج 3–24 نبضة في الثانية و900–2546 Hz؛ يتغير النسيج من مثلث إلى مربع إلى سن منشار. ليس تركيز الجسيمات عند سطح الأرض.",
    },
  },
};
