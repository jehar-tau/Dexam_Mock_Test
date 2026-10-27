/* Original topic-drill batch 1. Adds practice questions across all four exams.
   Every question is original; marks and negatives follow each exam's pattern. */

(function () {
  var seq = 0;

  function drill(examId, type, topic, difficulty, prompt, options, correctAnswer, solution, marks, negative) {
    seq += 1;
    return {
      id: examId + "-drill-b1-" + seq,
      examId: examId,
      type: type,
      topic: topic,
      difficulty: difficulty,
      marks: marks || (type === "NAT" ? 4 : examId === "nift" ? 1 : 3),
      negative: negative === undefined ? 0 : negative,
      prompt: prompt,
      options:
        options && options.length ? options.map(function (text, index) { return { id: "ABCDEFGH"[index], text: text }; }) : undefined,
      correctAnswer: correctAnswer,
      solution: solution,
      source: "original",
      licence: "owned",
      status: "published",
      version: "1"
    };
  }

  function mcq(examId, topic, difficulty, prompt, options, correctAnswer, solution) {
    return drill(examId, "MCQ", topic, difficulty, prompt, options, correctAnswer, solution);
  }

  function nat(examId, topic, difficulty, prompt, answer, solution) {
    return drill(examId, "NAT", topic, difficulty, prompt, undefined, answer, solution);
  }

  function msq(examId, topic, difficulty, prompt, options, correctAnswer, solution) {
    return drill(examId, "MSQ", topic, difficulty, prompt, options, correctAnswer, solution);
  }

  var uceed = [
    mcq("uceed", "Colour Theory", "Easy", "Which pair are complementary colours?", ["Red & cyan", "Blue & purple", "Yellow & orange", "Green & teal"], "A", "Complementary colours sit opposite each other on the colour wheel. Red and cyan are opposite."),
    nat("uceed", "Numerical Reasoning", "Easy", "What is 15% of 200?", 30, "15% of 200 is 0.15 × 200 = 30."),
    mcq("uceed", "Design Awareness", "Easy", "Which is the most direct way to reduce cognitive load on a first screen?", ["Fewer choices", "Bigger logo", "More animations", "Longer text"], "A", "Fewer choices mean less processing for the user, which reduces cognitive load."),
    mcq("uceed", "Materials", "Easy", "Which of these is a natural fibre?", ["Cotton", "Polyester", "Nylon", "Acrylic"], "A", "Cotton is a natural plant-based fibre. Polyester, nylon, and acrylic are synthetic."),
    nat("uceed", "Observation", "Easy", "A 4 × 4 grid of dots contains how many dots?", 16, "A 4 × 4 grid has 4 rows × 4 columns = 16 dots."),
    mcq("uceed", "Visual Reasoning", "Easy", "Which Gestalt principle explains why a dotted outline can still be read as a full shape?", ["Closure", "Contrast", "Proximity", "Continuity"], "A", "Closure is the tendency to complete a familiar figure when the outline is incomplete."),
    mcq("uceed", "Analytical Reasoning", "Easy", "Which one is unlike the others?", ["Brown", "Copper", "Aluminium", "Iron"], "A", "Copper, aluminium, and iron are metals. Brown is a colour, not a metal."),
    nat("uceed", "Numerical Reasoning", "Medium", "A 30 cm × 20 cm rectangle is scaled up uniformly by 150%. What is its new area?", 1350, "Original area is 600 cm². Uniform scaling by 150% multiplies area by 2.25, giving 1350 cm²."),
    mcq("uceed", "Typography", "Easy", "Which family of typefaces is generally easiest for long body text?", ["Serif", "Display", "Script", "Decorative"], "A", "Serif faces use small strokes that guide the eye along lines of text, which helps readability."),
    nat("uceed", "Spatial Reasoning", "Easy", "How many faces does a triangular prism have?", 5, "A triangular prism has 2 triangular ends and 3 rectangular sides, so 5 faces."),
    mcq("uceed", "Visual Reasoning", "Medium", "Which of these gives the clearest figure-ground separation?", ["Strong contrast", "Thin outlines", "Wider margins", "Repeated textures"], "A", "Contrast makes the foreground object stand out against the background, creating a clear figure-ground split."),
    mcq("uceed", "Indian Culture", "Easy", "Which Indian region is known for Pashmina shawls?", ["Kashmir", "Gujarat", "Kerala", "Manipur"], "A", "Pashmina is a fine wool tradition from Kashmir."),
    mcq("uceed", "General Knowledge", "Easy", "Which city is home to the Srishti Institute of Art, Design and Technology?", ["Bengaluru", "Pune", "Kolkata", "Guwahati"], "A", "Srishti is a well-known design institute in Bengaluru."),
    nat("uceed", "Analytical Reasoning", "Easy", "A train travels 180 km in 3 hours. Its average speed is what value in km per hour?", 60, "Speed = distance ÷ time = 180 ÷ 3 = 60 km/h."),
    mcq("uceed", "Pattern Recognition", "Easy", "What comes next in 2, 6, 18, 54?", ["162", "243", "108", "216"], "A", "Each term is 3 times the previous one. 54 × 3 = 162."),
    mcq("uceed", "Language", "Easy", "Which word is closest in meaning to 'eclectic'?", ["Varied", "Rigid", "Colourful", "Single-minded"], "A", "Anyone eclectic draws from many sources, so 'varied' fits best."),
    mcq("uceed", "Design History", "Easy", "Who founded the Bauhaus school?", ["Walter Gropius", "Zaha Hadid", "Le Corbusier", "Mies van der Rohe"], "A", "Walter Gropius founded the Bauhaus in Weimar in 1919."),
    nat("uceed", "Analytical Reasoning", "Medium", "The Fibonacci sequence begins 1, 1, 2, 3, 5, 8. What is the next term?", 13, "Each term is the sum of the two before it: 5 + 8 = 13."),
    nat("uceed", "Analytical Reasoning", "Medium", "Two taps fill a tank in 12 minutes and 6 minutes respectively. Working together, how many minutes do they need to fill it once?", 4, "Their combined rate is 1/12 + 1/6 = 1/4 tank per minute, so together they take 4 minutes."),
    mcq("uceed", "Pattern Recognition", "Easy", "Which sequence continues by adding 4 each time?", ["3, 7, 11, 15", "3, 6, 9, 12", "3, 8, 16, 32", "4, 16, 64, 256"], "A", "3, 7, 11, 15 is an arithmetic sequence with common difference 4."),
    mcq("uceed", "Design Awareness", "Easy", "Which principle helps users spot the most important element on a screen?", ["Hierarchy", "Symmetry", "Continuity", "Closure"], "A", "Hierarchy gives visual weight to the most important element and guides the eye there first."),
    nat("uceed", "Numerical Reasoning", "Easy", "What is the mean of 12, 15, 18, 21, 24?", 18, "(12 + 15 + 18 + 21 + 24) ÷ 5 = 90 ÷ 5 = 18."),
    mcq("uceed", "Pattern Recognition", "Easy", "What comes next in 1, 4, 9, 16, 25?", ["36", "30", "49", "27"], "A", "The sequence is the set of perfect squares. The next one is 6² = 36."),
    mcq("uceed", "Spatial Reasoning", "Easy", "Which of these is not a polygon?", ["Circle", "Hexagon", "Pentagon", "Square"], "A", "A circle has no straight sides, so it is not a polygon."),
    mcq("uceed", "General Knowledge", "Easy", "Which Indian state celebrates Pongal?", ["Tamil Nadu", "Kerala", "Odisha", "Gujarat"], "A", "Pongal is a harvest festival associated with Tamil Nadu."),
    nat("uceed", "Spatial Reasoning", "Medium", "A cuboid measures 3 cm × 4 cm × 5 cm. What is its total surface area in cm²?", 94, "2 × (12 + 20 + 15) = 2 × 47 = 94 cm²."),
    mcq("uceed", "Colour Theory", "Easy", "Which colour is generally considered the coolest?", ["Blue", "Red", "Yellow", "Purple"], "A", "Blue is a cool colour on the colour-temperature axis, while red and yellow are warm."),
    nat("uceed", "Observation", "Easy", "A shelf holds 5 visible books on each of 3 shelves. How many books are visible?", 15, "5 books per shelf × 3 shelves = 15 visible books."),
    mcq("uceed", "Design Awareness", "Easy", "Which is the most direct way to help a first-time user in a mobile app?", ["Short onboarding tour", "More animations", "Sharper font", "Brighter colours"], "A", "A short onboarding tour helps the user understand what to do first, which reduces entry friction."),
    mcq("uceed", "Visual Reasoning", "Medium", "Which principle makes the eye follow a smooth path across a layout?", ["Continuity", "Similarity", "Closure", "Balance"], "A", "Continuity makes the eye follow a line or curve, even when other elements break the path."),
    mcq("uceed", "Spatial Reasoning", "Easy", "Which shape has rotational symmetry of order 4?", ["Square", "Equilateral triangle", "Regular pentagon", "Circle"], "A", "A square maps to itself four times in a full rotation."),
    nat("uceed", "Numerical Reasoning", "Medium", "A rectangle has perimeter 30 cm and width 5 cm. What is its length?", 10, "Perimeter = 2(length + width). 30 = 2(length + 5), so length = 10 cm."),
    msq("uceed", "Design Awareness", "Medium", "Which of these are core usability principles?", ["Predictable actions", "Clear navigation", "Fast load", "Arbitrary colour rotation"], ["A", "B", "C"], "Predictability, clear navigation, and fast loading are usability fundamentals. Arbitrary colour rotation is not."),
    mcq("uceed", "Language", "Easy", "Which word is the opposite of 'verbose'?", ["Concise", "Colourful", "Detailed", "Foggy"], "A", "Verbose means using many words; concise means using few."),
    mcq("uceed", "Typography", "Easy", "Which typeface is traditionally used for long print body text?", ["Serif", "Pyramid", "Brick", "Outline"], "A", "Serif faces remain a classic choice for long passages because the small strokes guide the eye."),
    nat("uceed", "Pattern Recognition", "Easy", "What comes next in 4, 9, 16, 25?", 36, "The pattern is perfect squares. The next perfect square after 25 is 36."),
    mcq("uceed", "General Knowledge", "Easy", "Which city is home to NIFT headquarters?", ["New Delhi", "Ahmedabad", "Chennai", "Surat"], "A", "NIFT's central administration is in New Delhi."),
    mcq("uceed", "Materials", "Easy", "Which material is usually a good electrical insulator?", ["Wood", "Copper", "Aluminium", "Steel"], "A", "Wood does not conduct electricity, unlike copper, aluminium, or steel."),
    mcq("uceed", "Colour Theory", "Easy", "Which pair are analogous colours?", ["Blue & violet", "Red & cyan", "Yellow & purple", "White & black"], "A", "Analogous colours sit next to each other on the colour wheel. Blue and violet are adjacent."),
    mcq("uceed", "Spatial Reasoning", "Easy", "Which of these is not a prism?", ["Cone", "Cube", "Triangular prism", "Hexagonal prism"], "A", "A cone tapers to a point, so it is not a prism."),
    nat("uceed", "Numerical Reasoning", "Medium", "A tap fills 60 litres in 15 minutes. Its rate is how many litres per minute?", 4, "Rate = volume ÷ time = 60 ÷ 15 = 4 litres per minute."),
    mcq("uceed", "Visual Reasoning", "Easy", "Which of these is an example of an optical illusion?", ["After-image", "Serif", "Pyramid", "Plain text"], "A", "An after-image appears when a strong stimulus is followed by a neutral surround."),
    nat("uceed", "Analytical Reasoning", "Medium", "A car covers 240 km in 4 hours. Its average speed is how many km per hour?", 60, "Speed = 240 ÷ 4 = 60 km/h.")
  ];

  var ceed = [
    nat("ceed", "Spatial Reasoning", "Medium", "A 3 × 3 × 3 cube is painted on all faces and cut into 27 unit cubes. How many unit cubes have exactly one painted face?", 6, "Only the 6 face-centre unit cubes have exactly one painted face."),
    mcq("ceed", "Design Awareness", "Easy", "Which is the clearest way to show hierarchy in a brochure?", ["Larger headline, smaller body", "Random margins", "Same-size headings", "More images"], "A", " hierarchy is clearest when key headings are visibly larger and body text is smaller."),
    mcq("ceed", "Visual Reasoning", "Easy", "Which Gestalt principle is strongest when related items share a colour?", ["Similarity", "Proximity", "Closure", "Balance"], "A", "Similarity makes the eye group items that share colour, shape, or texture."),
    nat("ceed", "Analytical Reasoning", "Easy", "A car covers 240 km in 4 hours. Its average speed is how many km per hour?", 60, "Speed = 240 ÷ 4 = 60 km/h."),
    nat("ceed", "Pattern Recognition", "Easy", "What comes next in 2, 6, 18, 54?", 162, "Each term is 3 times the one before it. 54 × 3 = 162."),
    nat("ceed", "Numerical Reasoning", "Easy", "A shopkeeper sells 240 pencils at ₹5 each. Total revenue is how many rupees?", 1200, "Revenue = 240 × 5 = ₹1200."),
    nat("ceed", "Observation", "Easy", "A grid of 3 × 3 small squares contains how many small squares?", 9, "3 rows × 3 columns = 9 small squares."),
    mcq("ceed", "Typography", "Easy", "Which typeface is traditionally used for long print body text?", ["Serif", "Pyramid", "Brick", "Outline"], "A", "Serif type helps the eye track across lines of text, so it is a classic long-read choice."),
    mcq("ceed", "General Knowledge", "Easy", "Which city hosts Milan Design Week?", ["Milan", "Paris", "Berlin", "Tokyo"], "A", "Milan Design Week is held in Milan each April."),
    mcq("ceed", "Indian Culture", "Easy", "Which Indian state is famous for Channapatna wooden toys?", ["Karnataka", "Rajasthan", "Gujarat", "Odisha"], "A", "Channapatna is famous for lacquered wooden toys and is in Karnataka."),
    mcq("ceed", "Design History", "Easy", "Which movement is known for a strong grid and bold white space?", ["Bauhaus", "Art Nouveau", "Rococo", "Gothic"], "A", "The Bauhaus style is recognised for simple geometry, strong grids, and generous white space."),
    mcq("ceed", "Language", "Easy", "Which word is closest in meaning to 'explicit'?", ["Clear", "Vague", "Distant", "Ancient"], "A", "Explicit information is clearly stated; vague information is not."),
    mcq("ceed", "Materials", "Easy", "Which material is typically the most elastic?", ["Rubber", "Steel", "Wood", "Marble"], "A", "Rubber deforms significantly and returns to shape, making it the most elastic of the options."),
    mcq("ceed", "Colour Theory", "Easy", "Which of these is a triadic colour scheme?", ["Red, yellow, blue", "Red, orange, purple", "Blue, cyan, violet", "Green, teal, olive"], "A", "Triadic colour schemes use three colours spaced evenly around the colour wheel."),
    mcq("ceed", "Design Awareness", "Easy", "Which is the best direct action to make a data-entry form easy to fill?", ["Label each field clearly", "Remove all labels", "Make all text red", "Add background music"], "A", "Clear labels tell users exactly what each field wants."),
    mcq("ceed", "Visual Reasoning", "Easy", "Which of these makes a figure-ground split hard to read?", ["Low contrast background", "Larger headline", "More white space", "Bold heading"], "A", "Low contrast makes the object and background blur together, hurting figure-ground separation."),
    nat("ceed", "Analytical Reasoning", "Easy", "A train covers 120 km in 2 hours. Its average speed is how many km per hour?", 60, "Speed = 120 ÷ 2 = 60 km/h."),
    mcq("ceed", "Pattern Recognition", "Easy", "Which sequence follows the rule 'multiply by 2'?", ["3, 6, 12, 24", "3, 7, 11, 15", "4, 10, 16, 22", "5, 10, 15, 20"], "A", "Multiplying 3 by 2 repeatedly gives 6, then 12, then 24."),
    nat("ceed", "Spatial Reasoning", "Medium", "A trapezium has parallel sides 4 cm and 10 cm. Its height is 3 cm. What is its area in cm²?", 21, "Area = ½ × (sum of parallel sides) × height = ½ × 14 × 3 = 21 cm²."),
    nat("ceed", "Analytical Reasoning", "Easy", "A train covers 180 km in 3 hours. Its average speed is how many km per hour?", 60, "Speed = 180 ÷ 3 = 60 km/h."),
    mcq("ceed", "Pattern Recognition", "Easy", "Which sequence continues by adding 5 each time?", ["5, 10, 15, 20", "4, 9, 16, 25", "2, 6, 12, 24", "3, 9, 27, 81"], "A", "The sequence 5, 10, 15, 20 has a common difference of 5."),
    nat("ceed", "Numerical Reasoning", "Easy", "A tap fills 60 litres in 20 minutes. Its rate is how many litres per minute?", 3, "Rate = 60 ÷ 20 = 3 litres per minute."),
    mcq("ceed", "Design Awareness", "Easy", "Which of these helps a user finish one task on a screen?", ["Simplified screen layout", "Faster animation", "More navigation items", "Brighter colours"], "A", "A simplified layout makes the primary task visually obvious and easier to complete."),
    mcq("ceed", "Spatial Reasoning", "Easy", "Which 3D shape has only a curved surface and no straight edges?", ["Sphere", "Cylinder", "Cone", "Cuboid"], "A", "A sphere is curved throughout, with no straight edges."),
    nat("ceed", "Observation", "Easy", "A 3 × 5 grid of dots contains how many dots?", 15, "3 rows × 5 columns = 15 dots."),
    mcq("ceed", "General Knowledge", "Easy", "Which country hosts the London Design Biennale?", ["United Kingdom", "Italy", "France", "Germany"], "A", "The London Design Biennale is held in the United Kingdom."),
    mcq("ceed", "Indian Culture", "Easy", "Which Indian state is known for Kalamkari painting?", ["Andhra Pradesh", "Bihar", "Odisha", "Gujarat"], "A", "Kalamkari cloth painting is associated with Andhra Pradesh."),
    mcq("ceed", "Design History", "Easy", "Which movement is characterised by strong grids and primary colours?", ["Bauhaus", "Art Nouveau", "Rococo", "Gothic"], "A", "The Bauhaus style relied on simple geometry, strong grids, and primary colours."),
    mcq("ceed", "Language", "Easy", "Which word is closest in meaning to 'concise'?", ["Terse", "Colourful", "Detailed", "Foggy"], "A", "Concise writing is brief and says as much as possible in few words."),
    mcq("ceed", "Materials", "Easy", "Which of these is a good thermal insulator?", ["Wool", "Copper", "Aluminium", "Steel"], "A", "Wool traps air, which makes it a good insulator."),
    mcq("ceed", "Colour Theory", "Easy", "Which pair are analogous colours?", ["Blue & violet", "Red & cyan", "Yellow & purple", "White & black"], "A", "Analogous colours sit next to each other on the wheel. Blue and violet are adjacent."),
    mcq("ceed", "Typography", "Easy", "Which category of typeface uses small horizontal strokes at the ends of letters?", ["Serif", "Sans-serif", "Slate", "Marble"], "A", "Serif typefaces have small finishing strokes at the ends of strokes."),
    mcq("ceed", "Visual Reasoning", "Medium", "Which of these creates an after-image effect?", ["Bright stimulus followed by a neutral surround", "Repeated small pattern", "A thin stroke", "A large heading"], "A", "An after-image appears when a strong stimulus is followed by a neutral or dull surround.")
  ];

  var nift = [
    mcq("nift", "English", "Easy", "Which word is the opposite of 'objective'?", ["Biased", "Fair", "Clear", "Simple"], "A", "Objective means impartial; biased means unfairly influenced."),
    mcq("nift", "English", "Easy", "Which word is closest in meaning to 'meticulous'?", ["Careful", "Careless", "Distant", "Loud"], "A", "Meticulous work is very careful and thorough."),
    mcq("nift", "English", "Easy", "Which word is closest in meaning to 'vulgar'?", ["Coarse", "Refined", "Formal", "Poetic"], "A", "Vulgar means crude or coarse."),
    mcq("nift", "English", "Easy", "Which word is closest in meaning to 'quaint'?", ["Charming", "Modern", "Massive", "Distant"], "A", "Quaint means attractively old-fashioned or charming."),
    mcq("nift", "English", "Easy", "What does 'evocative' usually mean?", ["Suggestive", "Irrelevant", "Bright", "Strict"], "A", "Evocative means it calls up memories or feelings."),
    mcq("nift", "English", "Easy", "Which word is the opposite of 'diligent'?", ["Lazy", "Careful", "Patient", "Brave"], "A", "Diligent means hard-working; lazy is the opposite."),
    mcq("nift", "English", "Easy", "Which word is closest in meaning to 'incandescent'?", ["Glowing", "Dull", "Dark", "Frozen"], "A", "Incandescent means giving off bright light."),
    nat("nift", "Quantitative Aptitude", "Easy", "What is 25% of 240?", 60, "25% is one quarter, so 240 ÷ 4 = 60."),
    nat("nift", "Quantitative Aptitude", "Easy", "A 1 kg mixture is 40% rice and 60% wheat. How much wheat is in 3 kg of the same mix?", 1.8, "Wheat is 60% of 3 kg = 1.8 kg."),
    nat("nift", "Quantitative Aptitude", "Medium", "A rectangle has perimeter 28 cm and width 6 cm. What is its length in cm?", 8, "Perimeter = 2(length + width). 28 = 2(length + 6), so length = 8 cm."),
    nat("nift", "Quantitative Aptitude", "Medium", "A shopkeeper buys at ₹120 and sells at ₹144. What is the profit percentage?", 20, "Profit = ₹24. Profit% = 24/120 × 100 = 20%."),
    nat("nift", "Quantitative Aptitude", "Easy", "A train covers 180 km in 3 hours. Its average speed is how many km per hour?", 60, "Speed = 180 ÷ 3 = 60 km/h."),
    mcq("nift", "General Knowledge", "Easy", "Which week is celebrated in Milan each April?", ["Milan Design Week", "Milan Art Week", "Italy Fashion Cup", "Rome Design Week"], "A", "Milan Design Week takes place in Milan every April."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian state is famous for Channapatna wooden toys?", ["Karnataka", "Rajasthan", "Gujarat", "Odisha"], "A", "Channapatna is in Karnataka and is known for lacquered wooden toys."),
    mcq("nift", "General Knowledge", "Easy", "Which country hosts the London Design Biennale?", ["United Kingdom", "Italy", "France", "Germany"], "A", "The London Design Biennale takes place in the United Kingdom."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian monument is known for intricate marble lattice work?", ["Taj Mahal", "Hampi", "Ellora", "Sanchi Stupa"], "A", "The Taj Mahal features fine marble latticework."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian state is famous for Banarasi sarees?", ["Uttar Pradesh", "Karnataka", "Gujarat", "Odisha"], "A", "Banarasi sarees come from Varanasi, in Uttar Pradesh."),
    mcq("nift", "Language", "Easy", "Which word is closest in meaning to 'incandescent'?", ["Glowing", "Dull", "Dark", "Frozen"], "A", "Incandescent means brightly glowing."),
    mcq("nift", "Language", "Easy", "Which word is the opposite of 'modest'?", ["Extravagant", "Careful", "Quiet", "Humble"], "A", "Modest means restrained; extravagant is opposite."),
    mcq("nift", "Analytical Reasoning", "Easy", "Which one is unlike the others?", ["Deer", "Lion", "Tiger", "Leopard"], "A", "Lion, tiger, and leopard are carnivores; deer is a herbivore."),
    mcq("nift", "Analytical Reasoning", "Easy", "If P is faster than Q, and Q is faster than R, who is the slowest?", ["R", "P", "Q", "Impossible to say"], "A", "P > Q > R means R is slowest."),
    mcq("nift", "Pattern Recognition", "Easy", "What comes next in 2, 6, 18, 54?", ["162", "108", "216", "243"], "A", "Each term is 3 times the one before it. 54 × 3 = 162."),
    mcq("nift", "Indian Culture", "Easy", "Which of these is a UNESCO World Heritage Site in Delhi?", ["Qutub Minar", "Hawa Mahal", "Gateway of India", "Charminar"], "A", "Qutub Minar is in Delhi and is a UNESCO World Heritage Site."),
    mcq("nift", "Fashion & Textile", "Easy", "Which fibre is usually the base for denim?", ["Cotton", "Nylon", "Silk", "Acrylic"], "A", "Denim is traditionally made from cotton yarn."),
    mcq("nift", "Fashion & Textile", "Easy", "Which city is famous for Banarasi sarees?", ["Varanasi", "Jaipur", "Lucknow", "Patna"], "A", "Banarasi sarees are named after Varanasi (Banaras)."),
    mcq("nift", "Fashion & Textile", "Easy", "Which Indian city grew as a major textile mill centre?", ["Ahmedabad", "Shimla", "Indore", "Nagpur"], "A", "Ahmedabad became a major textile mill centre and is sometimes called the Manchester of India."),
    mcq("nift", "Colour Theory", "Easy", "Which set is the additive primary colours?", ["Red, green, blue", "Red, yellow, blue", "Blue, orange, purple", "Green, cyan, magenta"], "A", "Additive primaries are red, green, and blue."),
    mcq("nift", "Design History", "Easy", "Which movement is famous for grids and primary colour blocks?", ["Bauhaus", "Art Nouveau", "Rococo", "Gothic"], "A", "The Bauhaus used simple geometry, strong grids, and bold primary colours."),
    mcq("nift", "Materials", "Easy", "Which of these is a synthetic fibre?", ["Nylon", "Cotton", "Wool", "Linen"], "A", "Nylon is man-made; cotton, wool, and linen are natural.")
  ];

  var nid = [
    mcq("nid", "General Knowledge", "Easy", "Which Indian state is famous for Banarasi sarees?", ["Uttar Pradesh", "Karnataka", "Gujarat", "Odisha"], "A", "Banarasi sarees are known for Varanasi, which is in Uttar Pradesh."),
    mcq("nid", "General Knowledge", "Easy", "Which Indian state is famous for Channapatna wooden toys?", ["Karnataka", "Rajasthan", "Gujarat", "Odisha"], "A", "Channapatna is famous for lacquered wooden toys and is in Karnataka."),
    mcq("nid", "General Knowledge", "Easy", "Which city hosts the London Design Biennale?", ["London", "New York", "Tokyo", "Paris"], "A", "The London Design Biennale is held in London."),
    mcq("nid", "General Knowledge", "Easy", "Which country hosts the Milan Design Week?", ["Italy", "France", "Germany", "Japan"], "A", "Milan Design Week takes place in Italy."),
    mcq("nid", "General Knowledge", "Easy", "Which Indian state is associated with Madhubani painting?", ["Bihar", "Kerala", "Odisha", "Manipur"], "A", "Madhubani painting is a folk art form associated with Bihar."),
    mcq("nid", "Analytical Reasoning", "Easy", "Which one is unlike the others?", ["Deer", "Lion", "Tiger", "Leopard"], "A", "Lion, tiger, and leopard are carnivores; deer is a herbivore."),
    mcq("nid", "Analytical Reasoning", "Easy", "If P is faster than Q, and Q is faster than R, who is the slowest?", ["R", "P", "Q", "Impossible to tell"], "A", "P > Q > R means R is slowest."),
    mcq("nid", "Analytical Reasoning", "Easy", "What comes next in 2, 6, 18, 54?", ["162", "108", "216", "243"], "A", "Each term is 3 times the one before it. 54 × 3 = 162."),
    mcq("nid", "Design Awareness", "Easy", "Which is the clearest way to show hierarchy in a brochure?", ["Larger headline, smaller body", "Random margins", "Same-size headings", "More images"], "A", "Clear hierarchy is easiest when headings are larger and body text is smaller."),
    mcq("nid", "Design Awareness", "Easy", "Which is the best direct action to make a form easy to complete?", ["Label each field clearly", "Add music", "Remove all labels", "Make text red everywhere"], "A", "Clear labels tell the user what each field requires."),
    mcq("nid", "Design Awareness", "Easy", "Which is the most direct way to reduce cognitive load on a first screen?", ["Fewer choices", "More animation", "Bigger logo", "More text"], "A", "Fewer options lighten the user's processing burden."),
    nat("nid", "Spatial Reasoning", "Easy", "How many faces does a triangular prism have?", 5, "2 triangular ends plus 3 rectangular sides = 5 faces."),
    mcq("nid", "Spatial Reasoning", "Easy", "Which of these is not a polyhedron?", ["Cone", "Cube", "Icosahedron", "Tetrahedron"], "A", "A cone has a curved surface, so it is not a polyhedron."),
    nat("nid", "Spatial Reasoning", "Medium", "A 3 × 3 × 3 cube is painted on all faces and cut into 27 unit cubes. How many unit cubes have exactly one painted face?", 6, "Only the face-centre cube of each of the 6 faces has one painted face."),
    mcq("nid", "Pattern Recognition", "Easy", "What comes next in 1, 4, 9, 16, 25?", ["36", "30", "49", "27"], "A", "The sequence is perfect squares: 1², 2², 3², 4², 5², then 6² = 36."),
    mcq("nid", "Pattern Recognition", "Easy", "Which sequence follows the rule 'multiply by 2'?", ["3, 6, 12, 24", "3, 7, 11, 15", "4, 10, 16, 22", "5, 10, 15, 20"], "A", "Multiplying each term by 2 gives 3, 6, 12, 24."),
    mcq("nid", "Indian Culture", "Easy", "Which Indian state is famous for Kalamkari painting?", ["Andhra Pradesh", "Bihar", "Odisha", "Gujarat"], "A", "Kalamkari is a cloth painting tradition associated with Andhra Pradesh."),
    mcq("nid", "Colour Theory", "Easy", "Which colour is generally considered the coolest?", ["Blue", "Red", "Yellow", "Purple"], "A", "Blue is a cool colour on the colour-temperature axis."),
    nat("nid", "Numerical Reasoning", "Easy", "What is 15% of 200?", 30, "15% of 200 = 0.15 × 200 = 30.")
  ];

  window.DRILLS_BATCH_1 = [].concat(uceed, ceed, nift, nid);
  window.PRACTICE_BANK.push.apply(window.PRACTICE_BANK, window.DRILLS_BATCH_1);
})();
