/* Exam catalog and reference blueprints for the Dexam Mock Test app.

   The topic shares below are reference weightings taken from the public
   Roughworks syllabus/topic analysis. They are product metadata, not question
   text. The starter papers in data.js are original content written for this
   prototype. */

window.EXAM_CATALOG = [
  {
    id: "uceed",
    name: "UCEED",
    fullName: "Undergraduate Common Entrance Examination for Design",
    level: "Undergraduate",
    audience: "Class 12 students and gap-year aspirants",
    tagline: "Observation, spatial thinking, visual logic, and design awareness.",
    description:
      "The largest design-entrance audience. UCEED rewards fast visual judgement, spatial reasoning, observation, and a working awareness of design, culture, and materials.",
    officialPattern: "57 questions · 3 sections · 200 marks · 180 minutes",
    referencePapers: 12,
    referenceQuestions: 878,
    years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    officialSections: [
      { type: "NAT", label: "Numerical Answer", questions: 14, marks: 4, negative: 0, note: "+4 correct · 0 wrong" },
      { type: "MSQ", label: "Multiple Select", questions: 15, marks: 4, negative: 1, note: "+4 all correct · +1 partial · −1 wrong" },
      { type: "MCQ", label: "Multiple Choice", questions: 28, marks: 3, negative: 0.71, note: "+3 correct · −0.71 wrong" }
    ],
    topics: [
      { name: "Spatial Reasoning", share: 23.5 },
      { name: "Visual Reasoning", share: 14.5 },
      { name: "Analytical Reasoning", share: 12.9 },
      { name: "Pattern Recognition", share: 9.2 },
      { name: "Design Awareness", share: 7.9 },
      { name: "Numerical Reasoning", share: 6.6 },
      { name: "General Knowledge", share: 5.7 },
      { name: "Observation", share: 5.2 },
      { name: "Language", share: 3.6 },
      { name: "Indian Culture", share: 3.3 },
      { name: "Typography", share: 3.0 },
      { name: "Design History", share: 1.5 },
      { name: "Colour Theory", share: 1.4 },
      { name: "English", share: 0.9 },
      { name: "Materials", share: 0.9 }
    ]
  },
  {
    id: "ceed",
    name: "CEED",
    fullName: "Common Entrance Examination for Design",
    level: "Postgraduate",
    audience: "Graduates and final-year students",
    tagline: "Design aptitude for postgraduate design study.",
    description:
      "CEED is a smaller, more specialist audience. The paper leans on spatial and visual reasoning, design awareness, analytical thinking, and communication.",
    officialPattern: "44 questions · 3 sections · 150 marks · 180 minutes",
    referencePapers: 9,
    referenceQuestions: 382,
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    officialSections: [
      { type: "NAT", label: "Numerical Answer", questions: 8, marks: 4, negative: 0, note: "+4 correct · 0 wrong" },
      { type: "MSQ", label: "Multiple Select", questions: 10, marks: 4, negative: 1, note: "+4 all correct · +1 partial · −1 wrong" },
      { type: "MCQ", label: "Multiple Choice", questions: 26, marks: 3, negative: 0.5, note: "+3 correct · −0.5 wrong" }
    ],
    topics: [
      { name: "Spatial Reasoning", share: 27.5 },
      { name: "Design Awareness", share: 17.8 },
      { name: "Visual Reasoning", share: 12.3 },
      { name: "Analytical Reasoning", share: 11.0 },
      { name: "Pattern Recognition", share: 7.6 },
      { name: "Numerical Reasoning", share: 6.5 },
      { name: "Observation", share: 3.7 },
      { name: "Typography", share: 3.1 },
      { name: "General Knowledge", share: 2.4 },
      { name: "Indian Culture", share: 2.4 },
      { name: "Design History", share: 2.1 },
      { name: "Language", share: 1.8 },
      { name: "Materials", share: 1.3 },
      { name: "Colour Theory", share: 0.5 }
    ]
  },
  {
    id: "nift",
    name: "NIFT",
    fullName: "National Institute of Fashion Technology Entrance Examination",
    level: "Undergraduate",
    audience: "Class 12 students targeting fashion and textile design",
    tagline: "English, quantitative ability, logic, and current awareness.",
    description:
      "NIFT uses a broad, speed-based paper. English and quantitative ability carry a large share, with analytical reasoning, general knowledge, and fashion awareness close behind.",
    officialPattern: "100 questions · 4 sections · 100 marks · 120 minutes",
    referencePapers: 4,
    referenceQuestions: 400,
    years: [2022, 2024, 2025, 2026],
    officialSections: [
      { type: "MCQ", label: "Communication Ability & English", questions: 30, marks: 1, negative: 0.25, note: "+1 correct · −0.25 wrong" },
      { type: "MCQ", label: "Quantitative Ability", questions: 20, marks: 1, negative: 0.25, note: "+1 correct · −0.25 wrong" },
      { type: "MCQ", label: "Analytical & Logical Ability", questions: 25, marks: 1, negative: 0.25, note: "+1 correct · −0.25 wrong" },
      { type: "MCQ", label: "General Knowledge & Current Affairs", questions: 25, marks: 1, negative: 0.25, note: "+1 correct · −0.25 wrong" }
    ],
    topics: [
      { name: "English", share: 33.0 },
      { name: "Quantitative Aptitude", share: 15.0 },
      { name: "General Knowledge", share: 13.8 },
      { name: "Language", share: 9.8 },
      { name: "Analytical Reasoning", share: 6.3 },
      { name: "Pattern Recognition", share: 4.8 },
      { name: "Indian Culture", share: 4.0 },
      { name: "Numerical Reasoning", share: 4.0 },
      { name: "Fashion & Textile", share: 2.8 },
      { name: "Maths", share: 2.0 },
      { name: "Spatial Reasoning", share: 1.5 },
      { name: "Design Awareness", share: 1.3 },
      { name: "Visual Reasoning", share: 1.0 },
      { name: "Materials", share: 0.5 },
      { name: "Colour Theory", share: 0.3 },
      { name: "Design History", share: 0.3 }
    ]
  },
  {
    id: "nid",
    name: "NID UG",
    fullName: "National Institute of Design Undergraduate Entrance",
    level: "Undergraduate",
    audience: "Class 12 students targeting NID B.Des",
    tagline: "Design awareness, observation, and analytical thinking.",
    description:
      "The NID UG sample is small, which makes focused practice valuable. The paper rewards design awareness, observation, analytical reasoning, and cultural knowledge.",
    officialPattern: "8 questions · Part A · 10 marks · 30 minutes",
    referencePapers: 2,
    referenceQuestions: 29,
    years: [2020, 2024],
    officialSections: [
      { type: "MCQ", label: "Part A · 1 mark", questions: 6, marks: 1, negative: 0, note: "+1 correct · 0 wrong" },
      { type: "MCQ", label: "Part A · 2 marks", questions: 2, marks: 2, negative: 0, note: "+2 correct · 0 wrong" }
    ],
    topics: [
      { name: "General Knowledge", share: 31.0 },
      { name: "Analytical Reasoning", share: 17.2 },
      { name: "Design Awareness", share: 13.8 },
      { name: "Spatial Reasoning", share: 13.8 },
      { name: "Pattern Recognition", share: 10.3 },
      { name: "Indian Culture", share: 6.9 },
      { name: "Colour Theory", share: 3.4 },
      { name: "Numerical Reasoning", share: 3.4 }
    ]
  }
];

window.EXAM_BY_ID = window.EXAM_CATALOG.reduce(function (map, exam) {
  map[exam.id] = exam;
  return map;
}, {});
