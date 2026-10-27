/* Extra original topic-drill questions. These are not part of a timed paper;
   they fill gaps in the starter bank so every exam has something to practise
   in each major topic. */

window.PRACTICE_BANK = [
  {
    id: "uceed-visual-1",
    examId: "uceed",
    type: "MCQ",
    topic: "Visual Reasoning",
    difficulty: "Easy",
    marks: 3,
    negative: 0.71,
    prompt: "Which Gestalt principle explains why a closed shape is perceived as a whole rather than as separate lines?",
    options: [
      { id: "A", text: "Closure" },
      { id: "B", text: "Perspective" },
      { id: "C", text: "Texture" },
      { id: "D", text: "Scale" }
    ],
    correctAnswer: "A",
    solution: "Closure is the tendency to complete a familiar figure even when its outline is incomplete."
  },
  {
    id: "uceed-visual-2",
    examId: "uceed",
    type: "MSQ",
    topic: "Visual Reasoning",
    difficulty: "Medium",
    marks: 4,
    negative: 1,
    prompt: "Which of these are Gestalt principles of perceptual grouping?",
    options: [
      { id: "A", text: "Proximity" },
      { id: "B", text: "Similarity" },
      { id: "C", text: "Closure" },
      { id: "D", text: "Perspective" }
    ],
    correctAnswer: ["A", "B", "C"],
    solution: "Proximity, similarity, and closure are Gestalt grouping principles. Perspective is a depth cue, not a grouping principle."
  },
  {
    id: "uceed-gk-1",
    examId: "uceed",
    type: "MCQ",
    topic: "General Knowledge",
    difficulty: "Easy",
    marks: 3,
    negative: 0.71,
    prompt: "Which city is home to the main campus of the National Institute of Design (NID)?",
    options: [
      { id: "A", text: "Ahmedabad" },
      { id: "B", text: "Mumbai" },
      { id: "C", text: "Bengaluru" },
      { id: "D", text: "New Delhi" }
    ],
    correctAnswer: "A",
    solution: "NID was established in Ahmedabad in 1961. It now has additional campuses in other cities."
  },
  {
    id: "uceed-observe-1",
    examId: "uceed",
    type: "NAT",
    topic: "Observation",
    difficulty: "Medium",
    marks: 4,
    negative: 0,
    prompt: "A 2 × 2 grid of unit squares has both diagonals drawn in the large square. How many triangles of any size are formed?",
    correctAnswer: 8,
    tolerance: 0,
    solution: "The two diagonals create four small triangles in the centre. The four corner halves created by each diagonal give four more, for eight triangles."
  },
  {
    id: "uceed-lang-1",
    examId: "uceed",
    type: "MCQ",
    topic: "Language",
    difficulty: "Easy",
    marks: 3,
    negative: 0.71,
    prompt: "Choose the correctly spelled word.",
    options: [
      { id: "A", text: "Accomodate" },
      { id: "B", text: "Acommodate" },
      { id: "C", text: "Accommodate" },
      { id: "D", text: "Accommadate" }
    ],
    correctAnswer: "C",
    solution: "Accommodate has two c's and two m's."
  },
  {
    id: "uceed-history-1",
    examId: "uceed",
    type: "MCQ",
    topic: "Design History",
    difficulty: "Medium",
    marks: 3,
    negative: 0.71,
    prompt: "The Bauhaus school was founded in which German city in 1919?",
    options: [
      { id: "A", text: "Berlin" },
      { id: "B", text: "Weimar" },
      { id: "C", text: "Munich" },
      { id: "D", text: "Hamburg" }
    ],
    correctAnswer: "B",
    solution: "Walter Gropius founded the Bauhaus in Weimar in 1919. It later moved to Dessau and Berlin."
  },
  {
    id: "uceed-english-1",
    examId: "uceed",
    type: "MCQ",
    topic: "English",
    difficulty: "Medium",
    marks: 3,
    negative: 0.71,
    prompt: "Which sentence uses the semicolon correctly?",
    options: [
      { id: "A", text: "The poster was clear; and the type was readable." },
      { id: "B", text: "The poster was clear; the type was readable." },
      { id: "C", text: "The poster was clear; because the type was readable." },
      { id: "D", text: "The poster; was clear and the type was readable." }
    ],
    correctAnswer: "B",
    solution: "A semicolon can join two independent clauses without a conjunction. The other options misuse it."
  },
  {
    id: "uceed-design-1",
    examId: "uceed",
    type: "MSQ",
    topic: "Design Awareness",
    difficulty: "Medium",
    marks: 4,
    negative: 1,
    prompt: "Which of these are examples of inclusive design?",
    options: [
      { id: "A", text: "A ramp beside a stepped entrance" },
      { id: "B", text: "A control with a tactile label" },
      { id: "C", text: "A door that needs a key to open from inside" },
      { id: "D", text: "A website that works with a screen reader" }
    ],
    correctAnswer: ["A", "B", "D"],
    solution: "Ramps, tactile labels, and screen-reader support reduce barriers. A door that traps users inside is the opposite of inclusive design."
  },

  {
    id: "ceed-observe-1",
    examId: "ceed",
    type: "MCQ",
    topic: "Observation",
    difficulty: "Easy",
    marks: 3,
    negative: 0.5,
    prompt: "A four-legged chair wobbles on a flat floor. Which is the most likely cause?",
    options: [
      { id: "A", text: "The seat is too wide" },
      { id: "B", text: "One leg is shorter than the others" },
      { id: "C", text: "The backrest is too tall" },
      { id: "D", text: "The wood has a dark finish" }
    ],
    correctAnswer: "B",
    solution: "A chair needs all four feet to meet the floor. A shorter leg breaks that support and causes wobble."
  },
  {
    id: "ceed-gk-1",
    examId: "ceed",
    type: "MCQ",
    topic: "General Knowledge",
    difficulty: "Easy",
    marks: 3,
    negative: 0.5,
    prompt: "Which of these is a design school located in Ahmedabad?",
    options: [
      { id: "A", text: "NID" },
      { id: "B", text: "NIFT Delhi" },
      { id: "C", text: "Srishti Manipal" },
      { id: "D", text: "JJ School of Art" }
    ],
    correctAnswer: "A",
    solution: "The National Institute of Design was founded in Ahmedabad. NIFT Delhi, Srishti, and JJ School are elsewhere."
  },
  {
    id: "ceed-culture-1",
    examId: "ceed",
    type: "MCQ",
    topic: "Indian Culture",
    difficulty: "Medium",
    marks: 3,
    negative: 0.5,
    prompt: "Which textile tradition is associated with block printing in Rajasthan?",
    options: [
      { id: "A", text: "Bagru" },
      { id: "B", text: "Kanjivaram" },
      { id: "C", text: "Pashmina" },
      { id: "D", text: "Bandhani" }
    ],
    correctAnswer: "A",
    solution: "Bagru is a well-known Rajasthan block-printing tradition. Kanjivaram is a silk-weaving style; bandhani is tie-dye."
  },
  {
    id: "ceed-history-1",
    examId: "ceed",
    type: "MCQ",
    topic: "Design History",
    difficulty: "Medium",
    marks: 3,
    negative: 0.5,
    prompt: "Who designed the Barcelona chair?",
    options: [
      { id: "A", text: "Ludwig Mies van der Rohe" },
      { id: "B", text: "Charles Eames" },
      { id: "C", text: "Le Corbusier" },
      { id: "D", text: "Alvar Aalto" }
    ],
    correctAnswer: "A",
    solution: "Mies van der Rohe designed the Barcelona chair with Lilly Reich for the 1929 Barcelona Pavilion."
  },
  {
    id: "ceed-lang-1",
    examId: "ceed",
    type: "MCQ",
    topic: "Language",
    difficulty: "Medium",
    marks: 3,
    negative: 0.5,
    prompt: "Which sentence is the most concise and clear?",
    options: [
      { id: "A", text: "Due to the fact that the budget was low, we simplified the design." },
      { id: "B", text: "Because the budget was low, we simplified the design." },
      { id: "C", text: "In view of the fact of the budget being low, the design was simplified by us." },
      { id: "D", text: "The design was simplified on account of the fact that the budget was low." }
    ],
    correctAnswer: "B",
    solution: "“Because” replaces wordy phrases such as “due to the fact that” and keeps the sentence direct."
  },
  {
    id: "ceed-observe-2",
    examId: "ceed",
    type: "MSQ",
    topic: "Observation",
    difficulty: "Medium",
    marks: 4,
    negative: 1,
    prompt: "A public sign is hard to read from a distance. Which factors could be responsible?",
    options: [
      { id: "A", text: "Low contrast between text and background" },
      { id: "B", text: "Small letter height" },
      { id: "C", text: "Too much visual clutter around the sign" },
      { id: "D", text: "Using a consistent typeface" }
    ],
    correctAnswer: ["A", "B", "C"],
    solution: "Contrast, letter size, and clutter all affect legibility. Consistency in the typeface is generally helpful, not harmful."
  },

  {
    id: "ceed-pattern-1",
    examId: "ceed",
    type: "MCQ",
    topic: "Pattern Recognition",
    difficulty: "Easy",
    marks: 3,
    negative: 0.5,
    prompt: "Complete the pattern: 1, 4, 9, 16, ?",
    options: [
      { id: "A", text: "20" },
      { id: "B", text: "24" },
      { id: "C", text: "25" },
      { id: "D", text: "36" }
    ],
    correctAnswer: "C",
    solution: "The terms are perfect squares: 1², 2², 3², 4², so the next is 5² = 25."
  },

  {
    id: "nift-lang-1",
    examId: "nift",
    type: "MCQ",
    topic: "Language",
    difficulty: "Easy",
    marks: 1,
    negative: 0.25,
    prompt: "Choose the synonym of “arduous”.",
    options: [
      { id: "A", text: "Easy" },
      { id: "B", text: "Difficult" },
      { id: "C", text: "Brief" },
      { id: "D", text: "Colourful" }
    ],
    correctAnswer: "B",
    solution: "Arduous means requiring great effort; difficult is the closest option."
  },
  {
    id: "nift-num-1",
    examId: "nift",
    type: "MCQ",
    topic: "Numerical Reasoning",
    difficulty: "Medium",
    marks: 1,
    negative: 0.25,
    prompt: "A dress costs ₹1,200. A 10% discount is applied, then 5% GST is added to the discounted price. What is the final price?",
    options: [
      { id: "A", text: "₹1,080" },
      { id: "B", text: "₹1,134" },
      { id: "C", text: "₹1,140" },
      { id: "D", text: "₹1,260" }
    ],
    correctAnswer: "B",
    solution: "After the 10% discount the price is ₹1,080. Adding 5% gives ₹1,080 × 1.05 = ₹1,134."
  },
  {
    id: "nift-maths-1",
    examId: "nift",
    type: "MCQ",
    topic: "Maths",
    difficulty: "Easy",
    marks: 1,
    negative: 0.25,
    prompt: "What is the area of a triangle with base 8 cm and height 5 cm?",
    options: [
      { id: "A", text: "13 cm²" },
      { id: "B", text: "20 cm²" },
      { id: "C", text: "40 cm²" },
      { id: "D", text: "80 cm²" }
    ],
    correctAnswer: "B",
    solution: "Area = 1/2 × base × height = 1/2 × 8 × 5 = 20 cm²."
  },
  {
    id: "nift-spatial-1",
    examId: "nift",
    type: "MCQ",
    topic: "Spatial Reasoning",
    difficulty: "Easy",
    marks: 1,
    negative: 0.25,
    prompt: "How many faces does a rectangular box have?",
    options: [
      { id: "A", text: "4" },
      { id: "B", text: "6" },
      { id: "C", text: "8" },
      { id: "D", text: "12" }
    ],
    correctAnswer: "B",
    solution: "A rectangular box is a cuboid: it has 6 faces, 12 edges, and 8 vertices."
  },
  {
    id: "nift-design-1",
    examId: "nift",
    type: "MCQ",
    topic: "Design Awareness",
    difficulty: "Easy",
    marks: 1,
    negative: 0.25,
    prompt: "Which of these is a warm colour?",
    options: [
      { id: "A", text: "Blue" },
      { id: "B", text: "Green" },
      { id: "C", text: "Orange" },
      { id: "D", text: "Violet" }
    ],
    correctAnswer: "C",
    solution: "Orange is a warm colour, along with red and yellow."
  },
  {
    id: "nift-visual-1",
    examId: "nift",
    type: "MCQ",
    topic: "Visual Reasoning",
    difficulty: "Easy",
    marks: 1,
    negative: 0.25,
    prompt: "Which shape has the most lines of symmetry?",
    options: [
      { id: "A", text: "Scalene triangle" },
      { id: "B", text: "Rectangle" },
      { id: "C", text: "Square" },
      { id: "D", text: "Parallelogram" }
    ],
    correctAnswer: "C",
    solution: "A square has four lines of symmetry. A rectangle has two; a scalene triangle and a general parallelogram have none."
  },
  {
    id: "nift-materials-1",
    examId: "nift",
    type: "MCQ",
    topic: "Materials",
    difficulty: "Easy",
    marks: 1,
    negative: 0.25,
    prompt: "Which fibre comes from a sheep?",
    options: [
      { id: "A", text: "Cotton" },
      { id: "B", text: "Wool" },
      { id: "C", text: "Linen" },
      { id: "D", text: "Jute" }
    ],
    correctAnswer: "B",
    solution: "Wool is an animal fibre obtained from sheep and other animals. Cotton, linen, and jute are plant fibres."
  },
  {
    id: "nift-history-1",
    examId: "nift",
    type: "MCQ",
    topic: "Design History",
    difficulty: "Medium",
    marks: 1,
    negative: 0.25,
    prompt: "Which movement is closely associated with the phrase “form follows function”?",
    options: [
      { id: "A", text: "Art Nouveau" },
      { id: "B", text: "Modernism" },
      { id: "C", text: "Baroque" },
      { id: "D", text: "Rococo" }
    ],
    correctAnswer: "B",
    solution: "The phrase is associated with modern architecture and design, especially Louis Sullivan and the Bauhaus tradition."
  },

  {
    id: "nid-gk-1",
    examId: "nid",
    type: "MCQ",
    topic: "General Knowledge",
    difficulty: "Easy",
    marks: 1,
    negative: 0,
    prompt: "Which Indian city is home to the main campus of NID?",
    options: [
      { id: "A", text: "Ahmedabad" },
      { id: "B", text: "Pune" },
      { id: "C", text: "Chennai" },
      { id: "D", text: "Kolkata" }
    ],
    correctAnswer: "A",
    solution: "NID's main campus is in Ahmedabad, Gujarat."
  },
  {
    id: "nid-logic-1",
    examId: "nid",
    type: "MCQ",
    topic: "Analytical Reasoning",
    difficulty: "Medium",
    marks: 2,
    negative: 0,
    prompt: "All designers are observers. Some observers are illustrators. Which statement must be true?",
    options: [
      { id: "A", text: "All designers are illustrators." },
      { id: "B", text: "Some designers are illustrators." },
      { id: "C", text: "All designers are observers." },
      { id: "D", text: "No observer is a designer." }
    ],
    correctAnswer: "C",
    solution: "The first premise states directly that all designers are observers. The illustrator overlap is not enough to conclude anything about designers."
  },
  {
    id: "nid-culture-1",
    examId: "nid",
    type: "MCQ",
    topic: "Indian Culture",
    difficulty: "Easy",
    marks: 1,
    negative: 0,
    prompt: "Which classical dance form originated in Kerala?",
    options: [
      { id: "A", text: "Bharatanatyam" },
      { id: "B", text: "Kathakali" },
      { id: "C", text: "Odissi" },
      { id: "D", text: "Manipuri" }
    ],
    correctAnswer: "B",
    solution: "Kathakali is a classical dance-drama tradition from Kerala. Bharatanatyam is from Tamil Nadu; Odissi from Odisha; Manipuri from Manipur."
  },
  {
    id: "nid-num-1",
    examId: "nid",
    type: "MCQ",
    topic: "Numerical Reasoning",
    difficulty: "Medium",
    marks: 2,
    negative: 0,
    prompt: "How many squares of any size are present in a 2 × 2 grid?",
    options: [
      { id: "A", text: "4" },
      { id: "B", text: "5" },
      { id: "C", text: "6" },
      { id: "D", text: "8" }
    ],
    correctAnswer: "B",
    solution: "There are four unit squares and one larger 2 × 2 square, giving five squares."
  },
  {
    id: "nid-spatial-2",
    examId: "nid",
    type: "MCQ",
    topic: "Spatial Reasoning",
    difficulty: "Medium",
    marks: 2,
    negative: 0,
    prompt: "How many edges does a cube have?",
    options: [
      { id: "A", text: "6" },
      { id: "B", text: "8" },
      { id: "C", text: "12" },
      { id: "D", text: "16" }
    ],
    correctAnswer: "C",
    solution: "A cube has 12 edges: four on the top face, four on the bottom, and four vertical edges."
  },
  {
    id: "nid-pattern-1",
    examId: "nid",
    type: "MCQ",
    topic: "Pattern Recognition",
    difficulty: "Easy",
    marks: 1,
    negative: 0,
    prompt: "Which sequence follows a Fibonacci-style rule?",
    options: [
      { id: "A", text: "2, 4, 6, 8, 10" },
      { id: "B", text: "1, 1, 2, 3, 5, 8" },
      { id: "C", text: "3, 6, 12, 24, 48" },
      { id: "D", text: "1, 4, 9, 16, 25" }
    ],
    correctAnswer: "B",
    solution: "Each term after the first two is the sum of the two before it: 1 + 1 = 2, 1 + 2 = 3, and so on."
  }
];
