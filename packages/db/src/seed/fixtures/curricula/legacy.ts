// old.pdf, page 1. Semester order follows the right-hand table, then the left-hand table.
export const legacyCommon = [
  `
دارات إلكترونية (1)|Electronic Circuits I
رياضيات (1)|Mathematics I
جبر بول ومبادئ المنطق|Boolean Algebra and Principles of Logic
مبادئ عمل الحواسيب (1)|Fundamentals of Computer Operation I|2|4
البرمجة (1)|Programming I|4|2
لغة إنكليزية (1)|English I|4|0|total
لغة عربية|Arabic Language|2|0|total
`,
  `
دارات إلكترونية (2)|Electronic Circuits II
رياضيات (2)|Mathematics II
تحليل عددي (1)|Numerical Analysis I
مبادئ عمل الحواسيب (2)|Fundamentals of Computer Operation II|2|4
البرمجة (2)|Programming II|4|2
لغة إنكليزية (2)|English II|4|0|total
الثقافة القومية الاشتراكية|Socialist National Culture|2|0|total
`,
  `
تحليل عددي (2)|Numerical Analysis II
برمجة متقدمة (1)|Advanced Programming I|4|2
دارات منطقية|Logic Circuits
برمجة الويب|Web Programming|2|4
الخوارزميات وبنى المعطيات (1)|Algorithms and Data Structures I|4|2
لغة إنكليزية (3)|English III|4|0|total
`,
  `
رياضيات متقطعة|Discrete Mathematics
احتمالات وإحصاء|Probability and Statistics
بنيان الحواسيب (1)|Computer Architecture I
تطبيقات الإنترنت|Internet Applications|2|4
الخوارزميات وبنى المعطيات (2)|Algorithms and Data Structures II|4|2
لغة إنكليزية (4)|English IV|4|0|total
`,
  `
بنيان الحواسيب (2)|Computer Architecture II
الأوتومات واللغات الصورية|Automata and Formal Languages|4|2
بحوث عمليات (1)|Operations Research I
قواعد المعطيات (1)|Databases I|2|4
نظرية المعلومات|Information Theory
هندسة البرمجيات (1)|Software Engineering I|4|2
`,
  `
اتصالات رقمية|Digital Communications
مترجمات|Compilers|4|2
بحوث عمليات (2)|Operations Research II
برمجة متقدمة (2)|Advanced Programming II|4|2
ذكاء صنعي|Artificial Intelligence|4|2
لغة إنكليزية تخصصية (1)|Technical English I
`,
] as const;

// old.pdf, pages 2–4. Each department has its own Years 4 and 5.
export const legacySpecializations = {
  'software-engineering': [
    `
نظم تشغيل (1)|Operating Systems I
الشبكات المعلوماتية (1)|Computer Networks I
الرسوم والحاسب|Computer Graphics
نظم الوسائط المتعددة|Multimedia Systems|4|2
قواعد المعطيات (2)|Databases II|4|2
النمذجة والمحاكاة|Modeling and Simulation
مشروع|Project|0|4|total
`,
    `
نظم تشغيل (2)|Operating Systems II
نظم المعلومات|Information Systems
هندسة البرمجيات (2)|Software Engineering II|4|2
لغة إنكليزية تخصصية (2)|Technical English II
لغات البرمجة|Programming Languages
برمجة تفرعية|Concurrent Programming
مشروع|Project|0|4|total
`,
    `
تجارة إلكترونية وتسويق|E-Commerce and Marketing
الروبوتية والرؤية الحاسوبية|Robotics and Computer Vision
هندسة البرمجيات (3)|Software Engineering III
لغة إنكليزية تخصصية (3)|Technical English III
بيوانفورماتيك|Bioinformatics
مشروع تخرج|Graduation Project|0|6|total
`,
    `
إدارة المشاريع|Project Management
نظم وتطبيقات موزعة|Distributed Systems and Applications
هندسة نظم المعلومات|Information Systems Engineering
أمن المعلومات|Information Security
قواعد المعطيات المعرفية|Knowledge Databases
مشروع تخرج|Graduation Project|0|6|total
`,
  ],
  'network-systems': [
    `
نظم تشغيل (1)|Operating Systems I
الشبكات المعلوماتية (1)|Computer Networks I
الرسوم والحاسب|Computer Graphics
نظم الوسائط المتعددة|Multimedia Systems|4|2
أمن المعلومات|Information Security
النمذجة والمحاكاة|Modeling and Simulation
مشروع|Project|0|4|total
`,
    `
نظم تشغيل (2)|Operating Systems II
الشبكات المعلوماتية (2)|Computer Networks II|4|2
إدارة الشبكات الحاسوبية|Computer Network Administration|4|2
لغة إنكليزية تخصصية (2)|Technical English II
تحليل وتصميم النظم الشبكية|Network Systems Analysis and Design
برمجة تفرعية|Concurrent Programming
مشروع|Project|0|4|total
`,
    `
تجارة إلكترونية وتسويق|E-Commerce and Marketing
الروبوتية والرؤية الحاسوبية|Robotics and Computer Vision
نظم الزمن الحقيقي|Real-Time Systems
لغة إنكليزية تخصصية (3)|Technical English III
الشبكات اللاسلكية|Wireless Networks
مشروع تخرج|Graduation Project|0|6|total
`,
    `
أمن الشبكات|Network Security
نظم وتطبيقات موزعة|Distributed Systems and Applications
هندسة نظم المعلومات|Information Systems Engineering
إدارة المشاريع|Project Management
قواعد المعطيات المعرفية|Knowledge Databases
مشروع تخرج|Graduation Project|0|6|total
`,
  ],
  'artificial-intelligence': [
    `
نظم التشغيل (1)|Operating Systems I
الشبكات المعلوماتية (1)|Computer Networks I
منطق الذكاء الصنعي|Logic for Artificial Intelligence|4|2
نظم الوسائط المتعددة|Multimedia Systems|4|2
الرسوم والحاسب|Computer Graphics
نمذجة ومحاكاة|Modeling and Simulation
مشروع|Project|0|4|total
`,
    `
البرمجة الشرطية|Conditional Programming
المنطق العائم|Fuzzy Logic
البرمجة المنطقية|Logic Programming|4|2
لغة إنكليزية تخصصية (2)|Technical English II
معالجة الصوت|Audio Processing
برمجة تفرعية|Concurrent Programming
مشروع|Project|0|4|total
`,
    `
التعليم الإلكتروني|E-Learning
الروبوتية والرؤية الحاسوبية|Robotics and Computer Vision
معالجة اللغات الطبيعية|Natural Language Processing
لغة إنكليزية تخصصية (3)|Technical English III
بيو انفورماتيك|Bioinformatics
مشروع تخرج|Graduation Project|0|6|total
`,
    `
الخوارزميات الذكية|Intelligent Algorithms
إدارة المشاريع|Project Management
الشبكات العصبونية|Neural Networks
أمن المعلومات|Information Security
قواعد معطيات معرفية|Knowledge Databases
مشروع تخرج|Graduation Project|0|6|total
`,
  ],
} as const;
