/* Original practice content for the Dexam Mock Test app.
   Every question below is written for this prototype. No Roughworks
   question text, answer, or explanation has been copied. */

window.MOCK_PAPERS = [
  {
    id: "foundation-1",
    title: "Foundation Mock 1",
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
    title: "Speed Mock 1",
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
