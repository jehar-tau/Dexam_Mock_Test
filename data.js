/* Original practice content for the Dexam Mock Test app.
   Every question below is written for this prototype. No Roughworks
   question text, answer, or explanation has been copied. */

window.MOCK_PAPERS = [
  {
    id: "foundation-1",
    examId: "uceed",
    examName: "UCEED",
    year: 2026,
    mode: "mini",
    title: "UCEED Foundation Mock",
    subtitle: "UCEED-style Part A · original practice paper",
    description:
      "A 60-minute mixed paper covering spatial reasoning, visual logic, design awareness, colour, typography, and sustainability.",
    durationMinutes: 60,
    totalMarks: 72,
    sections: [
      {
        id: "nat",
        title: "Section 1",
        label: "Numerical Answer",
        type: "NAT",
        marks: 4,
        negative: 0,
        instructions:
          "Enter a number. Correct = +4. Wrong or unattempted = 0.",
        questions: [
          {
            id: "f1-nat-1",
            type: "NAT",
            topic: "Spatial Reasoning",
            difficulty: "Medium",
            prompt:
              "A 4 × 4 × 4 cube is painted on all six faces and then cut into 64 unit cubes. How many unit cubes have exactly two painted faces?",
            correctAnswer: 24,
            tolerance: 0.01,
            solution:
              "Only cubes along the edges have exactly two painted faces. There are 12 edges, and each edge has 4 − 2 = 2 such cubes after removing the corners. 12 × 2 = 24."
          },
          {
            id: "f1-nat-2",
            type: "NAT",
            topic: "Numerical Reasoning",
            difficulty: "Easy",
            prompt:
              "A 12 cm × 8 cm rectangle has a uniform 1 cm border drawn inside it along all four edges. What is the area of the border, in square centimetres?",
            correctAnswer: 36,
            tolerance: 0.01,
            solution:
              "Outer area = 12 × 8 = 96 cm². Inner rectangle = (12 − 2) × (8 − 2) = 10 × 6 = 60 cm². Border area = 96 − 60 = 36 cm²."
          },
          {
            id: "f1-nat-3",
            type: "NAT",
            topic: "Analytical Reasoning",
            difficulty: "Easy",
            prompt: "What number comes next in the sequence? 2, 6, 12, 20, 30, ___",
            correctAnswer: 42,
            tolerance: 0.01,
            solution:
              "The differences are 4, 6, 8, 10, so the next difference is 12. 30 + 12 = 42. The terms are n(n + 1) for n = 1, 2, 3, …"
          },
          {
            id: "f1-nat-4",
            type: "NAT",
            topic: "Spatial Reasoning",
            difficulty: "Medium",
            prompt:
              "How many rectangles of any size can be formed by the grid lines of a 5-column × 4-row grid?",
            correctAnswer: 150,
            tolerance: 0.01,
            solution:
              "A rectangle is chosen by picking 2 of the 6 vertical lines and 2 of the 5 horizontal lines. C(6,2) × C(5,2) = 15 × 10 = 150."
          },
          {
            id: "f1-nat-5",
            type: "NAT",
            topic: "Analytical Reasoning",
            difficulty: "Medium",
            prompt:
              "A flag has three vertical stripes. Five colours are available, and adjacent stripes must be different. How many distinct flags can be made if the order of colours matters?",
            correctAnswer: 80,
            tolerance: 0.01,
            solution:
              "The first stripe has 5 choices. The second has 4 choices because it must differ from the first. The third also has 4 choices because it must differ from the second. 5 × 4 × 4 = 80."
          },
          {
            id: "f1-nat-6",
            type: "NAT",
            topic: "Spatial Reasoning",
            difficulty: "Medium",
            prompt:
              "A 6 cm cube is painted on all faces and cut into 2 cm cubes. How many of the resulting cubes have exactly one painted face?",
            correctAnswer: 6,
            tolerance: 0.01,
            solution:
              "The cube becomes 3 × 3 × 3. On each face, only the centre cube has exactly one painted face. There are 6 faces, so 6 cubes."
          }
        ]
      },
      {
        id: "msq",
        title: "Section 2",
        label: "Multiple Select",
        type: "MSQ",
        marks: 4,
        negative: 1,
        partial: true,
        instructions:
          "One or more options may be correct. Full +4 for all correct options. Partial +1 per correct option if no wrong option is selected. Any wrong option = −1.",
        questions: [
          {
            id: "f1-msq-1",
            type: "MSQ",
            topic: "Design Awareness",
            difficulty: "Easy",
            prompt:
              "Which of the following are Gestalt principles of perceptual grouping?",
            options: [
              { id: "A", text: "Proximity" },
              { id: "B", text: "Similarity" },
              { id: "C", text: "Closure" },
              { id: "D", text: "Perspective" }
            ],
            correctAnswer: ["A", "B", "C"],
            solution:
              "Proximity, similarity, and closure are Gestalt grouping principles. Perspective is a depth cue, not a Gestalt grouping principle."
          },
          {
            id: "f1-msq-2",
            type: "MSQ",
            topic: "Colour Theory",
            difficulty: "Easy",
            prompt:
              "On a traditional red-yellow-blue (RYB) colour wheel, which pairs are complementary?",
            options: [
              { id: "A", text: "Red – Green" },
              { id: "B", text: "Blue – Orange" },
              { id: "C", text: "Yellow – Purple" },
              { id: "D", text: "Red – Blue" }
            ],
            correctAnswer: ["A", "B", "C"],
            solution:
              "Complementary colours sit opposite each other on the RYB wheel: red/green, blue/orange, and yellow/purple. Red and blue are not opposite."
          },
          {
            id: "f1-msq-3",
            type: "MSQ",
            topic: "Materials",
            difficulty: "Easy",
            prompt:
              "Which of the following are generally considered biodegradable under normal environmental conditions?",
            options: [
              { id: "A", text: "Cotton" },
              { id: "B", text: "PET plastic" },
              { id: "C", text: "Jute" },
              { id: "D", text: "Paper" }
            ],
            correctAnswer: ["A", "C", "D"],
            solution:
              "Cotton, jute, and paper are biodegradable. PET is a synthetic polymer that is recyclable but not readily biodegradable."
          },
          {
            id: "f1-msq-4",
            type: "MSQ",
            topic: "Spatial Reasoning",
            difficulty: "Medium",
            prompt:
              "Which statements about a cube net are true?",
            options: [
              { id: "A", text: "A cube net contains six squares." },
              { id: "B", text: "A valid net can include a straight row of four squares." },
              { id: "C", text: "Any arrangement of six squares folds into a cube." },
              { id: "D", text: "A cube has 11 distinct nets." }
            ],
            correctAnswer: ["A", "B", "D"],
            solution:
              "A cube has six faces and 11 distinct nets. Some nets include a row of four squares. Not every arrangement of six squares folds into a cube; overlapping or disconnected arrangements fail."
          },
          {
            id: "f1-msq-5",
            type: "MSQ",
            topic: "Design Awareness",
            difficulty: "Medium",
            prompt:
              "Which of the following are useful tools for creating visual hierarchy in a layout?",
            options: [
              { id: "A", text: "Scale" },
              { id: "B", text: "Contrast" },
              { id: "C", text: "Whitespace" },
              { id: "D", text: "Lorem ipsum" }
            ],
            correctAnswer: ["A", "B", "C"],
            solution:
              "Scale, contrast, and whitespace guide the eye and establish priority. Lorem ipsum is placeholder text, not a hierarchy tool."
          },
          {
            id: "f1-msq-6",
            type: "MSQ",
            topic: "Indian Culture",
            difficulty: "Medium",
            prompt:
              "Which of the following are classical Indian dance forms?",
            options: [
              { id: "A", text: "Bharatanatyam" },
              { id: "B", text: "Kathak" },
              { id: "C", text: "Sattriya" },
              { id: "D", text: "Garba" }
            ],
            correctAnswer: ["A", "B", "C"],
            solution:
              "Bharatanatyam, Kathak, and Sattriya are classical dance forms. Garba is a Gujarati folk dance."
          }
        ]
      },
      {
        id: "mcq",
        title: "Section 3",
        label: "Multiple Choice",
        type: "MCQ",
        marks: 3,
        negative: 0.71,
        instructions:
          "Choose one option. Correct = +3. Wrong = −0.71. Unattempted = 0.",
        questions: [
          {
            id: "f1-mcq-1",
            type: "MCQ",
            topic: "Spatial Reasoning",
            difficulty: "Easy",
            prompt: "Which shape has the greatest number of lines of symmetry?",
            options: [
              { id: "A", text: "Square" },
              { id: "B", text: "Equilateral triangle" },
              { id: "C", text: "Regular hexagon" },
              { id: "D", text: "Circle" }
            ],
            correctAnswer: "D",
            solution:
              "A circle has infinitely many lines of symmetry. A square has 4, an equilateral triangle has 3, and a regular hexagon has 6."
          },
          {
            id: "f1-mcq-2",
            type: "MCQ",
            topic: "Spatial Reasoning",
            difficulty: "Easy",
            prompt:
              "A square is rotated 45° about its centre. Which property changes?",
            options: [
              { id: "A", text: "Side length" },
              { id: "B", text: "Area" },
              { id: "C", text: "Orientation" },
              { id: "D", text: "Shape" }
            ],
            correctAnswer: "C",
            solution:
              "Rotation changes orientation. Side length, area, and shape remain the same."
          },
          {
            id: "f1-mcq-3",
            type: "MCQ",
            topic: "Typography",
            difficulty: "Easy",
            prompt:
              "Which typeface classification is characterised by small strokes at the ends of letterforms?",
            options: [
              { id: "A", text: "Serif" },
              { id: "B", text: "Sans-serif" },
              { id: "C", text: "Script" },
              { id: "D", text: "Display" }
            ],
            correctAnswer: "A",
            solution:
              "Serif typefaces have small finishing strokes at the ends of letterforms. Sans-serif typefaces do not."
          },
          {
            id: "f1-mcq-4",
            type: "MCQ",
            topic: "Colour Theory",
            difficulty: "Easy",
            prompt:
              "Red text is placed on a green background. Which colour relationship best describes this pair?",
            options: [
              { id: "A", text: "Complementary" },
              { id: "B", text: "Analogous" },
              { id: "C", text: "Monochromatic" },
              { id: "D", text: "Triadic" }
            ],
            correctAnswer: "A",
            solution:
              "Red and green sit opposite each other on the traditional colour wheel, making them complementary."
          },
          {
            id: "f1-mcq-5",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Medium",
            prompt:
              "Which is the strongest evidence of design process in a portfolio?",
            options: [
              { id: "A", text: "A polished final render only" },
              { id: "B", text: "A mood board with several iterations and notes" },
              { id: "C", text: "A list of software used" },
              { id: "D", text: "A client testimonial" }
            ],
            correctAnswer: "B",
            solution:
              "Process evidence shows how the designer framed the problem, explored options, and refined the solution. A mood board with iterations and notes demonstrates that thinking."
          },
          {
            id: "f1-mcq-6",
            type: "MCQ",
            topic: "Materials",
            difficulty: "Easy",
            prompt:
              "Which of the following is an example of a sustainable design strategy?",
            options: [
              { id: "A", text: "Planned obsolescence" },
              { id: "B", text: "Design for disassembly" },
              { id: "C", text: "Single-use packaging" },
              { id: "D", text: "Over-specification" }
            ],
            correctAnswer: "B",
            solution:
              "Design for disassembly makes it easier to repair, reuse, and recover materials at the end of a product's life."
          },
          {
            id: "f1-mcq-7",
            type: "MCQ",
            topic: "Analytical Reasoning",
            difficulty: "Medium",
            prompt:
              "A 2 × 2 grid follows a Latin-square rule: each row and each column contains one circle, one square, one triangle, and one diamond. The top-left cell is a circle, the top-right is a square, and the bottom-left is a triangle. What is in the bottom-right cell?",
            options: [
              { id: "A", text: "Circle" },
              { id: "B", text: "Square" },
              { id: "C", text: "Triangle" },
              { id: "D", text: "Diamond" }
            ],
            correctAnswer: "D",
            solution:
              "The top row already has a circle and a square. The left column already has a circle and a triangle. The bottom-right cell must therefore be the diamond."
          },
          {
            id: "f1-mcq-8",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Easy",
            prompt:
              "Which is the best example of an affordance in product design?",
            options: [
              { id: "A", text: "A door handle shaped so it looks like it should be pulled" },
              { id: "B", text: "A button hidden under a plain panel" },
              { id: "C", text: "A label that explains how to open a door" },
              { id: "D", text: "A warning sign next to a door" }
            ],
            correctAnswer: "A",
            solution:
              "An affordance suggests how an object should be used. A handle that looks pullable communicates the action directly, without needing a label."
          }
        ]
      }
    ]
  },
  {
    id: "speed-1",
    examId: "uceed",
    examName: "UCEED",
    year: 2026,
    mode: "drill",
    title: "UCEED Speed Drill",
    subtitle: "30-minute quick drill · original practice paper",
    description:
      "A short, fast-paced paper for testing recall, visual logic, colour, typography, and sustainability under time pressure.",
    durationMinutes: 30,
    totalMarks: 42,
    sections: [
      {
        id: "nat",
        title: "Section 1",
        label: "Numerical Answer",
        type: "NAT",
        marks: 4,
        negative: 0,
        instructions:
          "Enter a number. Correct = +4. Wrong or unattempted = 0.",
        questions: [
          {
            id: "s1-nat-1",
            type: "NAT",
            topic: "Spatial Reasoning",
            difficulty: "Easy",
            prompt:
              "A 3 × 3 × 3 cube is painted on all faces and cut into 27 unit cubes. How many unit cubes have no painted face?",
            correctAnswer: 1,
            tolerance: 0.01,
            solution:
              "Only the single cube at the centre is completely hidden from all six faces. Answer: 1."
          },
          {
            id: "s1-nat-2",
            type: "NAT",
            topic: "Numerical Reasoning",
            difficulty: "Easy",
            prompt:
              "A price is reduced by 20%, and then the reduced price is reduced by another 10%. What is the single equivalent discount, in percent?",
            correctAnswer: 28,
            tolerance: 0.01,
            solution:
              "After 20% off, the price is 80% of the original. After another 10% off, it is 0.8 × 0.9 = 0.72, or 72% of the original. The total discount is 28%."
          },
          {
            id: "s1-nat-3",
            type: "NAT",
            topic: "Pattern Recognition",
            difficulty: "Easy",
            prompt:
              "A five-step motif repeats in the order A, B, C, D, E. Which position in the five-step cycle is the 47th step? (Enter 1 for A, 2 for B, and so on.)",
            correctAnswer: 2,
            tolerance: 0.01,
            solution:
              "47 ÷ 5 leaves a remainder of 2. The 47th step is the second item in the cycle, B."
          }
        ]
      },
      {
        id: "msq",
        title: "Section 2",
        label: "Multiple Select",
        type: "MSQ",
        marks: 4,
        negative: 1,
        partial: true,
        instructions:
          "One or more options may be correct. Full +4 for all correct options. Partial +1 per correct option if no wrong option is selected. Any wrong option = −1.",
        questions: [
          {
            id: "s1-msq-1",
            type: "MSQ",
            topic: "Colour Theory",
            difficulty: "Easy",
            prompt: "Which are the primary colours in the additive RGB system?",
            options: [
              { id: "A", text: "Red" },
              { id: "B", text: "Green" },
              { id: "C", text: "Blue" },
              { id: "D", text: "Yellow" }
            ],
            correctAnswer: ["A", "B", "C"],
            solution:
              "Additive colour mixes light. Its primaries are red, green, and blue. Yellow is a subtractive/CMY primary."
          },
          {
            id: "s1-msq-2",
            type: "MSQ",
            topic: "Design Awareness",
            difficulty: "Medium",
            prompt: "Which of the following are Gestalt principles?",
            options: [
              { id: "A", text: "Figure-ground" },
              { id: "B", text: "Continuity" },
              { id: "C", text: "Common fate" },
              { id: "D", text: "Golden ratio" }
            ],
            correctAnswer: ["A", "B", "C"],
            solution:
              "Figure-ground, continuity, and common fate are Gestalt principles. The golden ratio is a proportion system, not a Gestalt grouping principle."
          },
          {
            id: "s1-msq-3",
            type: "MSQ",
            topic: "Materials",
            difficulty: "Easy",
            prompt:
              "Which of the following are generally considered more sustainable material choices for a small product?",
            options: [
              { id: "A", text: "Bamboo" },
              { id: "B", text: "Recycled aluminium" },
              { id: "C", text: "Styrofoam" },
              { id: "D", text: "Cork" }
            ],
            correctAnswer: ["A", "B", "D"],
            solution:
              "Bamboo, recycled aluminium, and cork have preferable sustainability profiles in many contexts. Styrofoam is difficult to recycle and persists in the environment."
          }
        ]
      },
      {
        id: "mcq",
        title: "Section 3",
        label: "Multiple Choice",
        type: "MCQ",
        marks: 3,
        negative: 0.71,
        instructions:
          "Choose one option. Correct = +3. Wrong = −0.71. Unattempted = 0.",
        questions: [
          {
            id: "s1-mcq-1",
            type: "MCQ",
            topic: "Typography",
            difficulty: "Easy",
            prompt: "Which of these is a serif typeface?",
            options: [
              { id: "A", text: "Helvetica" },
              { id: "B", text: "Garamond" },
              { id: "C", text: "Futura" },
              { id: "D", text: "Arial" }
            ],
            correctAnswer: "B",
            solution:
              "Garamond is a classic serif typeface. Helvetica, Futura, and Arial are sans-serif."
          },
          {
            id: "s1-mcq-2",
            type: "MCQ",
            topic: "Colour Theory",
            difficulty: "Easy",
            prompt:
              "Which colour scheme uses hues that sit next to each other on the colour wheel?",
            options: [
              { id: "A", text: "Analogous" },
              { id: "B", text: "Complementary" },
              { id: "C", text: "Split-complementary" },
              { id: "D", text: "Triadic" }
            ],
            correctAnswer: "A",
            solution:
              "Analogous colours are adjacent on the wheel, such as yellow, yellow-green, and green."
          },
          {
            id: "s1-mcq-3",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Easy",
            prompt:
              "In human-centred design, which step typically comes first?",
            options: [
              { id: "A", text: "Prototype" },
              { id: "B", text: "Empathise" },
              { id: "C", text: "Test" },
              { id: "D", text: "Define" }
            ],
            correctAnswer: "B",
            solution:
              "Human-centred design begins by understanding people and their context. Empathise is the first step in the widely used five-stage model."
          },
          {
            id: "s1-mcq-4",
            type: "MCQ",
            topic: "Spatial Reasoning",
            difficulty: "Medium",
            prompt:
              "How many squares of any size are present in a 3 × 3 grid of unit squares?",
            options: [
              { id: "A", text: "9" },
              { id: "B", text: "10" },
              { id: "C", text: "14" },
              { id: "D", text: "16" }
            ],
            correctAnswer: "C",
            solution:
              "There are 9 squares of size 1 × 1, 4 of size 2 × 2, and 1 of size 3 × 3. 9 + 4 + 1 = 14."
          },
          {
            id: "s1-mcq-5",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Easy",
            prompt:
              "Which image format supports lossless compression and full alpha transparency?",
            options: [
              { id: "A", text: "JPEG" },
              { id: "B", text: "PNG" },
              { id: "C", text: "GIF" },
              { id: "D", text: "BMP" }
            ],
            correctAnswer: "B",
            solution:
              "PNG supports lossless compression and an alpha channel. JPEG is lossy, GIF has limited colours and 1-bit transparency, and BMP is typically uncompressed."
          },
          {
            id: "s1-mcq-6",
            type: "MCQ",
            topic: "Materials",
            difficulty: "Medium",
            prompt:
              "Which concept describes a closed-loop approach in which materials are continuously cycled?",
            options: [
              { id: "A", text: "Cradle-to-grave" },
              { id: "B", text: "Cradle-to-cradle" },
              { id: "C", text: "Linear economy" },
              { id: "D", text: "Take-make-dispose" }
            ],
            correctAnswer: "B",
            solution:
              "Cradle-to-cradle design treats materials as nutrients that can be reused indefinitely, rather than consumed and discarded."
          }
        ]
      }
    ]
  }
];

window.MOCK_PAPERS.push(
  {
    id: "ceed-1",
    examId: "ceed",
    examName: "CEED",
    year: 2026,
    mode: "mini",
    title: "CEED Mini Mock",
    subtitle: "CEED-style Part A · original practice paper",
    description:
      "A 45-minute postgraduate design paper with numerical, multiple-select, and single-choice sections using CEED-style marking.",
    durationMinutes: 45,
    totalMarks: 53,
    sections: [
      {
        id: "nat",
        title: "Section 1",
        label: "Numerical Answer",
        type: "NAT",
        marks: 4,
        negative: 0,
        instructions: "Enter a number. Correct = +4. Wrong or unattempted = 0.",
        questions: [
          {
            id: "c1-nat-1",
            type: "NAT",
            topic: "Spatial Reasoning",
            difficulty: "Medium",
            prompt:
              "A 3 × 3 × 3 cube is painted on every face and then cut into 27 unit cubes. How many unit cubes have exactly two painted faces?",
            correctAnswer: 12,
            tolerance: 0,
            solution:
              "The cubes with exactly two painted faces sit on the edges but are not corners. A cube has 12 edges, and each edge has one such cube in a 3 × 3 × 3 cut, so the answer is 12."
          },
          {
            id: "c1-nat-2",
            type: "NAT",
            topic: "Numerical Reasoning",
            difficulty: "Easy",
            prompt:
              "A rectangle is 12 cm wide and 9 cm high. A diagonal divides it into two triangles. What is the area of one triangle in square centimetres?",
            correctAnswer: 54,
            tolerance: 0,
            solution:
              "The rectangle area is 12 × 9 = 108 cm². A diagonal halves it, so each triangle is 54 cm²."
          },
          {
            id: "c1-nat-3",
            type: "NAT",
            topic: "Numerical Reasoning",
            difficulty: "Easy",
            prompt:
              "A layout uses a width-to-height ratio of 5:3. If the width is 45 cm, what is the height in centimetres?",
            correctAnswer: 27,
            tolerance: 0,
            solution:
              "Divide 45 by 5 to get one ratio unit: 9 cm. Multiply by 3 for the height: 27 cm."
          },
          {
            id: "c1-nat-4",
            type: "NAT",
            topic: "Analytical Reasoning",
            difficulty: "Medium",
            prompt: "Complete the sequence: 2, 6, 12, 20, 30, ?",
            correctAnswer: 42,
            tolerance: 0,
            solution:
              "The differences are 4, 6, 8, 10, so the next difference is 12. 30 + 12 = 42. The terms are n(n + 1)."
          }
        ]
      },
      {
        id: "msq",
        title: "Section 2",
        label: "Multiple Select",
        type: "MSQ",
        marks: 4,
        negative: 1,
        partial: true,
        instructions:
          "Select all correct options. +4 all correct; +1 per correct option if no wrong option is selected; −1 for any wrong option.",
        questions: [
          {
            id: "c1-msq-1",
            type: "MSQ",
            topic: "Design Awareness",
            difficulty: "Easy",
            prompt: "Which of these are common tools for creating visual hierarchy?",
            options: [
              { id: "A", text: "Contrast" },
              { id: "B", text: "Scale" },
              { id: "C", text: "Repetition" },
              { id: "D", text: "Random placement" }
            ],
            correctAnswer: ["A", "B", "C"],
            solution:
              "Contrast, scale, and repetition can all guide the eye and establish order. Random placement weakens hierarchy."
          },
          {
            id: "c1-msq-2",
            type: "MSQ",
            topic: "Materials",
            difficulty: "Easy",
            prompt: "Which of these materials are biodegradable?",
            options: [
              { id: "A", text: "Cotton" },
              { id: "B", text: "PET plastic" },
              { id: "C", text: "Jute" },
              { id: "D", text: "Wool" }
            ],
            correctAnswer: ["A", "C", "D"],
            solution:
              "Cotton, jute, and wool are natural fibres that can biodegrade. PET is a synthetic polymer and is not readily biodegradable."
          },
          {
            id: "c1-msq-3",
            type: "MSQ",
            topic: "Spatial Reasoning",
            difficulty: "Medium",
            prompt: "Which statements about isometric projection are correct?",
            options: [
              { id: "A", text: "The three main axes are spaced 120° apart." },
              { id: "B", text: "Parallel edges remain parallel." },
              { id: "C", text: "Lengths along the axes are drawn at true scale." },
              { id: "D", text: "All receding lines meet at a central vanishing point." }
            ],
            correctAnswer: ["A", "B", "C"],
            solution:
              "Isometric projection keeps parallel edges parallel and uses three axes 120° apart. It is a parallel projection, so there is no central vanishing point."
          },
          {
            id: "c1-msq-4",
            type: "MSQ",
            topic: "Design Awareness",
            difficulty: "Medium",
            prompt: "Which of these are sustainable design strategies?",
            options: [
              { id: "A", text: "Design for disassembly" },
              { id: "B", text: "Single-use packaging" },
              { id: "C", text: "Cradle-to-cradle material flow" },
              { id: "D", text: "Planned obsolescence" }
            ],
            correctAnswer: ["A", "C"],
            solution:
              "Design for disassembly and cradle-to-cradle flows keep materials in use. Single-use packaging and planned obsolescence shorten product life."
          }
        ]
      },
      {
        id: "mcq",
        title: "Section 3",
        label: "Multiple Choice",
        type: "MCQ",
        marks: 3,
        negative: 0.5,
        instructions: "Choose one option. Correct = +3. Wrong = −0.5.",
        questions: [
          {
            id: "c1-mcq-1",
            type: "MCQ",
            topic: "Spatial Reasoning",
            difficulty: "Medium",
            prompt: "How many squares of any size are present in a 3 × 3 grid of unit squares?",
            options: [
              { id: "A", text: "9" },
              { id: "B", text: "10" },
              { id: "C", text: "14" },
              { id: "D", text: "16" }
            ],
            correctAnswer: "C",
            solution:
              "There are 9 unit squares, 4 squares of side 2, and 1 square of side 3, giving 9 + 4 + 1 = 14."
          },
          {
            id: "c1-mcq-2",
            type: "MCQ",
            topic: "Colour Theory",
            difficulty: "Easy",
            prompt: "Which colour scheme uses colours opposite each other on the colour wheel?",
            options: [
              { id: "A", text: "Analogous" },
              { id: "B", text: "Complementary" },
              { id: "C", text: "Monochromatic" },
              { id: "D", text: "Triadic" }
            ],
            correctAnswer: "B",
            solution:
              "Complementary colours sit opposite each other on the colour wheel. Analogous colours sit next to each other; a monochromatic scheme uses one hue."
          },
          {
            id: "c1-mcq-3",
            type: "MCQ",
            topic: "Typography",
            difficulty: "Easy",
            prompt: "Which typeface classification is characterised by small decorative strokes at the ends of letterforms?",
            options: [
              { id: "A", text: "Serif" },
              { id: "B", text: "Sans-serif" },
              { id: "C", text: "Monospaced" },
              { id: "D", text: "Display" }
            ],
            correctAnswer: "A",
            solution:
              "Serif typefaces have small finishing strokes called serifs. Sans-serif faces do not."
          },
          {
            id: "c1-mcq-4",
            type: "MCQ",
            topic: "Materials",
            difficulty: "Medium",
            prompt:
              "A chair shell is formed from a single sheet of plywood pressed into a curved seat and back. What is this process called?",
            options: [
              { id: "A", text: "Casting" },
              { id: "B", text: "Moulded plywood" },
              { id: "C", text: "Extrusion" },
              { id: "D", text: "Forging" }
            ],
            correctAnswer: "B",
            solution:
              "Plywood can be bent and glued over a mould to hold a curved form. Casting, extrusion, and forging describe different material processes."
          },
          {
            id: "c1-mcq-5",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Easy",
            prompt: "Which is the best example of an affordance?",
            options: [
              { id: "A", text: "A handle shaped so it looks pullable" },
              { id: "B", text: "A button hidden under a plain panel" },
              { id: "C", text: "A label explaining how to open a door" },
              { id: "D", text: "A warning sign next to a door" }
            ],
            correctAnswer: "A",
            solution:
              "An affordance suggests how an object should be used. A handle that looks pullable communicates the action directly, without needing a label."
          },
          {
            id: "c1-mcq-6",
            type: "MCQ",
            topic: "Visual Reasoning",
            difficulty: "Easy",
            prompt: "A 12-column grid is used for a poster. What fraction of the grid width does a three-column image occupy?",
            options: [
              { id: "A", text: "1/2" },
              { id: "B", text: "1/3" },
              { id: "C", text: "1/4" },
              { id: "D", text: "1/6" }
            ],
            correctAnswer: "C",
            solution: "Three columns out of twelve is 3/12, which simplifies to 1/4."
          },
          {
            id: "c1-mcq-7",
            type: "MCQ",
            topic: "Materials",
            difficulty: "Easy",
            prompt: "Which of these is not a renewable material?",
            options: [
              { id: "A", text: "Cotton" },
              { id: "B", text: "Bamboo" },
              { id: "C", text: "Polyester" },
              { id: "D", text: "Cork" }
            ],
            correctAnswer: "C",
            solution:
              "Polyester is a synthetic polymer made from petrochemicals. Cotton, bamboo, and cork are renewable plant-based materials."
          }
        ]
      }
    ]
  },
  {
    id: "nift-1",
    examId: "nift",
    examName: "NIFT",
    year: 2026,
    mode: "mini",
    title: "NIFT Mini Mock",
    subtitle: "NIFT-style paper · original practice paper",
    description:
      "A 30-minute speed paper across English, quantitative ability, logical reasoning, and general knowledge, using NIFT-style +1/−0.25 marking.",
    durationMinutes: 30,
    totalMarks: 20,
    sections: [
      {
        id: "english",
        title: "Section 1",
        label: "Communication Ability & English",
        type: "MCQ",
        marks: 1,
        negative: 0.25,
        instructions: "Choose one option. Correct = +1. Wrong = −0.25.",
        questions: [
          {
            id: "n1-eng-1",
            type: "MCQ",
            topic: "English",
            difficulty: "Easy",
            prompt: "Choose the word closest in meaning to “meticulous”.",
            options: [
              { id: "A", text: "Careless" },
              { id: "B", text: "Careful" },
              { id: "C", text: "Hasty" },
              { id: "D", text: "Ordinary" }
            ],
            correctAnswer: "B",
            solution: "Meticulous means showing great attention to detail; careful is the closest synonym."
          },
          {
            id: "n1-eng-2",
            type: "MCQ",
            topic: "English",
            difficulty: "Easy",
            prompt: "Choose the antonym of “scarce”.",
            options: [
              { id: "A", text: "Rare" },
              { id: "B", text: "Limited" },
              { id: "C", text: "Abundant" },
              { id: "D", text: "Small" }
            ],
            correctAnswer: "C",
            solution: "Scarce means in short supply; abundant means available in large quantities."
          },
          {
            id: "n1-eng-3",
            type: "MCQ",
            topic: "English",
            difficulty: "Medium",
            prompt: "Which sentence is grammatically correct?",
            options: [
              { id: "A", text: "She is working here since 2020." },
              { id: "B", text: "She has been working here since 2020." },
              { id: "C", text: "She works here since 2020." },
              { id: "D", text: "She worked here since 2020." }
            ],
            correctAnswer: "B",
            solution:
              "The present perfect continuous “has been working” is used for an action that began in the past and continues to the present."
          },
          {
            id: "n1-eng-4",
            type: "MCQ",
            topic: "English",
            difficulty: "Medium",
            prompt: "What does the idiom “to bite the bullet” mean?",
            options: [
              { id: "A", text: "To speak without thinking" },
              { id: "B", text: "To endure a difficult situation" },
              { id: "C", text: "To celebrate a victory" },
              { id: "D", text: "To avoid a responsibility" }
            ],
            correctAnswer: "B",
            solution: "To bite the bullet means to face a painful or unpleasant situation with courage."
          },
          {
            id: "n1-eng-5",
            type: "MCQ",
            topic: "English",
            difficulty: "Easy",
            prompt: "A person who studies stars and planets is called a(n):",
            options: [
              { id: "A", text: "Astrologer" },
              { id: "B", text: "Astronomer" },
              { id: "C", text: "Geologist" },
              { id: "D", text: "Biologist" }
            ],
            correctAnswer: "B",
            solution: "An astronomer studies celestial objects scientifically. An astrologer studies astrology."
          },
          {
            id: "n1-eng-6",
            type: "MCQ",
            topic: "English",
            difficulty: "Medium",
            prompt: "Fill in the blank: “Neither the designer nor the client ___ satisfied with the first draft.”",
            options: [
              { id: "A", text: "were" },
              { id: "B", text: "was" },
              { id: "C", text: "are" },
              { id: "D", text: "have been" }
            ],
            correctAnswer: "B",
            solution:
              "With “neither … nor”, the verb agrees with the nearer subject, “the client”, which is singular. Use “was”."
          }
        ]
      },
      {
        id: "quant",
        title: "Section 2",
        label: "Quantitative Ability",
        type: "MCQ",
        marks: 1,
        negative: 0.25,
        instructions: "Choose one option. Correct = +1. Wrong = −0.25.",
        questions: [
          {
            id: "n1-quant-1",
            type: "MCQ",
            topic: "Quantitative Aptitude",
            difficulty: "Easy",
            prompt: "What is 15% of 240?",
            options: [
              { id: "A", text: "24" },
              { id: "B", text: "30" },
              { id: "C", text: "36" },
              { id: "D", text: "42" }
            ],
            correctAnswer: "C",
            solution: "10% of 240 is 24; 5% is 12. Together, 15% is 36."
          },
          {
            id: "n1-quant-2",
            type: "MCQ",
            topic: "Quantitative Aptitude",
            difficulty: "Easy",
            prompt: "Two numbers are in the ratio 3:5 and add up to 64. What is the larger number?",
            options: [
              { id: "A", text: "24" },
              { id: "B", text: "32" },
              { id: "C", text: "40" },
              { id: "D", text: "48" }
            ],
            correctAnswer: "C",
            solution: "The parts are 3 + 5 = 8, so one part is 8. The larger share is 5 × 8 = 40."
          },
          {
            id: "n1-quant-3",
            type: "MCQ",
            topic: "Quantitative Aptitude",
            difficulty: "Easy",
            prompt: "What is the average of 12, 18, 24, and 30?",
            options: [
              { id: "A", text: "18" },
              { id: "B", text: "20" },
              { id: "C", text: "21" },
              { id: "D", text: "24" }
            ],
            correctAnswer: "C",
            solution: "The total is 84. Divide by 4 to get 21."
          },
          {
            id: "n1-quant-4",
            type: "MCQ",
            topic: "Quantitative Aptitude",
            difficulty: "Easy",
            prompt: "A shirt priced at ₹800 is discounted by 25%. What is the sale price?",
            options: [
              { id: "A", text: "₹550" },
              { id: "B", text: "₹600" },
              { id: "C", text: "₹625" },
              { id: "D", text: "₹700" }
            ],
            correctAnswer: "B",
            solution: "25% of ₹800 is ₹200. Subtract to get ₹600."
          },
          {
            id: "n1-quant-5",
            type: "MCQ",
            topic: "Quantitative Aptitude",
            difficulty: "Medium",
            prompt: "Using π = 22/7, what is the area of a circle with radius 7 cm?",
            options: [
              { id: "A", text: "44 cm²" },
              { id: "B", text: "154 cm²" },
              { id: "C", text: "196 cm²" },
              { id: "D", text: "308 cm²" }
            ],
            correctAnswer: "B",
            solution: "Area = πr² = (22/7) × 7 × 7 = 22 × 7 = 154 cm²."
          }
        ]
      },
      {
        id: "logical",
        title: "Section 3",
        label: "Analytical & Logical Ability",
        type: "MCQ",
        marks: 1,
        negative: 0.25,
        instructions: "Choose one option. Correct = +1. Wrong = −0.25.",
        questions: [
          {
            id: "n1-logical-1",
            type: "MCQ",
            topic: "Analytical Reasoning",
            difficulty: "Medium",
            prompt: "Complete the sequence: 3, 6, 11, 18, ?",
            options: [
              { id: "A", text: "24" },
              { id: "B", text: "25" },
              { id: "C", text: "27" },
              { id: "D", text: "29" }
            ],
            correctAnswer: "C",
            solution: "The differences are 3, 5, 7, so the next difference is 9. 18 + 9 = 27."
          },
          {
            id: "n1-logical-2",
            type: "MCQ",
            topic: "Analytical Reasoning",
            difficulty: "Medium",
            prompt:
              "All roses are flowers. No flower is a rock. Which conclusion follows necessarily?",
            options: [
              { id: "A", text: "Some rocks are roses." },
              { id: "B", text: "No rose is a rock." },
              { id: "C", text: "All flowers are roses." },
              { id: "D", text: "Some flowers are rocks." }
            ],
            correctAnswer: "B",
            solution:
              "Since every rose is a flower and no flower is a rock, no rose can be a rock."
          },
          {
            id: "n1-logical-3",
            type: "MCQ",
            topic: "Pattern Recognition",
            difficulty: "Easy",
            prompt: "Which is the odd one out?",
            options: [
              { id: "A", text: "Circle" },
              { id: "B", text: "Square" },
              { id: "C", text: "Triangle" },
              { id: "D", text: "Cube" }
            ],
            correctAnswer: "D",
            solution: "Circle, square, and triangle are two-dimensional shapes. A cube is three-dimensional."
          },
          {
            id: "n1-logical-4",
            type: "MCQ",
            topic: "Analytical Reasoning",
            difficulty: "Medium",
            prompt: "If CAT is coded as 3120, how is DOG coded using the same letter-to-position rule?",
            options: [
              { id: "A", text: "4157" },
              { id: "B", text: "4156" },
              { id: "C", text: "4147" },
              { id: "D", text: "3157" }
            ],
            correctAnswer: "A",
            solution: "D = 4, O = 15, G = 7, so DOG becomes 4157."
          },
          {
            id: "n1-logical-5",
            type: "MCQ",
            topic: "Analytical Reasoning",
            difficulty: "Easy",
            prompt: "A is taller than B. C is shorter than B. Who is the shortest?",
            options: [
              { id: "A", text: "A" },
              { id: "B", text: "B" },
              { id: "C", text: "C" },
              { id: "D", text: "Cannot be determined" }
            ],
            correctAnswer: "C",
            solution: "A > B and B > C, so C is the shortest."
          }
        ]
      },
      {
        id: "gk",
        title: "Section 4",
        label: "General Knowledge & Current Affairs",
        type: "MCQ",
        marks: 1,
        negative: 0.25,
        instructions: "Choose one option. Correct = +1. Wrong = −0.25.",
        questions: [
          {
            id: "n1-gk-1",
            type: "MCQ",
            topic: "General Knowledge",
            difficulty: "Easy",
            prompt: "Which Indian city is known as the “Pink City”?",
            options: [
              { id: "A", text: "Udaipur" },
              { id: "B", text: "Jaipur" },
              { id: "C", text: "Jodhpur" },
              { id: "D", text: "Lucknow" }
            ],
            correctAnswer: "B",
            solution: "Jaipur is called the Pink City because of the terracotta-pink colour of its old city buildings."
          },
          {
            id: "n1-gk-2",
            type: "MCQ",
            topic: "Indian Culture",
            difficulty: "Medium",
            prompt: "Who designed the Indian national flag?",
            options: [
              { id: "A", text: "Rabindranath Tagore" },
              { id: "B", text: "Pingali Venkayya" },
              { id: "C", text: "Nandalal Bose" },
              { id: "D", text: "Jamini Roy" }
            ],
            correctAnswer: "B",
            solution: "Pingali Venkayya is credited with designing the Indian national flag."
          },
          {
            id: "n1-gk-3",
            type: "MCQ",
            topic: "Fashion & Textile",
            difficulty: "Easy",
            prompt: "Which fabric is made from flax?",
            options: [
              { id: "A", text: "Linen" },
              { id: "B", text: "Silk" },
              { id: "C", text: "Wool" },
              { id: "D", text: "Nylon" }
            ],
            correctAnswer: "A",
            solution: "Linen is woven from the fibres of the flax plant."
          },
          {
            id: "n1-gk-4",
            type: "MCQ",
            topic: "Colour Theory",
            difficulty: "Easy",
            prompt: "Which colour is not a primary colour in additive RGB mixing?",
            options: [
              { id: "A", text: "Red" },
              { id: "B", text: "Green" },
              { id: "C", text: "Blue" },
              { id: "D", text: "Yellow" }
            ],
            correctAnswer: "D",
            solution: "Additive mixing uses red, green, and blue. Yellow is a secondary colour in additive mixing."
          }
        ]
      }
    ]
  },
  {
    id: "nid-1",
    examId: "nid",
    examName: "NID UG",
    year: 2024,
    mode: "mini",
    title: "NID UG Mini Mock",
    subtitle: "NID UG-style Part A · original practice paper",
    description:
      "A focused 30-minute NID-style paper with one-mark and two-mark multiple-choice questions and no negative marking.",
    durationMinutes: 30,
    totalMarks: 10,
    sections: [
      {
        id: "part-a-1",
        title: "Section 1",
        label: "Part A · 1 mark",
        type: "MCQ",
        marks: 1,
        negative: 0,
        instructions: "Choose one option. Correct = +1. Wrong = 0.",
        questions: [
          {
            id: "nid1-a1",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Easy",
            prompt: "Which is an example of biomimicry?",
            options: [
              { id: "A", text: "Velcro inspired by burrs" },
              { id: "B", text: "A chair made of steel" },
              { id: "C", text: "A poster with a grid" },
              { id: "D", text: "A logo with a circle" }
            ],
            correctAnswer: "A",
            solution: "Biomimicry borrows strategies from nature. Velcro was inspired by the hooks of burrs."
          },
          {
            id: "nid1-a2",
            type: "MCQ",
            topic: "Colour Theory",
            difficulty: "Easy",
            prompt: "Which of these is a warm colour?",
            options: [
              { id: "A", text: "Blue" },
              { id: "B", text: "Green" },
              { id: "C", text: "Orange" },
              { id: "D", text: "Violet" }
            ],
            correctAnswer: "C",
            solution: "Orange sits on the warm side of the colour wheel, alongside red and yellow."
          },
          {
            id: "nid1-a3",
            type: "MCQ",
            topic: "Spatial Reasoning",
            difficulty: "Easy",
            prompt: "In a perspective drawing, receding parallel lines appear to meet at a:",
            options: [
              { id: "A", text: "Baseline" },
              { id: "B", text: "Vanishing point" },
              { id: "C", text: "Ground plane" },
              { id: "D", text: "Centre line" }
            ],
            correctAnswer: "B",
            solution: "In linear perspective, parallel lines receding from the viewer converge at a vanishing point."
          },
          {
            id: "nid1-a4",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Easy",
            prompt: "Which is not a principle of design?",
            options: [
              { id: "A", text: "Balance" },
              { id: "B", text: "Rhythm" },
              { id: "C", text: "Gravity" },
              { id: "D", text: "Emphasis" }
            ],
            correctAnswer: "C",
            solution: "Balance, rhythm, and emphasis are design principles. Gravity is a physical force."
          },
          {
            id: "nid1-a5",
            type: "MCQ",
            topic: "Spatial Reasoning",
            difficulty: "Easy",
            prompt: "Which three-dimensional form has every point on its surface equidistant from its centre?",
            options: [
              { id: "A", text: "Cube" },
              { id: "B", text: "Cylinder" },
              { id: "C", text: "Sphere" },
              { id: "D", text: "Cone" }
            ],
            correctAnswer: "C",
            solution: "A sphere is the set of all points at a fixed distance from its centre."
          },
          {
            id: "nid1-a6",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Medium",
            prompt: "Which is the most sustainable packaging choice?",
            options: [
              { id: "A", text: "A reusable cloth bag" },
              { id: "B", text: "A single-use plastic bag" },
              { id: "C", text: "A laminated foil pouch" },
              { id: "D", text: "A polystyrene box" }
            ],
            correctAnswer: "A",
            solution: "A reusable cloth bag can replace many single-use bags over its lifetime, reducing waste."
          }
        ]
      },
      {
        id: "part-a-2",
        title: "Section 2",
        label: "Part A · 2 marks",
        type: "MCQ",
        marks: 2,
        negative: 0,
        instructions: "Choose one option. Correct = +2. Wrong = 0.",
        questions: [
          {
            id: "nid1-b2",
            type: "MCQ",
            topic: "Spatial Reasoning",
            difficulty: "Hard",
            prompt: "How many rectangles of any size are present in a 3 × 3 grid?",
            options: [
              { id: "A", text: "18" },
              { id: "B", text: "24" },
              { id: "C", text: "36" },
              { id: "D", text: "45" }
            ],
            correctAnswer: "C",
            solution:
              "Choose two of the four vertical grid lines and two of the four horizontal lines. That gives C(4,2) × C(4,2) = 6 × 6 = 36 rectangles."
          },
          {
            id: "nid1-b4",
            type: "MCQ",
            topic: "Design Awareness",
            difficulty: "Medium",
            prompt: "Which is the best example of universal design?",
            options: [
              { id: "A", text: "A ramp alongside a flight of steps" },
              { id: "B", text: "A door with no handle" },
              { id: "C", text: "A sign written only in one language" },
              { id: "D", text: "A control panel with tiny unlabelled buttons" }
            ],
            correctAnswer: "A",
            solution:
              "Universal design aims to make an environment usable by as many people as possible. A ramp alongside steps gives a choice of access."
          }
        ]
      }
    ]
  }
);

window.DRAWING_PROMPTS = [
  {
    id: "draw-1",
    title: "Courtyard reading nook",
    duration: "30 min",
    brief:
      "A community library has a narrow 3 m × 6 m courtyard. Design a reading nook for three people that works in both sun and light rain. Show a plan, one perspective, and one construction detail.",
    criteria: [
      "Clear response to site and weather",
      "Usable circulation and seating",
      "Structural logic",
      "Drawing clarity and composition"
    ]
  },
  {
    id: "draw-2",
    title: "Tactile stationery sorter",
    duration: "30 min",
    brief:
      "Design a handheld tool that helps a visually impaired student identify and sort three types of stationery by touch. Show the form, grip, and how the tool is used.",
    criteria: [
      "Inclusive thinking",
      "Tactile differentiation",
      "Ergonomics",
      "Clarity of use"
    ]
  },
  {
    id: "draw-3",
    title: "Foldable festival stall",
    duration: "30 min",
    brief:
      "A festival stall sells two traditional snacks and one drink. Design a low-cost stall that one person can assemble in 15 minutes. Show the open and closed states.",
    criteria: [
      "Structural feasibility",
      "Ease of assembly",
      "Visual appeal",
      "Cost awareness"
    ]
  },
  {
    id: "draw-4",
    title: "Repair café identity",
    duration: "30 min",
    brief:
      "Create a visual identity for a neighbourhood repair café. Include a logo, one poster, and one wayfinding sign. Explain your choices.",
    criteria: [
      "Concept and relevance",
      "Visual consistency",
      "Typography and layout",
      "Communication"
    ]
  }
];
