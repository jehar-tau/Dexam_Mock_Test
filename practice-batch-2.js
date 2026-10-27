/* Original UCEED drill bank, batch 2.
   Fills UCEED topic coverage to exam-pattern depth.
   Every question is original to this prototype. */

(function () {
  var seq = 0;

  function drill(type, topic, difficulty, prompt, options, correctAnswer, solution) {
    seq += 1;
    return {
      id: "uceed-drill-b2-" + seq,
      examId: "uceed",
      type: type,
      topic: topic,
      difficulty: difficulty,
      marks: type === "NAT" ? 4 : 3,
      negative: type === "NAT" ? 0 : type === "MCQ" ? 0.71 : 1,
      prompt: prompt,
      options:
        options && options.length
          ? options.map(function (text, index) { return { id: "ABCDEFGH"[index], text: text }; })
          : undefined,
      correctAnswer: correctAnswer,
      solution: solution,
      source: "original",
      licence: "owned",
      status: "published",
      version: "2"
    };
  }

  function mcq(topic, difficulty, prompt, options, answer, solution) {
    return drill("MCQ", topic, difficulty, prompt, options, answer, solution);
  }

  function nat(topic, difficulty, prompt, answer, solution) {
    return drill("NAT", topic, difficulty, prompt, undefined, answer, solution);
  }

  function msq(topic, difficulty, prompt, options, answer, solution) {
    return drill("MSQ", topic, difficulty, prompt, options, answer, solution);
  }

  var spatial = [
    nat("Spatial Reasoning", "Easy", "A rectangular prism has dimensions 3 cm × 4 cm × 5 cm. What is its volume in cm³?", 60, "Volume = 3 × 4 × 5 = 60 cm³."),
    nat("Spatial Reasoning", "Medium", "A 5 × 5 × 5 cube is painted on all faces and cut into 125 unit cubes. How many unit cubes have exactly one painted face?", 54, "Only the non-corner cubes on the outside faces of each face have one painted face: 6 faces × 9 = 54."),
    nat("Spatial Reasoning", "Medium", "A 4 × 4 × 4 cube is painted on all faces and cut into 64 unit cubes. How many unit cubes have exactly three painted faces?", 8, "Only the 8 corner cubes of a cube have three painted faces."),
    nat("Spatial Reasoning", "Medium", "A cube is cut into 8 smaller equal cubes. How many new faces are visible on the outside?", 24, "Each of the 8 smaller cubes contributes 3 visible faces on the outside, giving 24 new visible faces."),
    nat("Spatial Reasoning", "Medium", "A square pyramid has base 6 cm × 6 cm and height 4 cm. What is its volume in cm³?", 48, "Volume = (1/3) × base area × height = (1/3) × 36 × 4 = 48 cm³."),
    nat("Spatial Reasoning", "Medium", "A cone has radius 7 cm and height 6 cm. Using π = 22/7, what is its volume in cm³?", 154, "Volume = (1/3) × π × r² × h = (1/3) × (22/7) × 49 × 6 = 154 cm³."),
    nat("Spatial Reasoning", "Medium", "A prism has 10 faces altogether. What shape is its base?", 8, "A prism has 2 base polygons plus rectangular sides. 10 faces means 8 side faces, so the base is an octagon."),
    nat("Spatial Reasoning", "Medium", "A cuboid measures 8 cm × 5 cm × 3 cm. What is its volume in cm³?", 120, "Volume = 8 × 5 × 3 = 120 cm³."),
    nat("Spatial Reasoning", "Medium", "A regular hexagon has how many diagonals?", 9, "A regular n-gon has n(n − 3)/2 diagonals. For n = 6, that is 9."),
    nat("Spatial Reasoning", "Medium", "A regular heptagon has how many diagonals?", 14, "A regular n-gon has n(n − 3)/2 diagonals. For n = 7, that is 14."),
    nat("Spatial Reasoning", "Easy", "A regular pentagon has how many diagonals?", 5, "A regular n-gon has n(n − 3)/2 diagonals. For n = 5, that is 5."),
    nat("Spatial Reasoning", "Medium", "A regular octagon has how many diagonals?", 20, "A regular n-gon has n(n − 3)/2 diagonals. For n = 8, that is 20."),
    mcq("Spatial Reasoning", "Easy", "Which of these is not a prism?", ["Cone", "Cube", "Triangular prism", "Hexagonal prism"], "A", "A cone narrows to a point, so it is not a prism."),
    mcq("Spatial Reasoning", "Easy", "Which of these is a regular polyhedron?", ["Tetrahedron", "Cuboid", "Cone", "Cylinder"], "A", "A tetrahedron has identical regular triangular faces."),
    nat("Spatial Reasoning", "Easy", "A regular tetrahedron has how many faces?", 4, "A tetrahedron has 4 triangular faces."),
    nat("Spatial Reasoning", "Easy", "A regular octahedron has how many faces?", 8, "A regular octahedron has 8 triangular faces."),
    nat("Spatial Reasoning", "Easy", "A square pyramid has how many edges?", 8, "A square pyramid has 4 base edges and 4 slanted edges, so 8 edges."),
    nat("Spatial Reasoning", "Easy", "A cuboid has how many vertices?", 8, "A cuboid has 8 vertices."),
    mcq("Spatial Reasoning", "Easy", "Which 3D shape has exactly one curved surface and no straight edges?", ["Sphere", "Cylinder", "Cone", "Cuboid"], "A", "A sphere is curved throughout with no edges or corners."),
    nat("Spatial Reasoning", "Medium", "A cuboid measures 10 cm × 5 cm × 4 cm. What is its volume in cm³?", 200, "Volume = 10 × 5 × 4 = 200 cm³."),
    nat("Spatial Reasoning", "Medium", "A cube measures 6 cm on a side. What is its total surface area in cm²?", 216, "Total surface area = 6 × 6² = 216 cm²."),
    nat("Spatial Reasoning", "Easy", "A triangular prism has how many faces?", 5, "Two triangular ends and three rectangular sides make 5 faces."),
    nat("Spatial Reasoning", "Easy", "A square pyramid has how many vertices?", 5, "Four base corners and one apex give 5 vertices."),
    nat("Spatial Reasoning", "Medium", "A regular hexagon rotated by 60° maps onto itself how many times in a full turn?", 6, "Rotational symmetry order equals the number of identical rotations in 360°; for a hexagon it is 6."),
    nat("Spatial Reasoning", "Medium", "A regular pentagon rotated by 72° maps onto itself how many times in a full turn?", 5, "A regular pentagon has rotational symmetry order 5."),
    nat("Spatial Reasoning", "Medium", "A regular octagon rotated by 45° maps onto itself how many times in a full turn?", 8, "A regular octagon has rotational symmetry order 8."),
    mcq("Spatial Reasoning", "Easy", "Which shape has exactly one pair of parallel sides?", ["Trapezoid", "Parallelogram", "Square", "Rhombus"], "A", "A trapezoid has one pair of parallel sides."),
    mcq("Spatial Reasoning", "Easy", "Which shape has four equal sides and four right angles?", ["Square", "Rhombus", "Rectangle", "Parallelogram"], "A", "A square has equal sides and right angles; a rhombus or rectangle lacks one of the two."),
    nat("Spatial Reasoning", "Medium", "A 3 × 3 × 3 cube is painted on all faces and cut into 27 unit cubes. How many unit cubes have zero painted faces?", 1, "Only the very centre cube of a 3 × 3 × 3 cube has no painted faces."),
    mcq("Spatial Reasoning", "Easy", "Which of these is not a pyramid?", ["Cube", "Cone", "Square pyramid", "Triangular pyramid"], "A", "A cube cannot be a pyramid; all others have a base tapering to a point."),
    mcq("Spatial Reasoning", "Medium", "Which of these is not a polyhedron?", ["Cone", "Cube", "Icosahedron", "Tetrahedron"], "A", "A cone has a curved surface, so it is not a polyhedron."),
    nat("Spatial Reasoning", "Medium", "A cuboid has dimensions 3 cm × 4 cm × 6 cm. What is its total surface area in cm²?", 108, "Total surface area = 2(3×4 + 4×6 + 6×3) = 2 × 54 = 108 cm².")
  ];

  var visual = [
    mcq("Visual Reasoning", "Easy", "Which Gestalt principle makes the eye follow a line or curve even when interrupted?", ["Continuity", "Similarity", "Proximity", "Closure"], "A", "Continuity makes the eye tend to continue along a smooth path even when objects interrupt it."),
    mcq("Visual Reasoning", "Easy", "Which Gestalt principle makes a partial outline read as a complete shape?", ["Closure", "Contrast", "Proximity", "Similarity"], "A", "Closure lets the mind complete a familiar figure when part of the outline is missing."),
    mcq("Visual Reasoning", "Easy", "Which Gestalt principle groups elements that are near each other?", ["Proximity", "Continuity", "Common fate", "Closure"], "A", "Proximity groups things that are spatially close."),
    mcq("Visual Reasoning", "Easy", "Which Gestalt principle groups elements that share colour or shape?", ["Similarity", "Proximity", "Closure", "Continuity"], "A", "Similarity groups visual elements with shared colour, tone, shape, or texture."),
    mcq("Visual Reasoning", "Medium", "Which Gestalt principle explains why elements moving together are seen as one unit?", ["Common fate", "Closure", "Similarity", "Proximity"], "A", "Common fate groups things that appear to move in the same direction."),
    mcq("Visual Reasoning", "Easy", "Which of these is not a Gestalt principle?", ["Momentum", "Closure", "Proximity", "Similarity"], "A", "Closure, proximity, and similarity are Gestalt principles; momentum is not."),
    nat("Visual Reasoning", "Easy", "How many lines of symmetry does a regular pentagon have?", 5, "A regular n-gon has n lines of symmetry. For a pentagon, that is 5."),
    nat("Visual Reasoning", "Easy", "How many lines of symmetry does a regular hexagon have?", 6, "A regular hexagon has 6 lines of symmetry."),
    nat("Visual Reasoning", "Easy", "How many lines of symmetry does a square have?", 4, "A square has 4 lines of symmetry."),
    nat("Visual Reasoning", "Medium", "A regular octagon rotated by 45° maps onto itself how many times in a full turn?", 8, "The rotational symmetry order of a regular octagon is 8."),
    mcq("Visual Reasoning", "Medium", "Which of these creates a clear figure-ground split?", ["Strong contrast", "Thin outlines", "Wider margins", "Repeated patterns"], "A", "Contrast separates foreground from background, making the figure-ground split clear."),
    mcq("Visual Reasoning", "Easy", "Which of these is an example of an optical illusion?", ["After-image", "Serif", "Pyramid", "Plain text"], "A", "An after-image appears when a strong stimulus is followed by a neutral surround."),
    mcq("Visual Reasoning", "Easy", "Which of these reduces visual noise in a layout?", ["More white space", "More colours", "More shadows", "More borders"], "A", "White space reduces visual clutter, making the design easier to read."),
    mcq("Visual Reasoning", "Medium", "Which effect describes dark objects that appear lighter on a dark background?", ["Simultaneous contrast", "After-image", "Closure", "Proximity"], "A", "Simultaneous contrast makes one colour look different next to another."),
    nat("Visual Reasoning", "Medium", "A regular heptagon rotated by 360/7 degrees maps onto itself how many times in a full turn?", 7, "A regular heptagon has rotational symmetry order 7.")
  ];

  var analytical = [
    nat("Analytical Reasoning", "Easy", "A car covers 240 km in 4 hours. Its average speed is how many km per hour?", 60, "Speed = 240 ÷ 4 = 60 km/h."),
    nat("Analytical Reasoning", "Medium", "Two taps fill a tank in 12 minutes and 6 minutes respectively. Working together, how many minutes does it take to fill the tank once?", 4, "The combined rate is 1/12 + 1/6 = 1/4 tank per minute, so together they take 4 minutes."),
    nat("Analytical Reasoning", "Medium", "If 3 workers take 12 days to finish a job, how many more workers are needed to finish the same job in 9 days, assuming equal output?", 1, "Total worker-days = 36. To finish in 9 days, 4 workers are needed, so 1 more than 3."),
    nat("Analytical Reasoning", "Easy", "A shopkeeper gives a 10% commission on a bill of ₹500. What is the commission amount in rupees?", 50, "10% of 500 = ₹50."),
    mcq("Analytical Reasoning", "Medium", "Which one is unlike the others?", ["Mridangam", "Sitar", "Harmonium", "Veena"], "A", "The mridangam is a percussion instrument, while the others are stringed."),
    nat("Analytical Reasoning", "Easy", "A car covers 60 km in 45 minutes. Its average speed is how many km per hour?", 80, "45 minutes is 0.75 hour, so speed = 60 ÷ 0.75 = 80 km/h."),
    mcq("Analytical Reasoning", "Easy", "Which pairs matches the analogy: Pen : Ink :: Camera : ___?", ["Film", "Paper", "Chalk", "Typeface"], "A", "A pen uses ink; a camera traditionally uses film."),
    nat("Analytical Reasoning", "Medium", "A trader buys 10 shares at ₹500 each. If the price rises to ₹600, what is the profit percentage?", 20, "Profit per share = ₹100. Profit% = 100/500 × 100 = 20%."),
    mcq("Analytical Reasoning", "Easy", "Which one is unlike the others?", ["Pentagon", "Square", "Rectangle", "Rhombus"], "A", "Square, rectangle, and rhombus are quadrilaterals. A pentagon is not."),
    nat("Analytical Reasoning", "Medium", "A train covers 180 km in 4 hours. Its average speed is how many km per hour?", 45, "Speed = 180 ÷ 4 = 45 km/h."),
    mcq("Analytical Reasoning", "Easy", "Which one is unlike the others?", ["Lamp", "Sun", "Moon", "Star"], "A", "Sun, moon, and star are natural celestial objects; a lamp is a human-made source."),
    nat("Analytical Reasoning", "Easy", "A worker earns ₹600 for 8 hours. What is the hourly rate in rupees?", 75, "Rate = 600 ÷ 8 = ₹75 per hour."),
    mcq("Analytical Reasoning", "Easy", "Which one is unlike the others?", ["Cylinder", "Sphere", "Cone", "Tumbler"], "A", "Cylinder, sphere, and cone are geometric solids; a tumbler is an everyday object."),
    nat("Analytical Reasoning", "Medium", "Two numbers are in the ratio 2 : 3 and their sum is 100. What is the smaller number?", 40, "Let the numbers be 2x and 3x. 2x + 3x = 100, so x = 20. The smaller is 40."),
    mcq("Analytical Reasoning", "Easy", "Which one is unlike the others?", ["Lion", "Tiger", "Leopard", "Deer"], "A", "Lion, tiger, and leopard are carnivores; deer is a herbivore.")
  ];

  var pattern = [
    nat("Pattern Recognition", "Easy", "What comes next in 2, 6, 18, 54?", 162, "Each term is 3 times the one before it. 54 × 3 = 162."),
    nat("Pattern Recognition", "Easy", "What comes next in 1, 4, 9, 16, 25?", 36, "The sequence is the set of perfect squares. Next is 6² = 36."),
    mcq("Pattern Recognition", "Easy", "Which sequence continues by adding 6 each time?", ["5, 11, 17, 23", "5, 10, 15, 20", "1, 4, 9, 16", "3, 8, 13, 18"], "A", "5, 11, 17, 23 is an arithmetic sequence with common difference 6."),
    nat("Pattern Recognition", "Medium", "A sequence increases by 2, 4, 6, 8. If the first term is 3, what is the 5th term?", 23, "The sequence becomes 3, 5, 9, 15, 23."),
    mcq("Pattern Recognition", "Easy", "Which sequence follows the rule 'double and add 1'?", ["1, 3, 7, 15", "1, 2, 3, 4", "2, 4, 6, 8", "5, 10, 15, 20"], "A", "Doubling and adding 1 to each term gives 1, 3, 7, 15."),
    mcq("Pattern Recognition", "Medium", "What is the next letter in the sequence A, C, F, J, O?", ["U", "P", "T", "R"], "A", "The gaps grow by one letter each time: +2, +3, +4, +5, +6."),
    nat("Pattern Recognition", "Easy", "What comes next in 1, 3, 6, 10, 15?", 21, "These are triangular numbers, adding 2, 3, 4, 5, then 6."),
    mcq("Pattern Recognition", "Easy", "Which sequence is a Fibonacci variant?", ["1, 1, 2, 3, 5, 8", "1, 2, 4, 8, 16", "1, 4, 9, 16, 25", "2, 4, 6, 8, 10"], "A", "In a Fibonacci sequence, each term is the sum of the two before it."),
    nat("Pattern Recognition", "Medium", "A geometric progression has first term 3 and ratio 2. What is its third term?", 12, "Third term = 3 × 2² = 12."),
    mcq("Pattern Recognition", "Easy", "Which sequence continues by multiplying by 2?", ["3, 6, 12, 24", "4, 9, 16, 25", "2, 5, 8, 11", "6, 12, 18, 24"], "A", "Multiplying 3 by 2 repeatedly gives 6, 12, 24.")
  ];

  var design = [
    mcq("Design Awareness", "Easy", "Which is the clearest way to show hierarchy in a document?", ["Larger headline, smaller body", "Random margins", "Same-size headings", "More images"], "A", "Clear hierarchy is easiest when headings are visibly larger than the body text."),
    mcq("Design Awareness", "Easy", "Which principle suggests grouping closely related items visually?", ["Proximity", "Continuity", "Closure", "Balance"], "A", "Proximity identifies related items by placing them closer to one another."),
    mcq("Design Awareness", "Easy", "Which is the direct way to make a button afford its action?", ["Make it look like a button", "Use a bright colour", "Add an animation", "Hide it in a menu"], "A", "Clear affordance is making the visual form suggest the expected action."),
    mcq("Design Awareness", "Medium", "Which research method is best for understanding a user's routine?", ["Contextual inquiry", "Survey", "A/B test", "Focus group"], "A", "Contextual inquiry observes a user in their own environment and routine."),
    mcq("Design Awareness", "Easy", "Which is a direct way to make a banner easier to read?", ["Increase contrast", "Reduce font weight", "Add more colour", "Blur the background"], "A", "Contrast improves legibility by separating text from background."),
    mcq("Design Awareness", "Easy", "Which principle helps a design feel unified?", ["Consistency", "Surprise", "Chaos", "Decoration"], "A", "Consistency in layout, typography, and colour creates unity."),
    mcq("Design Awareness", "Easy", "Which one is not a design principle?", ["Arbitrary decoration", "Alignment", "Repetition", "Proximity"], "A", "Alignment, repetition, and proximity are design principles; arbitrary decoration is not."),
    mcq("Design Awareness", "Medium", "Which is the best way to test if a design works?", ["Observe real users", "Ask your friends", "Count the pixels", "Match the competitor"], "A", "Observing users in context reveals whether a design actually works."),
    mcq("Design Awareness", "Easy", "Which matters most when choosing type for a card?", ["Legibility", "Fancy flourishes", "Many fonts", "Colour balance"], "A", "Legibility ensures the card's message is readable."),
    mcq("Design Awareness", "Easy", "Which is important when starting a design project?", ["Understand the problem", "Copy a trend", "Pick a colour", "Finish fast"], "A", "Understanding the problem first frames decisions that follow.")
  ];

  var numbers = [
    nat("Numerical Reasoning", "Easy", "What is 15% of 200?", 30, "15% of 200 = 0.15 × 200 = 30."),
    nat("Numerical Reasoning", "Easy", "What is 25% of 240?", 60, "25% is one quarter, so 240 ÷ 4 = 60."),
    nat("Numerical Reasoning", "Medium", "Two numbers are in the ratio 2 : 3 and their sum is 100. What is the smaller number?", 40, "Let the numbers be 2x and 3x. 2x + 3x = 100 gives x = 20, so the smaller is 40."),
    nat("Numerical Reasoning", "Easy", "A tap fills 60 litres in 20 minutes. What is its rate in litres per minute?", 3, "Rate = 60 ÷ 20 = 3 litres per minute."),
    nat("Numerical Reasoning", "Easy", "What is the mean of 4, 8, 12, 16, 20?", 12, "(4 + 8 + 12 + 16 + 20) ÷ 5 = 60 ÷ 5 = 12."),
    nat("Numerical Reasoning", "Medium", "A trader buys 10 shares at ₹500 each and sells at ₹600. What is the profit percentage?", 20, "Profit = ₹100 per share. 100/500 × 100 = 20%."),
    nat("Numerical Reasoning", "Easy", "A worker earns ₹600 for 8 hours. What is the hourly rate in rupees?", 75, "600 ÷ 8 = ₹75 per hour."),
    nat("Numerical Reasoning", "Easy", "A train covers 180 km in 4 hours. Its average speed is how many km per hour?", 45, "Speed = 180 ÷ 4 = 45 km/h.")
  ];

  var gk = [
    mcq("General Knowledge", "Easy", "Which Indian state is famous for Madhubani painting?", ["Bihar", "Kerala", "Odisha", "Gujarat"], "A", "Madhubani painting comes from the Mithila region of Bihar."),
    mcq("General Knowledge", "Easy", "Which Indian city is famous for lac bangles?", ["Jaipur", "Varanasi", "Kolkata", "Chennai"], "A", "Jaipur is famous for lac bangles."),
    mcq("General Knowledge", "Easy", "Which of these is a UNESCO World Heritage Site in Delhi?", ["Qutub Minar", "Hawa Mahal", "Gateway of India", "Charminar"], "A", "Qutub Minar is a UNESCO World Heritage Site in Delhi."),
    mcq("General Knowledge", "Easy", "Which city hosts the London Design Biennale?", ["London", "Paris", "New York", "Tokyo"], "A", "The London Design Biennale is held in London."),
    mcq("General Knowledge", "Easy", "Which country hosts the Milan Design Week?", ["Italy", "France", "Germany", "Japan"], "A", "Milan Design Week is held in Milan, Italy."),
    mcq("General Knowledge", "Easy", "Which city is associated with Indian blue pottery?", ["Jaipur", "Lucknow", "Dhaka", "Colombo"], "A", "Jaipur is a famous centre for blue pottery.")
  ];

  var observation = [
    nat("Observation", "Easy", "A 4 × 4 grid of dots contains how many dots?", 16, "4 rows × 4 columns = 16 dots."),
    nat("Observation", "Easy", "A 3 × 4 grid of small squares contains how many small squares?", 12, "3 rows × 4 columns = 12 squares."),
    nat("Observation", "Easy", "A grid of 5 rows and 5 columns has how many dots?", 25, "5 × 5 = 25 dots."),
    nat("Observation", "Easy", "A matchbox has 4 matchsticks visible in each row. How many matchsticks are visible in 3 rows?", 12, "4 matches per row × 3 rows = 12 matchsticks."),
    mcq("Observation", "Medium", "If a pattern repeats every 3 units, which of these segments extends it?", ["4, 5, 6", "7, 8, 9", "10, 11, 12", "3, 6, 9"], "A", "A repeat every 3 units continues in successive blocks of 3.")
  ];

  var language = [
    mcq("Language", "Easy", "Which word is closest in meaning to 'crisp'?", ["Sharp", "Wet", "Foggy", "Untidy"], "A", "Crisp is often used to mean sharp or precise."),
    mcq("Language", "Easy", "Which word is the opposite of 'humble'?", ["Arrogant", "Careful", "Quiet", "Polite"], "A", "Humble means modest; arrogant is its opposite."),
    mcq("Language", "Easy", "Which word is closest in meaning to 'detailed'?", ["Thorough", "Vague", "Limited", "Simple"], "A", "Detailed means showing much information, so thorough fits best."),
    mcq("Language", "Easy", "Which word is closest in meaning to 'intricate'?", ["Complex", "Simple", "Plain", "Basic"], "A", "Intricate means complex or elaborate."),
    mcq("Language", "Easy", "Which word is the opposite of 'brief'?", ["Lengthy", "Slight", "Subtle", "Plain"], "A", "Brief means short; lengthy is the opposite.")
  ];

  var culture = [
    mcq("Indian Culture", "Easy", "Which Indian state is famous for Channapatna lacquered wooden toys?", ["Karnataka", "Rajasthan", "Gujarat", "Odisha"], "A", "Channapatna in Karnataka is famous for lacquered wooden toys."),
    mcq("Indian Culture", "Easy", "Which state is famous for Kalamkari painting?", ["Andhra Pradesh", "Bihar", "Odisha", "Gujarat"], "A", "Kalamkari is a cloth painting tradition associated with Andhra Pradesh."),
    mcq("Indian Culture", "Easy", "Which Indian state is associated with the Kathak dance form?", ["Uttar Pradesh", "Kerala", "Manipur", "Odisha"], "A", "Kathak is a classical dance form rooted in North India, particularly Uttar Pradesh."),
    mcq("Indian Culture", "Easy", "Which Indian state's folk art is Madhubani?", ["Bihar", "Kerala", "Odisha", "Gujarat"], "A", "Madhubani is a folk art tradition from the Mithila region of Bihar.")
  ];

  var type = [
    mcq("Typography", "Easy", "Which family of typefaces is generally easiest for long body text?", ["Serif", "Display", "Script", "Decorative"], "A", "Serif faces have small strokes that guide the eye along lines of text."),
    mcq("Typography", "Easy", "Which family of typefaces is generally used for headings?", ["Sans-serif", "Serif", "Script", "Cursive"], "A", "Sans-serif faces are common for headings because of their clean and sharp look."),
    mcq("Typography", "Easy", "Which of these is not a common typeface family?", ["Clay", "Serif", "Sans-serif", "Script"], "A", "Serif, sans-serif, and script are common typeface families; clay is a material."),
    mcq("Typography", "Easy", "Which term describes letters without serifs?", ["Sans-serif", "Serif", "Bold", "Italic"], "A", "Sans (French for 'without') serif describes letters without the small finishing strokes.")
  ];

  var history = [
    mcq("Design History", "Easy", "Who founded the Bauhaus school?", ["Walter Gropius", "Zaha Hadid", "Le Corbusier", "Mies van der Rohe"], "A", "Walter Gropius founded the Bauhaus in Weimar in 1919."),
    mcq("Design History", "Medium", "Which design movement is associated with 'form follows function'?", ["Chicago School", "Art Nouveau", "Bauhaus", "Art Deco"], "A", "The Chicago School architecture movement is commonly linked to 'form follows function'."),
    mcq("Design History", "Easy", "Which movement uses a strong grid and primary colour blocks?", ["De Stijl", "Art Nouveau", "Gothic", "Rococo"], "A", "De Stijl uses simple shapes, strong grids, and primary colours.")
  ];

  var colour = [
    mcq("Colour Theory", "Easy", "Which pair are complementary colours?", ["Red & cyan", "Blue & purple", "Yellow & orange", "Green & teal"], "A", "Complementary colours sit opposite each other on the colour wheel."),
    mcq("Colour Theory", "Easy", "Which pair are analogous colours?", ["Blue & violet", "Red & cyan", "Yellow & purple", "White & black"], "A", "Analogous colours sit next to each other on the colour wheel."),
    mcq("Colour Theory", "Medium", "Which set is a triadic colour scheme?", ["Red, yellow, blue", "Red, orange, purple", "Blue, cyan, violet", "Green, teal, olive"], "A", "A triadic scheme uses three colours spaced evenly around the colour wheel.")
  ];

  var english = [
    mcq("English", "Easy", "Which word is the opposite of 'scarcity'?", ["Abundance", "Fine", "Increase", "Light"], "A", "Scarcity means a lack of something; abundance is a plentiful supply.")
  ];

  var materials = [
    mcq("Materials", "Easy", "Which material is usually a good thermal insulator?", ["Wool", "Copper", "Aluminium", "Steel"], "A", "Wool traps air, which makes it a good thermal insulator.")
  ];

  window.PRACTICE_BANK.push.apply(window.PRACTICE_BANK, [].concat(spatial, visual, analytical, pattern, design, numbers, gk, observation, language, culture, type, history, colour, english, materials));
})();
