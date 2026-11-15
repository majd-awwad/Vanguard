// Words for the Dust / Rainfall / Wind switch of Explore Earth. The page itself keeps its original copy (explore-copy.js).
// Science sentences describe the phenomenon in general terms and what the model data show; they never claim to measure.

export const exploreData = {
  en: {
    lede: "Pick Dust, Rainfall or Wind. Select a cell on the globe, listen to its sonified NASA model data, see its value and what it means, and compare it with another cell.",
    tabs: { label: "Phenomenon", dust: "Dust", rainfall: "Rainfall", wind: "Wind" },
    date: { label: "Date", locked: "locked until you finish Decode" },
    dry: { rainfall: { notice: "Little or no measurable rain on this date (below 0.1 mm/h counts as none). Try a wetter date:", pick: "{date}, {n}% of cells" }, wind: { notice: "Almost no wind signal on this date. Try a windier date:", pick: "{date}, {n}% of cells" } },
    lock: { title: "This page shows the real values of every cell", text: "Explore Earth reveals the value of every cell, which would give away the Decode missions. Complete Decode level 1 once to unlock it, or look now and spoil the challenge for yourself.", decode: "Go to Decode" },
    dataset: { source: "NASA GMAO GEOS-FP (model)", region: "North Africa, the Middle East and the Mediterranean", date: "{date}, {from}–{to}", coverage: "{south} to {north}, {west} to {east}", note: "Each cell is the area-weighted mean of the real 25 × 40 data cells it covers." },
    phen: {
      dust: {
        name: "Dust", measure: "Dust optical depth", unit: "unitless", variable: "Dust optical depth (550 nm)",
        what: "How much of the sunlight through the whole column of air is blocked by dust. It is a ratio of light intensities, so it has no unit.",
        highLow: "Higher means more dust in the air above that cell (above about 1 is a thick dust haze); near 0 means clear air. “High” here means high compared with the other values of this dataset.",
        why: "Dust is lifted from dry, bare ground by strong winds and carried far downwind, so large values appear near and downwind of deserts. Rain can wash dust out of the air.",
        short: "Dust optical depth: how much sunlight the dust in the air blocks, with no unit. High means more dust above the cell, low means clear air.",
        sound: "Particles show the value; three recordings (low, mid, high) play by the real value.",
      },
      rainfall: {
        name: "Rainfall", measure: "Rain rate", unit: "mm/h", variable: "Rain rate, one-hour mean (mm per hour)",
        what: "How much water falls as rain or snow in an hour, in millimetres per hour. Below 0.1 mm/h counts as no measurable rain and is silent.",
        highLow: "Higher means a heavier shower or storm in that hour; 0 means no rain. “High” here means high compared with the other values of this dataset, which is still light rain in everyday terms.",
        why: "Rain needs moisture and rising air, which come with storms, fronts and seasonal rain belts. Deserts stay dry most of the time.",
        short: "Rain rate in mm per hour. High means a heavier shower in that hour (compared with this dataset); 0 means no rain.",
        sound: "Three recordings by the real value; no measurable rain (below 0.1 mm/h) plays nothing.",
      },
      wind: {
        name: "Wind", measure: "Wind speed", unit: "m/s", variable: "Wind speed at 10 m, one-hour mean (m/s)",
        what: "How fast the air moves near the ground, with the direction it comes from.",
        highLow: "Higher means stronger wind; near 0 means calm air, which has no direction. “High” here means high compared with the other values of this dataset.",
        why: "Wind blows from high to low pressure, so it is strong where pressure changes quickly, for example around storms. Mountains and coasts speed it up or slow it down.",
        short: "Wind speed at 10 m in m/s, with the direction it comes from. High means stronger wind, near 0 means calm.",
        sound: "Three recordings by the real value; the sound sits left or right with the longitude of the cell.",
      },
    },
    selected: { dir: "The wind comes from {dir} ({deg}°)", calm: "Calm: no direction", sound: "Plays the {level} recording.", silent: "Silent: no measurable rain.", missing: "No value for this cell." },
    levelWord: { low: "low", mid: "mid", high: "high" },
    scale: { title: "{measure} scale · {unit}", note: "Colours follow the fixed scale of the Sound Studio." },
    cta: { text: "You have listened, compared and read the data.", button: "Ready? Test yourself in Decode" },
    particles: "Particles visualize the dust optical depth per cell; positions inside a cell are artistic.",
  },
  ar: {
    lede: "اختر الغبار أو الأمطار أو الرياح. حدّد خلية على الكرة، واستمع إلى بيانات نموذج ناسا المحوَّلة إلى صوت، وشاهد قيمتها ومعناها، وقارنها بخلية أخرى.",
    tabs: { label: "الظاهرة", dust: "الغبار", rainfall: "الأمطار", wind: "الرياح" },
    date: { label: "التاريخ", locked: "مقفل حتى تنهي فك الشيفرة" },
    dry: { rainfall: { notice: "لا مطر قابل للقياس تقريبًا في هذا التاريخ (أقل من 0.1 ملم/س يُعدّ بلا مطر). جرّب تاريخًا أكثر مطرًا:", pick: "{date}، {n}% من الخلايا" }, wind: { notice: "لا إشارة رياح تُذكر في هذا التاريخ. جرّب تاريخًا أكثر رياحًا:", pick: "{date}، {n}% من الخلايا" } },
    lock: { title: "تعرض هذه الصفحة القيم الحقيقية لكل خلية", text: "تكشف صفحة استكشف الأرض قيمة كل خلية، وهذا يفضح مهام فك الشيفرة. أكمل المرحلة الأولى من فك الشيفرة مرة واحدة لتفتحها، أو انظر الآن وأفسد التحدي على نفسك.", decode: "اذهب إلى فك الشيفرة" },
    dataset: { source: "NASA GMAO GEOS-FP (نموذج)", region: "شمال أفريقيا والشرق الأوسط والبحر المتوسط", date: "{date}، من {from} إلى {to}", coverage: "من {south} إلى {north}، ومن {west} إلى {east}", note: "كل خلية هي المتوسط المساحي لخلايا البيانات الحقيقية (25 × 40) التي تغطيها." },
    phen: {
      dust: {
        name: "الغبار", measure: "العمق البصري للغبار", unit: "بلا وحدة", variable: "العمق البصري للغبار (550 نانومتر)",
        what: "مقدار ما يحجبه الغبار من ضوء الشمس عبر عمود الهواء كاملًا. وهو نسبة بين شدتي ضوء، فلا وحدة له.",
        highLow: "القيمة الأعلى تعني غبارًا أكثر في الهواء فوق تلك الخلية (فوق نحو 1 يعني ضبابًا ترابيًا كثيفًا)، وقرب الصفر يعني هواءً صافيًا. «مرتفع» هنا تعني مرتفعًا مقارنة ببقية قيم هذه البيانات.",
        why: "ترفع الرياح القوية الغبار من الأرض الجافة العارية وتحمله بعيدًا، فتظهر القيم الكبيرة قرب الصحارى وباتجاه هبوب الرياح عنها. والمطر قد يغسل الغبار من الهواء.",
        short: "العمق البصري للغبار: مقدار ما يحجبه الغبار من ضوء الشمس، بلا وحدة. المرتفع يعني غبارًا أكثر فوق الخلية، والمنخفض يعني هواءً صافيًا.",
        sound: "تُظهر الجسيمات القيمة؛ وتُشغَّل ثلاثة تسجيلات (منخفض ومتوسط ومرتفع) بحسب القيمة الحقيقية.",
      },
      rainfall: {
        name: "الأمطار", measure: "معدل الهطول", unit: "ملم/س", variable: "معدل الهطول، متوسط ساعة (ملم في الساعة)",
        what: "مقدار الماء الذي يسقط مطرًا أو ثلجًا خلال ساعة، بالملليمتر في الساعة. وما دون 0.1 ملم/س يُعدّ بلا مطر قابل للقياس ويكون صامتًا.",
        highLow: "القيمة الأعلى تعني زخة أو عاصفة أشد في تلك الساعة، والصفر يعني لا مطر. «مرتفع» هنا تعني مرتفعًا مقارنة ببقية قيم هذه البيانات، وهو ما زال مطرًا خفيفًا بالمقاييس اليومية.",
        why: "يحتاج المطر إلى بخار ماء وهواء صاعد، وهما يرافقان العواصف والجبهات وأحزمة المطر الموسمية. وتبقى الصحارى جافة معظم الوقت.",
        short: "معدل الهطول بالملليمتر في الساعة. المرتفع يعني زخة أشد في تلك الساعة (مقارنة بهذه البيانات)، والصفر يعني لا مطر.",
        sound: "ثلاثة تسجيلات بحسب القيمة الحقيقية؛ ولا مطر قابل للقياس (أقل من 0.1 ملم/س) لا يُشغّل شيئًا.",
      },
      wind: {
        name: "الرياح", measure: "سرعة الرياح", unit: "م/ث", variable: "سرعة الرياح على ارتفاع 10 م، متوسط ساعة (م/ث)",
        what: "سرعة حركة الهواء قرب الأرض مع الاتجاه الذي تأتي منه.",
        highLow: "القيمة الأعلى تعني رياحًا أقوى، وقرب الصفر يعني هواءً هادئًا بلا اتجاه. «مرتفع» هنا تعني مرتفعًا مقارنة ببقية قيم هذه البيانات.",
        why: "تهبّ الرياح من الضغط المرتفع إلى المنخفض، فتشتد حيث يتغيّر الضغط بسرعة، كما حول العواصف. والجبال والسواحل تزيدها أو تبطئها.",
        short: "سرعة الرياح على ارتفاع 10 م بالمتر في الثانية، مع الاتجاه الذي تأتي منه. المرتفع يعني رياحًا أقوى، وقرب الصفر يعني هدوءًا.",
        sound: "ثلاثة تسجيلات بحسب القيمة الحقيقية؛ ويقع الصوت يسارًا أو يمينًا بحسب خط طول الخلية.",
      },
    },
    selected: { dir: "الرياح تأتي من {dir} ({deg}°)", calm: "هدوء: لا اتجاه", sound: "يُشغَّل تسجيل المستوى {level}.", silent: "صامت: لا مطر قابل للقياس.", missing: "لا توجد قيمة لهذه الخلية." },
    levelWord: { low: "المنخفض", mid: "المتوسط", high: "المرتفع" },
    scale: { title: "مقياس {measure} · {unit}", note: "الألوان تتبع المقياس الثابت لاستوديو الصوت." },
    cta: { text: "استمعت وقارنت وقرأت البيانات.", button: "جاهز؟ اختبر نفسك في فك الشيفرة" },
    particles: "تُصوّر الجسيمات العمق البصري للغبار لكل خلية؛ أما مواضعها داخل الخلية فهي فنية.",
  },
};

export const COMPASS_NAMES = {
  en: { N: "north", NE: "north-east", E: "east", SE: "south-east", S: "south", SW: "south-west", W: "west", NW: "north-west" },
  ar: { N: "الشمال", NE: "الشمال الشرقي", E: "الشرق", SE: "الجنوب الشرقي", S: "الجنوب", SW: "الجنوب الغربي", W: "الغرب", NW: "الشمال الغربي" },
};
