// Words for the five-level Decode game (web/pages/decode.html). Arabic is written as Arabic, not translated word by word.
// Tokens in {braces} are filled by decode-game.js. No value of the data appears here.

const compassEn = { N: "north", NE: "north-east", E: "east", SE: "south-east", S: "south", SW: "south-west", W: "west", NW: "north-west" };
const compassAr = { N: "الشمال", NE: "الشمال الشرقي", E: "الشرق", SE: "الجنوب الشرقي", S: "الجنوب", SW: "الجنوب الغربي", W: "الغرب", NW: "الشمال الغربي" };

export const gameCopy = {
  en: {
    title: "Decode", eyebrow: "Decode · five levels",
    lede: "Listen to real NASA model data and answer science missions. Five levels, a bigger map each time, your own profile and a final award.",
    skip: "Skip to the game",
    profiles: {
      title: "Who is playing?", lede: "Create a profile or pick yours to start.",
      local: "Saved only in this browser. There is no email, password or account, and profiles are not synced across devices.",
      notSaved: "This browser blocks storage, so your progress will be lost when you close the page.",
      newTitle: "New profile", name: "Display name", namePlaceholder: "Your name", avatar: "Choose an avatar", create: "Create and start",
      errors: { name: "Please type a name.", duplicate: "A profile with this name already exists.", full: "This browser already holds the maximum number of profiles." },
      play: "Play as {name}", remove: "Delete {name}", removeShort: "Delete", summary: "{total}/500 points · {done}/5 levels",
      confirm: "Delete {name}? Their progress is removed from this browser. This cannot be undone.", confirmYes: "Yes, delete", confirmNo: "Keep it",
      existing: "Profiles on this browser", empty: "No profiles yet.", switch: "Switch profile",
    },
    avatars: { globe: "Globe", dune: "Dune", cloud: "Cloud", wave: "Wave", wind: "Wind", sun: "Sun", rocket: "Rocket", satellite: "Satellite" },
    levels: {
      hello: "Hello, {name}", total: "Total score", of: "of 500", choose: "Choose a level", grid: "Grid {rows}×{cols} · {cells} cells", data: "Data", date: "Date", dates: "Dates {from} → {to}",
      state: { locked: "Locked", open: "Ready", done: "Completed" }, lockedWhy: "Complete level {n} first.", play: "Play", replay: "Replay", resume: "Continue", best: "Best {score}/100", objectives: "{n} objectives",
      original: "Play the original dust challenge", explore: "Explore Earth", exploreLocked: "Explore Earth opens after you finish level 1.", award: "See my certificate", achievements: "Achievements",
      difficulty: { beginner: "Beginner", easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" },
      info: {
        1: { name: "Dust Discovery", about: "Learn how Decode works: listen to cells, compare two of them and mark the dustiest ones.", data: "Dust" },
        2: { name: "Rainfall Explorer", about: "Rain is patchy. Compare rainfall intensity across regions on a wet day.", data: "Rainfall" },
        3: { name: "Wind Investigator", about: "Wind has a speed and a direction. Find the strongest wind and read where it comes from.", data: "Wind speed and direction" },
        4: { name: "Earth Pattern Detective", about: "Dust, rain and wind on the same day. Find where they occur together. Together is not the same as caused by.", data: "Dust + rain + wind" },
        5: { name: "Earth Master", about: "Two dates, three phenomena. Track what changed and combine everything you learned.", data: "Dust + rain + wind, two dates" },
      },
    },
    phen: { dust: "dust", rain: "rain", wind: "wind" },
    phenTitle: { dust: "Dust", rain: "Rainfall", wind: "Wind" },
    levelWord: { low: "low", mid: "mid", high: "high" },
    play: {
      levelOf: "Level {n} · {name}", back: "All levels", objective: "Objective {k} of {n}", stage: "Stage {s}", progress: "Mission progress", score: "Level score {score}/100",
      gridLabel: "Cells of the level map. Letter is the row from the north, number is the column from the west. Press Enter or Space to select and listen.", help: "Arrow keys move between cells. Enter or Space selects a cell and plays its sound. M marks or unmarks it.",
      cellLabel: "Cell {id}, {lat}, {lon}", selected: "Selected cell {id}", none: "Select a cell on the map to listen to it.",
      listen: "Listen", listenLayer: "Listen to", hearBoth: "Hear both dates", hearA: "Hear A", hearB: "Hear B", mark: "Mark this cell", unmark: "Unmark this cell", clear: "Clear marks", check: "Check my marks",
      marked: "Marked cells: {n}", answerCell: "This is my answer", higherA: "A is higher", higherB: "B is higher", directionLegend: "The wind at {id} comes from", checkAnswer: "Check my answer",
      hint: "Hint", hintCost: "A hint costs points. {n} left on this objective.", noHints: "No hints left on this objective.", showAnswer: "Show me and continue", showNote: "After three tries you can show the answer; the objective then pays only 40%.",
      next: "Next objective", finish: "See my result", cueTitle: "Sound cue", cueOff: "Show sound cues as text", cueNote: "Everything can be solved with sound off: turn this on to read what each recording would play.", soundOn: "Sound on", soundOff: "Sound off", volume: "Volume",
      soundNote: "Recordings play the sound level (low / mid / high) of the real value. Pan: west left, east right. Pitch of the playback: faster in the north, slower in the south.",
      cue: "Sound level: {level}", cueSilent: "Silence: no measurable rain here", cueMissing: "No data for this cell", cueTwo: "First date: {a} · second date: {b}", cueNone: "silence",
      dates: "{phen}, {date}", datesChange: "{phen}, {from} → {to}", mapNote: "Model data (NASA GMAO GEOS-FP). Each cell is an area average of real data cells.",
      sound: { loading: "Loading the sound…", unavailable: "Sound is unavailable here; use the text cues." },
      feedback: {
        correct: "Correct. {points} points.", pickWrong: "Not quite. Listen to both cells again, then choose.", maxWrong: "That cell is not in the highest level. Listen to a few more.", dirWrong: "Not quite. Remember the arrow shows where the wind goes, not where it comes from.",
        marks: "{hits} of your marks are right, {extra} are extra and {missing} are missing. Listen again and adjust.", marksOk: "Correct. {hits} cells matched.", truth: "The correct cells: {cells}.", shown: "Here is the answer: {cells}.",
        both: "Cells where these occur together are a pattern, not a proof that one causes the other.", change: "Rose or fell means the sound level changed between the two dates.",
      },
      prompt: {
        "pick-higher": "Listen to cells A and B. Which one has the higher {phen} level?",
        "find-max": "Find a cell with the highest {phen} level.", "find-max-restrict": "Among the highlighted cells, find one with the highest {phen} level.",
        "mark-set": "Mark every cell with {rule}.", direction: "The arrow shows where the wind at {id} blows to. From which direction does it come?",
      },
      rules: {
        "dust:3": "high dust", "rain:1": "measurable rain (at least 0.1 mm/h)", "rain:2": "moderate or heavier rain", "rain:3": "heavy rain", "wind:2": "moderate or stronger wind", "wind:3": "high wind", west: "wind from the west",
        rose: "{phen} that went up", fell: "{phen} that went down", and: " and ", bothPrefix: "BOTH ", allPrefix: "ALL of: ", dateSuffix: " on the second date", change: "{phen} that went up between the two dates",
      },
      hints: {
        1: { "mark-set": "Listen to many cells and compare. The rule is about the sound level: low, mid or high.", "find-max": "Compare the sound levels of a few cells; the highest level is the loudest recording.", "pick-higher": "Listen to both, then compare their sound levels.", direction: "An arrow points where the wind is going. The direction it comes from is the opposite one." },
        2: { region: "Look in the {ns}, {ew} part of the map.", higher: "The higher one is {which}.", from: "The wind comes from the {from}." },
        3: { cell: "Cell {id} is part of the answer." },
      },
      ns: { north: "northern", south: "southern" }, ew: { west: "western", east: "eastern" },
    },
    result: {
      title: "Level {n} complete", score: "Level score", best: "Best score", total: "Total", points: "{earned}/{points}", wrong: "{n} wrong tries", hints: "{n} hints", shown: "answer shown", perfect: "A perfect level.", improved: "New best score!",
      next: "Next level", replay: "Replay this level", levels: "All levels", finish: "See my award", review: "Review the data", reviewNote: "Now that the level is finished, the real values are shown. Colours follow the data scale; select a cell to read its value.",
      value: "Value", layer: "Layer", unit: { dust: "unitless (dust optical depth)", rain: "mm/h", wind: "m/s" }, direction: "Wind from {dir}", missing: "No data for this cell", legendLow: "low", legendHigh: "high",
      objectives: "Objectives", unlocked: "Level {n} is unlocked.", types: { "pick-higher": "Compare two cells", "find-max": "Find the highest level", "mark-set": "Mark the matching cells", direction: "Read the wind direction" },
    },
    award: {
      title: "Earth Master", congrats: "Congratulations, {name}!", text: "You completed all five Decode levels.", score: "Final score {score} out of 500", certificate: "EarthPulse Earth Master", team: "Team Vanguard",
      disclaimer: "Not an official NASA certificate", download: "Download certificate (PNG)", replay: "Replay a level", explore: "Go to Explore Earth", summary: "Your levels", levelLine: "Level {n} · {name}: {score}/100", fileName: "earthpulse-earth-master",
      certText: "{name} completed all five Decode levels with {score} out of 500 points.", date: "Completed {date}", back: "Back to the levels",
    },
    ach: { "level-1": "Dust Discovery complete", "level-2": "Rainfall Explorer complete", "level-3": "Wind Investigator complete", "level-4": "Earth Pattern Detective complete", "level-5": "Earth Master complete", "no-hints": "A level without hints", "perfect-level": "A perfect level", "earth-master": "Earth Master" },
    errors: { load: "The data could not be loaded.", retry: "Try again", loading: "Loading the data and the sound…" },
    compass: compassEn,
    credit: "Data: NASA GMAO GEOS-FP (model output, not measurements). Earth imagery: NASA Earth Observatory, Blue Marble. EARTHPULSE is a student project and is not endorsed by NASA.",
  },
  ar: {
    title: "فك الشيفرة", eyebrow: "فك الشيفرة · خمس مراحل",
    lede: "استمع إلى بيانات نموذج ناسا الحقيقية وأجب عن مهام علمية. خمس مراحل، وخريطة أكبر في كل مرة، وملفك الشخصي، وجائزة في النهاية.",
    skip: "تخطَّ إلى اللعبة",
    profiles: {
      title: "من يلعب؟", lede: "أنشئ ملفًا شخصيًا أو اختر ملفك لتبدأ.",
      local: "يُحفظ في هذا المتصفح فقط. لا بريد إلكتروني ولا كلمة مرور ولا حساب، والملفات لا تتزامن بين الأجهزة.",
      notSaved: "هذا المتصفح يمنع التخزين، لذلك سيضيع تقدّمك عند إغلاق الصفحة.",
      newTitle: "ملف جديد", name: "الاسم المعروض", namePlaceholder: "اسمك", avatar: "اختر صورة رمزية", create: "أنشئ وابدأ",
      errors: { name: "اكتب اسمًا من فضلك.", duplicate: "يوجد ملف بهذا الاسم.", full: "بلغ هذا المتصفح الحد الأقصى من الملفات." },
      play: "العب باسم {name}", remove: "احذف {name}", removeShort: "حذف", summary: "{total}/500 نقطة · {done}/5 مراحل",
      confirm: "هل تحذف {name}؟ سيُزال تقدّمه من هذا المتصفح ولا يمكن التراجع.", confirmYes: "نعم، احذف", confirmNo: "أبقِه",
      existing: "الملفات في هذا المتصفح", empty: "لا توجد ملفات بعد.", switch: "تبديل الملف",
    },
    avatars: { globe: "كرة أرضية", dune: "كثيب", cloud: "سحابة", wave: "موجة", wind: "ريح", sun: "شمس", rocket: "صاروخ", satellite: "قمر صناعي" },
    levels: {
      hello: "مرحبًا، {name}", total: "مجموع النقاط", of: "من 500", choose: "اختر مرحلة", grid: "شبكة {rows}×{cols} · {cells} خلية", data: "البيانات", date: "التاريخ", dates: "التاريخان {from} ← {to}",
      state: { locked: "مقفلة", open: "جاهزة", done: "مكتملة" }, lockedWhy: "أكمل المرحلة {n} أولًا.", play: "العب", replay: "أعد اللعب", resume: "تابع", best: "أفضل نتيجة {score}/100", objectives: "{n} أهداف",
      original: "العب تحدي الغبار الأصلي", explore: "استكشف الأرض", exploreLocked: "تُفتح صفحة استكشف الأرض بعد إنهاء المرحلة الأولى.", award: "شاهد شهادتي", achievements: "الإنجازات",
      difficulty: { beginner: "مبتدئ", easy: "سهل", medium: "متوسط", hard: "صعب", expert: "خبير" },
      info: {
        1: { name: "اكتشاف الغبار", about: "تعلّم كيف تعمل اللعبة: استمع إلى الخلايا، وقارن بين خليتين، وعلّم الخلايا الأكثر غبارًا.", data: "الغبار" },
        2: { name: "مستكشف الأمطار", about: "المطر متفرّق. قارن شدة الهطول بين المناطق في يوم ممطر.", data: "الأمطار" },
        3: { name: "محقق الرياح", about: "للرياح سرعة واتجاه. اعثر على أقوى رياح واقرأ من أين تأتي.", data: "سرعة الرياح واتجاهها" },
        4: { name: "محقق أنماط الأرض", about: "الغبار والمطر والرياح في اليوم نفسه. اعثر على أماكن حدوثها معًا. الحدوث معًا لا يعني أن أحدها سبب الآخر.", data: "غبار + مطر + رياح" },
        5: { name: "سيّد الأرض", about: "تاريخان وثلاث ظواهر. تتبّع ما تغيّر واجمع كل ما تعلّمته.", data: "غبار + مطر + رياح، تاريخان" },
      },
    },
    phen: { dust: "الغبار", rain: "المطر", wind: "الرياح" },
    phenTitle: { dust: "الغبار", rain: "الأمطار", wind: "الرياح" },
    levelWord: { low: "منخفض", mid: "متوسط", high: "مرتفع" },
    play: {
      levelOf: "المرحلة {n} · {name}", back: "كل المراحل", objective: "الهدف {k} من {n}", stage: "المرحلة الفرعية {s}", progress: "تقدّم المهمة", score: "نتيجة المرحلة {score}/100",
      gridLabel: "خلايا خريطة المرحلة. الحرف هو الصف من الشمال، والرقم هو العمود من الغرب. اضغط Enter أو المسافة لاختيار الخلية والاستماع إليها.", help: "مفاتيح الأسهم تنقلك بين الخلايا. Enter أو المسافة تختار الخلية وتشغّل صوتها. الحرف M يعلّم الخلية أو يلغي تعليمها.",
      cellLabel: "الخلية {id}، {lat}، {lon}", selected: "الخلية المحددة {id}", none: "اختر خلية على الخريطة لتستمع إليها.",
      listen: "استمع", listenLayer: "استمع إلى", hearBoth: "استمع إلى التاريخين", hearA: "استمع إلى أ", hearB: "استمع إلى ب", mark: "علّم هذه الخلية", unmark: "ألغِ تعليم هذه الخلية", clear: "امسح العلامات", check: "تحقّق من علاماتي",
      marked: "الخلايا المعلّمة: {n}", answerCell: "هذه إجابتي", higherA: "أ هي الأعلى", higherB: "ب هي الأعلى", directionLegend: "الرياح عند {id} تأتي من", checkAnswer: "تحقّق من إجابتي",
      hint: "تلميح", hintCost: "التلميح يكلّف نقاطًا. تبقّى {n} على هذا الهدف.", noHints: "لا توجد تلميحات متبقية لهذا الهدف.", showAnswer: "أرني الإجابة وتابع", showNote: "بعد ثلاث محاولات يمكنك إظهار الإجابة؛ فيمنح الهدف 40٪ فقط.",
      next: "الهدف التالي", finish: "شاهد نتيجتي", cueTitle: "إشارة الصوت", cueOff: "اعرض إشارات الصوت كنص", cueNote: "يمكن حل كل شيء والصوت مغلق: فعّل هذا الخيار لتقرأ ما كان سيُشغّله كل تسجيل.", soundOn: "الصوت يعمل", soundOff: "الصوت متوقف", volume: "مستوى الصوت",
      soundNote: "تُشغَّل تسجيلات بمستوى الصوت (منخفض / متوسط / مرتفع) للقيمة الحقيقية. التوزيع: الغرب يسارًا والشرق يمينًا. سرعة التشغيل: أسرع في الشمال وأبطأ في الجنوب.",
      cue: "مستوى الصوت: {level}", cueSilent: "صمت: لا مطر قابل للقياس هنا", cueMissing: "لا توجد بيانات لهذه الخلية", cueTwo: "التاريخ الأول: {a} · التاريخ الثاني: {b}", cueNone: "صمت",
      dates: "{phen}، {date}", datesChange: "{phen}، من {from} إلى {to}", mapNote: "بيانات نموذج (NASA GMAO GEOS-FP). كل خلية متوسط مساحي لخلايا بيانات حقيقية.",
      sound: { loading: "جارٍ تحميل الصوت…", unavailable: "الصوت غير متاح هنا؛ استخدم الإشارات النصية." },
      feedback: {
        correct: "صحيح. {points} نقطة.", pickWrong: "ليس تمامًا. استمع إلى الخليتين مرة أخرى ثم اختر.", maxWrong: "هذه الخلية ليست في أعلى مستوى. استمع إلى بعض الخلايا الأخرى.", dirWrong: "ليس تمامًا. تذكّر أن السهم يُظهر إلى أين تذهب الرياح لا من أين تأتي.",
        marks: "{hits} من علاماتك صحيحة، و{extra} زائدة، و{missing} ناقصة. استمع مرة أخرى وعدّل.", marksOk: "صحيح. طابقت {hits} خلايا.", truth: "الخلايا الصحيحة: {cells}.", shown: "هذه هي الإجابة: {cells}.",
        both: "الخلايا التي تحدث فيها هذه الظواهر معًا تشكّل نمطًا، وليست دليلًا على أن إحداها تسبب الأخرى.", change: "ارتفع أو انخفض يعني أن مستوى الصوت تغيّر بين التاريخين.",
      },
      prompt: {
        "pick-higher": "استمع إلى الخليتين أ وب. أيهما أعلى في مستوى {phen}؟",
        "find-max": "اعثر على خلية في أعلى مستوى من {phen}.", "find-max-restrict": "من بين الخلايا المظلّلة، اعثر على خلية في أعلى مستوى من {phen}.",
        "mark-set": "علّم كل خلية فيها {rule}.", direction: "يُظهر السهم إلى أين تهبّ الرياح عند {id}. من أي اتجاه تأتي؟",
      },
      rules: {
        "dust:3": "غبار مرتفع", "rain:1": "مطر قابل للقياس (0.1 ملم/س أو أكثر)", "rain:2": "مطر متوسط أو أشد", "rain:3": "مطر غزير", "wind:2": "رياح متوسطة أو أقوى", "wind:3": "رياح قوية", west: "رياح من الغرب",
        rose: "{phen} ارتفع", fell: "{phen} انخفض", and: " و", bothPrefix: "كلاهما معًا: ", allPrefix: "كلها معًا: ", dateSuffix: " في التاريخ الثاني", change: "{phen} ارتفع بين التاريخين",
      },
      hints: {
        1: { "mark-set": "استمع إلى خلايا كثيرة وقارن. القاعدة عن مستوى الصوت: منخفض أو متوسط أو مرتفع.", "find-max": "قارن مستوى الصوت في بعض الخلايا؛ أعلى مستوى هو أقوى تسجيل.", "pick-higher": "استمع إلى الاثنتين ثم قارن مستوى صوتيهما.", direction: "السهم يشير إلى وجهة الرياح. والاتجاه الذي تأتي منه هو المعاكس." },
        2: { region: "ابحث في الجزء {ns} {ew} من الخريطة.", higher: "الأعلى هي {which}.", from: "تأتي الرياح من {from}." },
        3: { cell: "الخلية {id} جزء من الإجابة." },
      },
      ns: { north: "الشمالي", south: "الجنوبي" }, ew: { west: "الغربي", east: "الشرقي" },
    },
    result: {
      title: "اكتملت المرحلة {n}", score: "نتيجة المرحلة", best: "أفضل نتيجة", total: "المجموع", points: "{earned}/{points}", wrong: "{n} محاولات خاطئة", hints: "{n} تلميحات", shown: "أُظهرت الإجابة", perfect: "مرحلة مثالية.", improved: "نتيجة قياسية جديدة!",
      next: "المرحلة التالية", replay: "أعد هذه المرحلة", levels: "كل المراحل", finish: "شاهد جائزتي", review: "راجع البيانات", reviewNote: "بعد انتهاء المرحلة تظهر القيم الحقيقية. الألوان تتبع مقياس البيانات؛ اختر خلية لتقرأ قيمتها.",
      value: "القيمة", layer: "الطبقة", unit: { dust: "بلا وحدة (العمق البصري للغبار)", rain: "ملم/س", wind: "م/ث" }, direction: "الرياح من {dir}", missing: "لا توجد بيانات لهذه الخلية", legendLow: "منخفض", legendHigh: "مرتفع",
      objectives: "الأهداف", unlocked: "فُتحت المرحلة {n}.", types: { "pick-higher": "قارن بين خليتين", "find-max": "اعثر على أعلى مستوى", "mark-set": "علّم الخلايا المطابقة", direction: "اقرأ اتجاه الرياح" },
    },
    award: {
      title: "سيّد الأرض", congrats: "تهانينا، {name}!", text: "أكملت مراحل فك الشيفرة الخمس.", score: "النتيجة النهائية {score} من 500", certificate: "EarthPulse · سيّد الأرض", team: "فريق Vanguard",
      disclaimer: "ليست شهادة رسمية من ناسا", download: "نزّل الشهادة (PNG)", replay: "أعد مرحلة", explore: "اذهب إلى استكشف الأرض", summary: "مراحلك", levelLine: "المرحلة {n} · {name}: {score}/100", fileName: "earthpulse-earth-master",
      certText: "أكمل {name} مراحل فك الشيفرة الخمس بنتيجة {score} من 500 نقطة.", date: "أُنجزت في {date}", back: "العودة إلى المراحل",
    },
    ach: { "level-1": "اكتمل اكتشاف الغبار", "level-2": "اكتمل مستكشف الأمطار", "level-3": "اكتمل محقق الرياح", "level-4": "اكتمل محقق أنماط الأرض", "level-5": "اكتمل سيّد الأرض", "no-hints": "مرحلة بلا تلميحات", "perfect-level": "مرحلة مثالية", "earth-master": "سيّد الأرض" },
    errors: { load: "تعذّر تحميل البيانات.", retry: "حاول مرة أخرى", loading: "جارٍ تحميل البيانات والصوت…" },
    compass: compassAr,
    credit: "البيانات: NASA GMAO GEOS-FP (مخرجات نموذج وليست قياسات). صور الأرض: مرصد الأرض التابع لناسا، Blue Marble. EARTHPULSE مشروع طلابي ولا تتبنّاه ناسا.",
  },
};

/** Words for a mark-set rule built from the objective's terms (see levels.js). */
export function describeRule(language, objective, phenLabel) {
  const r = gameCopy[language].play.rules;
  const parts = objective.where.map((t) => {
    if (t.sector) return r.west;
    if (t.rose) return r.rose.replace("{phen}", phenLabel(t.phen));
    if (t.fell) return r.fell.replace("{phen}", phenLabel(t.phen));
    return r[`${t.phen}:${t.atLeast}`];
  });
  if (objective.change) return parts[0];
  if (parts.length === 1) return parts[0];
  return (parts.length > 2 ? r.allPrefix : r.bothPrefix) + parts.join(r.and);
}
