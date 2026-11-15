// Words for the Find signals (Hunter) and Find similar (Echo) panels.
export const analysisCopy = {
  en: {
    hunter: {
      title: "Find signals", intro: "Ask a question of the sampled data. The search covers only the available cells and sampled dates in North Africa and the Mediterranean.",
      question: "Question", q: { highest: "Highest values", threshold: "Above a threshold", largest_increase: "Largest increase between two dates", largest_decrease: "Largest decrease between two dates", anomaly: "Unusual change compared with a baseline" },
      anomalyNo: "Not available. 13 selected snapshots from different seasons are not a baseline, so nothing is called anomalous.",
      date: "Date", from: "Earlier date", to: "Later date", threshold: "Threshold ({unit})", preset: "Use the Decode threshold ({value})", limit: "Number of results",
      search: "Search", cancel: "Cancel", running: "Searching…", cancelled: "Search cancelled.", idle: "Choose a question and press Search.",
      results: "{n} results", noResults: "No results for this question.", insufficient: "Not enough data: {reason}", unsupported: "This period is not supported: {reason}", error: "Search error: {reason}", notAvailable: "Not available: {reason}",
      total: "{total} cells matched; showing {n}.", valueRow: "{id} · {value} {unit} · {date}", deltaRow: "{id} · {delta} {unit} · {first} to {second}", percent: "Percent change: {p}%", percentNo: "Percent change: not valid",
      how: "How was this found?", rows: { question: "Question", dataset: "Dataset", dates: "Dates", calculation: "Calculation", samples: "Cells evaluated", missing: "Missing cells excluded", build: "Model build", source: "Source files", scope: "Scope", quality: "Quality" },
      listen: "Listen to this finding", lockedDates: "Two dust dates are hidden until you finish the Decode challenge.", opened: "Result {rank}: {id}.", found: "{n} results. The first is {id}.", resultsLabel: "Search results", method: { highest: "Highest values on one date", threshold: "Value at or above the threshold", largest_increase: "Largest increase", largest_decrease: "Largest decrease" },
    },
    echo: {
      title: "Find similar", intro: "Select a cell, then find cells whose pattern over the months is closest. Only the same phenomenon and unit are compared, inside one model build.",
      source: "Source cell", noSource: "Select a cell on the map first.", useSelected: "Use the selected cell", chart: "Monthly pattern of {id}", chartLabel: "Monthly values of {id} in {unit}: {range}",
      mode: "Compare", shape: "Shape of the change", shapeText: "How the values rise and fall, ignoring the overall level.", level: "Level and values", levelText: "The actual values in {unit}.",
      align: "Alignment", dtw: "DTW, up to one month of shift", euclid: "Same months only", search: "Search", cancel: "Cancel", running: "Searching…", cancelled: "Search cancelled.", idle: "Select a source cell and press Search.",
      results: "{n} similar cells", distance: "Distance {d}", distanceHelp: "Smaller distance means more similar. It is not a percentage.", insufficient: "Not enough comparable data: {reason}", incompatible: "Not compatible: {reason}", noResults: "No similar cells found.", error: "Search error: {reason}",
      excluded: "Excluded: {flat} nearly constant, {gappy} with gaps.", separation: "Matches are at least {n} cells away from the source.", curves: "Source and match, side by side", sourceLabel: "Source", matchLabel: "Match", listen: "Listen: source, then match",
      dustLocked: "Echo for dust needs the 15 August sample, which is hidden until you finish the Decode challenge.", show: "Show anyway (spoils the challenge)", build: "Model build used: {build}, {n} monthly samples.", datesNote: "2025-08-19 is excluded so the months are regularly spaced.",
      open: "Show this match", opened: "Match {rank}: {id}.", found: "{n} similar cells. The closest is {id}.", resultsLabel: "Similar cells", note: "Similar pattern does not prove the same cause or any causal link.", playing: "Playing {which}",
    },
  },
  ar: {
    hunter: {
      title: "اكتشف إشارات", intro: "اطرح سؤالًا على البيانات المأخوذة. يشمل البحث الخلايا والتواريخ المتاحة فقط في شمال أفريقيا والمتوسط.",
      question: "السؤال", q: { highest: "أعلى القيم", threshold: "ما فوق عتبة", largest_increase: "أكبر زيادة بين تاريخين", largest_decrease: "أكبر نقصان بين تاريخين", anomaly: "تغير غير معتاد مقارنة بخط أساس" },
      anomalyNo: "غير متاح. 13 لقطة مختارة من فصول مختلفة ليست خط أساس، لذلك لا نصف شيئًا بأنه شاذ.",
      date: "التاريخ", from: "التاريخ الأقدم", to: "التاريخ الأحدث", threshold: "العتبة ({unit})", preset: "استخدم عتبة فك الشيفرة ({value})", limit: "عدد النتائج",
      search: "ابحث", cancel: "إلغاء", running: "جارٍ البحث…", cancelled: "أُلغي البحث.", idle: "اختر سؤالًا واضغط ابحث.",
      results: "{n} نتائج", noResults: "لا نتائج لهذا السؤال.", insufficient: "بيانات غير كافية: {reason}", unsupported: "هذه الفترة غير مدعومة: {reason}", error: "خطأ في البحث: {reason}", notAvailable: "غير متاح: {reason}",
      total: "طابقت {total} خلية؛ يُعرض {n}.", valueRow: "{id} · {value} {unit} · {date}", deltaRow: "{id} · {delta} {unit} · من {first} إلى {second}", percent: "نسبة التغير: {p}٪", percentNo: "نسبة التغير: غير صالحة",
      how: "كيف تم الاكتشاف؟", rows: { question: "السؤال", dataset: "البيانات", dates: "التواريخ", calculation: "الحساب", samples: "الخلايا المقيَّمة", missing: "الخلايا المفقودة المستبعدة", build: "إصدار النموذج", source: "ملفات المصدر", scope: "النطاق", quality: "الجودة" },
      listen: "استمع إلى هذا الاكتشاف", lockedDates: "تاريخان للغبار مخفيان حتى تنهي تحدي فك الشيفرة.", opened: "النتيجة {rank}: {id}.", found: "{n} نتائج. أولها {id}.", resultsLabel: "نتائج البحث", method: { highest: "أعلى القيم في تاريخ واحد", threshold: "قيمة عند العتبة أو أعلى", largest_increase: "أكبر زيادة", largest_decrease: "أكبر نقصان" },
    },
    echo: {
      title: "ابحث عن شبيه", intro: "اختر خلية، ثم ابحث عن خلايا يقترب نمطها عبر الأشهر من نمطها. تُقارن الظاهرة والوحدة نفسهما فقط، داخل إصدار نموذج واحد.",
      source: "خلية المصدر", noSource: "اختر خلية على الخريطة أولًا.", useSelected: "استخدم الخلية المحددة", chart: "النمط الشهري للخلية {id}", chartLabel: "القيم الشهرية للخلية {id} بوحدة {unit}: {range}",
      mode: "قارن", shape: "شكل التغير", shapeText: "كيف ترتفع القيم وتنخفض، دون اعتبار المستوى العام.", level: "المستوى والقيم", levelText: "القيم الفعلية بوحدة {unit}.",
      align: "المحاذاة", dtw: "DTW مع انزياح حتى شهر", euclid: "الأشهر نفسها فقط", search: "ابحث", cancel: "إلغاء", running: "جارٍ البحث…", cancelled: "أُلغي البحث.", idle: "اختر خلية مصدر واضغط ابحث.",
      results: "{n} خلايا مشابهة", distance: "المسافة {d}", distanceHelp: "المسافة الأصغر تعني تشابهًا أكبر. وهي ليست نسبة مئوية.", insufficient: "بيانات قابلة للمقارنة غير كافية: {reason}", incompatible: "غير متوافق: {reason}", noResults: "لم تُوجد خلايا مشابهة.", error: "خطأ في البحث: {reason}",
      excluded: "المستبعد: {flat} شبه ثابتة، و{gappy} فيها فجوات.", separation: "تبعد النتائج عن المصدر {n} خلايا على الأقل.", curves: "المصدر والنتيجة جنبًا إلى جنب", sourceLabel: "المصدر", matchLabel: "النتيجة", listen: "استمع: المصدر ثم النتيجة",
      dustLocked: "يحتاج البحث عن شبيه في الغبار إلى عينة 15 أغسطس المخفية حتى تنهي تحدي فك الشيفرة.", show: "أظهرها على أي حال (يفسد التحدي)", build: "إصدار النموذج المستخدم: {build}، {n} عينات شهرية.", datesNote: "يُستبعد 2025-08-19 لتكون الأشهر منتظمة التباعد.",
      open: "اعرض هذه النتيجة", opened: "النتيجة {rank}: {id}.", found: "{n} خلايا مشابهة. أقربها {id}.", resultsLabel: "الخلايا المشابهة", note: "التشابه في النمط لا يثبت السبب نفسه ولا علاقة سببية.", playing: "تشغيل {which}",
    },
  },
};
