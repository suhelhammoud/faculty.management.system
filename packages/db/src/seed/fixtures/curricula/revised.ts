// new.pdf, pages 3, 5 and 7. Each entry represents one semester, in study-year order.
const firstYear = [
  `
تحليل رياضي|Mathematical Analysis|2|0
جبر خطي|Linear Algebra|2|0
مقدمة إلى علوم الحاسب|Introduction to Computer Science
برمجة (1)|Programming I
منطق رياضي|Mathematical Logic
لغة إنكليزية (1)|English I|2|0
لغة عربية|Arabic Language|2|0
`,
  `
تحليل عددي|Numerical Analysis
الدارات المنطقية|Logic Circuits
إحصاء واحتمالات|Statistics and Probability
برمجة (2)|Programming II
تطبيقات حاسوبية|Computer Applications
لغة إنكليزية (2)|English II|2|0
ثقافة وطنية|National Culture|2|0
`,
] as const;

const softwareSecondYear = [
  `
رياضيات متقطعة|Discrete Mathematics
قواعد بيانات (1)|Databases I
خوارزميات وبنى المعطيات (1)|Algorithms and Data Structures I
برمجة متقدمة (1)|Advanced Programming I
برمجة ويب (1)|Web Programming I
لغة إنكليزية تخصصية (1)|Technical English I|2|0
`,
  `
بنيان الحواسيب|Computer Architecture
قواعد بيانات (2)|Databases II
خوارزميات وبنى المعطيات (2)|Algorithms and Data Structures II
برمجة متقدمة (2)|Advanced Programming II
برمجة ويب (2)|Web Programming II
لغة إنكليزية تخصصية (2)|Technical English II|2|0
`,
] as const;

export const revisedCurricula = {
  'software-engineering': [
    ...firstYear,
    ...softwareSecondYear,
    `
بحوث العمليات|Operations Research
مقدمة في الذكاء الاصطناعي|Introduction to Artificial Intelligence
أوتومات ولغات صورية|Automata and Formal Languages
نظم التشغيل (1)|Operating Systems I
هندسة البرمجيات|Software Engineering
تصميم واجهات المستخدم|User Interface Design
`,
    `
تحليل البيانات|Data Analysis
تعلم الآلة|Machine Learning
نظم التشغيل (2)|Operating Systems II
الشبكات الحاسوبية|Computer Networks
تصميم البرمجيات|Software Design
المترجمات|Compilers
`,
    `
علوم البيانات|Data Science
لغات البرمجة|Programming Languages
تحليل وتصميم النظم|Systems Analysis and Design
رسوميات الحاسب|Computer Graphics
أخلاقيات الحاسوب|Computer Ethics
هندسة الويب|Web Engineering
`,
    `
تنقيب في البيانات|Data Mining
المعماريات البرمجية|Software Architecture
نمذجة ومحاكاة|Modeling and Simulation
تطبيقات الموبايل|Mobile Applications
برمجة تفرعية|Concurrent Programming
أمن المعلومات|Information Security
`,
    `
البيانات الضخمة|Big Data
اختبار البرمجيات|Software Testing
أمن البرمجيات|Software Security
إدارة مشاريع|Project Management
مشروع تخرج|Graduation Project|0|4|capstone
`,
    `
برمجة الألعاب|Game Programming
الحوسبة السحابية|Cloud Computing
صيانة البرمجيات|Software Maintenance
النظم الموزعة|Distributed Systems
مشروع تخرج|Graduation Project|0|4|capstone
`,
  ],
  'network-systems': [
    `
تحليل رياضي|Mathematical Analysis|2|0
جبر خطي|Linear Algebra|2|0
مهارات حاسوبية (1)|Computer Skills I
برمجة (1)|Programming I
الدارات الإلكترونية|Electronic Circuits|2|0
لغة إنكليزية (1)|English I|2|0
لغة عربية|Arabic Language|2|0
`,
    `
إحصاء واحتمالات|Statistics and Probability
منطق رياضي|Mathematical Logic
الدارات المنطقية|Logic Circuits
برمجة (2)|Programming II
مهارات حاسوبية (2)|Computer Skills II
لغة إنكليزية (2)|English II|2|0
ثقافة وطنية|National Culture|2|0
`,
    `
الاتصالات الرقمية|Digital Communications|2|0
قواعد بيانات|Databases
خوارزميات وبنى المعطيات (1)|Algorithms and Data Structures I
برمجة متقدمة (1)|Advanced Programming I
برمجة ويب (1)|Web Programming I
بنيان الحواسيب (1)|Computer Architecture I
`,
    `
رياضيات متقطعة|Discrete Mathematics
خوارزميات وبنى المعطيات (2)|Algorithms and Data Structures II
برمجة ويب (2)|Web Programming II
برمجة متقدمة (2)|Advanced Programming II
بنيان الحواسيب (2)|Computer Architecture II
لغة إنكليزية تخصصية (1)|Technical English I
`,
    `
الشبكات الحاسوبية (1)|Computer Networks I
نظم التشغيل (1)|Operating Systems I
هندسة البرمجيات|Software Engineering
أوتومات ولغات صورية|Automata and Formal Languages
الذكاء الاصطناعي (1)|Artificial Intelligence I
لغة إنكليزية تخصصية (2)|Technical English II|2|0
`,
    `
نظرية المعلومات|Information Theory
نظم التشغيل (2)|Operating Systems II
الشبكات الحاسوبية (2)|Computer Networks II
نمذجة ومحاكاة|Modeling and Simulation
الذكاء الاصطناعي (2)|Artificial Intelligence II
تطبيقات الموبايل|Mobile Applications
`,
    `
نظم الوسائط المتعددة|Multimedia Systems
الشبكات اللاسلكية (1)|Wireless Networks I
نظم زمن حقيقي|Real-Time Systems
الشبكات الحاسوبية (3)|Computer Networks III
تنقيب في البيانات|Data Mining
`,
    `
برمجة تطبيقات شبكية|Network Application Programming
إدارة الشبكات (1)|Network Administration I
الشبكات اللاسلكية (2)|Wireless Networks II
برمجة تفرعية|Concurrent Programming
أمن المعلومات|Information Security
`,
    `
إدارة مشاريع|Project Management
النظم الموزعة|Distributed Systems
إدارة الشبكات (2)|Network Administration II
أمن الشبكات (1)|Network Security I
مشروع تخرج|Graduation Project|0|4|capstone
`,
    `
أمن الشبكات (2)|Network Security II
الحوسبة السحابية|Cloud Computing
تحليل وتصميم الشبكات الحاسوبية|Computer Network Analysis and Design
التطبيقات الموزعة|Distributed Applications
مشروع تخرج|Graduation Project|0|4|capstone
`,
  ],
  'artificial-intelligence': [
    ...firstYear,
    softwareSecondYear[0].replace(
      'قواعد بيانات (1)|Databases I',
      'قواعد بيانات (1)|Databases I|2|0',
    ),
    softwareSecondYear[1],
    `
تعلم الآلة (1)|Machine Learning I
مقدمة في الذكاء الاصطناعي|Introduction to Artificial Intelligence
هندسة البرمجيات|Software Engineering
بحوث العمليات (1)|Operations Research I
نظم التشغيل|Operating Systems
`,
    `
تعلم الآلة (2)|Machine Learning II
لغات البرمجة|Programming Languages
تحليل البيانات|Data Analysis
بحوث العمليات (2)|Operations Research II
الشبكات الحاسوبية|Computer Networks
`,
    `
رسوميات الحاسب|Computer Graphics
الشبكات العصبونية|Neural Networks
برمجة الذكاء الاصطناعي|Artificial Intelligence Programming
نظم الوسائط المتعددة|Multimedia Systems
أخلاقيات الحاسوب|Computer Ethics|2|0
`,
    `
التعلم العميق|Deep Learning
نمذجة ومحاكاة|Modeling and Simulation
تنقيب في البيانات|Data Mining
الخوارزميات الذكية|Intelligent Algorithms
أمن المعلومات|Information Security
الواقعية الافتراضية|Virtual Reality
`,
    `
التعلم المعزز|Reinforcement Learning
معالجة اللغات الطبيعية|Natural Language Processing
البيانات الضخمة|Big Data
إدارة مشاريع|Project Management
الرؤية الحاسوبية|Computer Vision
مشروع تخرج|Graduation Project|0|4|capstone
`,
    `
الروبوتية|Robotics
تطبيقات الذكاء الاصطناعي|Artificial Intelligence Applications
الأنظمة الذاتية|Autonomous Systems
الذكاء التوليدي|Generative AI
برمجة الألعاب|Game Programming
مشروع تخرج|Graduation Project|0|4|capstone
`,
  ],
} as const;
