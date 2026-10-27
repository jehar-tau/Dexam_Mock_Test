/* Original topic-drill batch 3.
   Adds more practice questions across UCEED, CEED, NIFT and NID UG. */

(function () {
  var seq = 0;

  function drill(examId, type, topic, difficulty, prompt, options, correctAnswer, solution, marks, negative) {
    seq += 1;
    var defaultMarks =
      type === "NAT" ? 4 :
        examId === "uceed" || examId === "ceed" ? 3 :
          1;
    var defaultNegative =
      examId === "uceed"
        ? (type === "NAT" ? 0 : type === "MSQ" ? 1 : 0.71)
        : examId === "ceed"
          ? (type === "NAT" ? 0 : type === "MSQ" ? 1 : 0.5)
          : examId === "nift"
            ? 0.25
            : 0;

    return {
      id: examId + "-drill-b3-" + seq,
      examId: examId,
      type: type,
      topic: topic,
      difficulty: difficulty,
      marks: marks || defaultMarks,
      negative: negative === undefined ? defaultNegative : negative,
      prompt: prompt,
      options:
        options && options.length ? options.map(function (text, index) { return { id: "ABCDEFGH"[index], text: text }; }) : undefined,
      correctAnswer: correctAnswer,
      solution: solution,
      source: "original",
      licence: "owned",
      status: "published",
      version: "3"
    };
  }

  function mcq(examId, topic, difficulty, prompt, options, correctAnswer, solution, marks, negative) {
    return drill(examId, "MCQ", topic, difficulty, prompt, options, correctAnswer, solution, marks, negative);
  }

  function nat(examId, topic, difficulty, prompt, answer, solution, marks, negative) {
    return drill(examId, "NAT", topic, difficulty, prompt, undefined, answer, solution, marks, negative);
  }

  function msq(examId, topic, difficulty, prompt, options, correctAnswer, solution, marks, negative) {
    return drill(examId, "MSQ", topic, difficulty, prompt, options, correctAnswer, solution, marks, negative);
  }

  var uceed = [
    nat("uceed", "Spatial Reasoning", "Easy", "A cylinder has radius 7 cm and height 10 cm. What is its volume in cm³?", 1540, "Volume = πr²h = (22/7) × 49 × 10 = 1540 cm³."),
    nat("uceed", "Spatial Reasoning", "Easy", "A cuboid measures 5 cm × 4 cm × 3 cm. How many edges does it have?", 12, "A cuboid has 12 edges."),
    mcq("uceed", "Visual Reasoning", "Easy", "Which change most improves legibility of a sign seen from a distance?", ["Increase contrast and size", "Add decorative patterns", "Use lighter print", "Rotate the text"], "A", "Higher contrast and larger type make signs easier to read from far away."),
    mcq("uceed", "Design Awareness", "Easy", "Which change most helps a poster be readable quickly?", ["Add clear visual hierarchy", "Add more decorative frills", "Use smaller text", "Add more colours"], "A", "Visual hierarchy organises elements so the eye can scan them in order of importance."),
    nat("uceed", "Numerical Reasoning", "Easy", "What is the average of the first 10 positive even numbers?", 11, "The first 10 positive even numbers are 2 to 20. Their sum is 110, so the average is 11."),
    mcq("uceed", "Pattern Recognition", "Easy", "Which number is the odd one out: 2, 3, 5, 7, 9, 11?", ["9", "7", "5", "3"], "A", "The other numbers are prime. 9 = 3 × 3 is not prime."),
    nat("uceed", "Observation", "Easy", "A 4 × 4 grid of equal squares contains how many small 1 × 1 squares?", 16, "4 rows × 4 columns = 16 small squares."),
    mcq("uceed", "Design Awareness", "Easy", "Which factor most directly supports inclusive design?", ["Simple, understandable interface", "Fancy animations", "Luxury brand tone", "Unusual fonts"], "A", "An interface that is easy to understand supports users of many abilities and backgrounds."),
    nat("uceed", "Numerical Reasoning", "Medium", "A 500 g sugar solution has 30% sugar by weight. How many grams of water must be added to make it a 20% solution?", 250, "Sugar is 150 g. To make 20%, total solution must be 750 g. 750 − 500 = 250 g of water."),
    mcq("uceed", "Visual Reasoning", "Easy", "Which principle describes the tendency to see a rough outline as a complete shape?", ["Closure", "Similarity", "Proximity", "Continuity"], "A", "Closure makes us mentally complete an object when a few details are missing."),
    nat("uceed", "Spatial Reasoning", "Medium", "A cuboid measures 5 cm × 4 cm × 3 cm. What is its total surface area in cm²?", 94, "2 × (12 + 20 + 15) = 2 × 47 = 94 cm²."),
    mcq("uceed", "Design History", "Easy", "Which design movement promoted simple geometry and mass production?", ["Bauhaus", "Baroque", "Rococo", "Gothic"], "A", "The Bauhaus movement is famous for simple geometry and design for industrial production."),
    nat("uceed", "Analytical Reasoning", "Medium", "A bell rings every 6 minutes. Another rings every 9 minutes. They ring together at 9:00. After how many minutes will they next ring together?", 18, "Least common multiple of 6 and 9 is 18, so they next ring together after 18 minutes."),
    mcq("uceed", "Pattern Recognition", "Easy", "Which number is the odd one out: 2, 3, 5, 7, 9, 11?", ["9", "7", "5", "3"], "A", "The other numbers are prime. 9 = 3 × 3 is not prime."),
    nat("uceed", "Numerical Reasoning", "Easy", "A shirt is marked at ₹800. It is sold at a 20% discount. What is its selling price in rupees?", 640, "Discount = 0.2 × 800 = 160. Selling price = 800 − 160 = ₹640."),
    mcq("uceed", "Language", "Easy", "Which word is closest in meaning to 'elaborate'?", ["Detailed", "Plain", "Quick", "Random"], "A", "'Elaborate' describes something with much detail or complexity."),
    nat("uceed", "Spatial Reasoning", "Easy", "A cube with side 6 cm has volume how many cubic centimetres?", 216, "Volume = side³ = 6 × 6 × 6 = 216 cm³."),
    mcq("uceed", "Typography", "Easy", "Which font style is generally most legible for small print on a screen?", ["Clean sans-serif", "Highly decorative", "Script", "Highly condensed"], "A", "Clean sans-serif faces tend to render well on small screens and in small sizes."),
    nat("uceed", "Observation", "Easy", "A classroom has 6 desks. Each desk has 2 chairs. How many chairs are there in all?", 12, "6 × 2 = 12 chairs."),
    mcq("uceed", "Colour Theory", "Easy", "Which colour group is generally seen as warm?", ["Red, orange, yellow", "Blue, green, violet", "White, black, grey", "Pink, purple, teal"], "A", "Red, orange, and yellow sit on the warm side of the colour-temperature range."),
    nat("uceed", "Numerical Reasoning", "Medium", "A sequence begins 3, 8, 15, 24. What is the next term?", 35, "Differences are 5, 7, 9, so the next difference is 11. 24 + 11 = 35."),
    mcq("uceed", "Design Awareness", "Easy", "Which factor most directly supports inclusive design?", ["Simple, understandable interface", "Fancy animations", "Luxury brand tone", "Unusual fonts"], "A", "An interface that is easy to understand supports users of many abilities and backgrounds."),
    nat("uceed", "Observation", "Medium", "A stamp sheet has 10 stamps per row and 8 rows, with 4 stamps already removed. How many stamps remain?", 76, "10 × 8 = 80 stamps. 80 − 4 = 76 remain."),
    mcq("uceed", "Analytical Reasoning", "Easy", "Some designers are illustrators. Some illustrators are painters. Can we conclude all designers are painters?", ["No", "Yes", "Only sometimes", "Only if designers are illustrators"], "A", "Two overlapping groups do not imply that one of the groups is contained in the other."),
    nat("uceed", "Numerical Reasoning", "Easy", "A small carton carries 12 boxes. There are 9 cartons. How many boxes in total?", 108, "12 × 9 = 108 boxes.")
  ];

  var ceed = [
    nat("ceed", "Spatial Reasoning", "Easy", "A water tank is 6 m × 4 m × 3 m. How many cubic metres of space does it have?", 72, "Volume = 6 × 4 × 3 = 72 m³."),
    mcq("ceed", "Visual Reasoning", "Easy", "Which principle explains why identical icons are seen as one group?", ["Similarity", "Proximity", "Closure", "Continuity"], "A", "Similarity groups items that look alike, such as identical shapes or colours."),
    nat("ceed", "Pattern Recognition", "Easy", "What comes next: 5, 10, 20, 40, ___?", 80, "Each term is double the previous one. 40 × 2 = 80."),
    mcq("ceed", "Design Awareness", "Easy", "Which choice most efficiently guides user attention?", ["Clear visual hierarchy", "Random emphasis", "Extra decoration", "Complex layout"], "A", "Visual hierarchy tells the reader what to notice first, second, and third."),
    mcq("ceed", "Materials", "Easy", "Which metal pair forms brass?", ["Copper and zinc", "Iron and tin", "Aluminium and lead", "Gold and silver"], "A", "Brass is an alloy of copper and zinc."),
    mcq("ceed", "Typography", "Easy", "Which of these is usually best for long text in print?", ["Serif", "Decorative", "Script", "Condensed"], "A", "Serif faces aid reading across long passages in print."),
    nat("ceed", "Numerical Reasoning", "Medium", "A template uses 3 pages for every 5 illustrations. How many illustrations are needed for 15 pages?", 25, "15 pages = 5 groups of 3 pages. 5 × 5 illustrations = 25."),
    mcq("ceed", "Analytical Reasoning", "Easy", "All quality-control staff are detail-oriented. Ria is detail-oriented. What follows?", ["Nothing definite", "Ria is staff", "Ria is not staff", "Ria should be promoted"], "A", "Being detail-oriented is necessary but not sufficient to be a staff member, so no definite conclusion follows."),
    mcq("ceed", "Language", "Easy", "Which word is most nearly opposite in meaning to 'conventional'?", ["Innovative", "Common", "Tired", "Standard"], "A", "'Innovative' suggests newness and departure from the usual, which opposes 'conventional'."),
    nat("ceed", "Spatial Reasoning", "Medium", "A square sheet measures 20 cm by 20 cm. It is cut into four equal 10 cm × 10 cm squares. What is the perimeter of each small square in centimetres?", 40, "Each small square has side 10 cm and perimeter 4 × 10 = 40 cm."),
    mcq("ceed", "Visual Reasoning", "Medium", "Which layout best supports scanning without reading every detail?", ["Grouping and alignment", "Random placement", "Overlapping items", "Blurred background"], "A", "Grouping and alignment create predictable paths, so readers can scan carefully."),
    nat("ceed", "Numerical Reasoning", "Easy", "What is 35% of 200?", 70, "0.35 × 200 = 70."),
    mcq("ceed", "Design Awareness", "Medium", "Which of these best reduces confusion in an interface?", ["Consistent icon meaning", "Frequent colour changes", "Overlapping text", "Novel icons every screen"], "A", "Consistent icon meaning reduces the need to relearn symbols on every screen."),
    nat("ceed", "Analytical Reasoning", "Medium", "A clock shows 3:15. What is the angle between the hour and minute hands, in degrees?", 7.5, "Hour hand at 3:15 is 97.5° and minute hand is 90°. Difference is 7.5°."),
    mcq("ceed", "Pattern Recognition", "Easy", "What comes next in 2, 4, 8, 16, ___?", ["32", "24", "30", "64"], "A", "Each term doubles. 16 × 2 = 32."),
    mcq("ceed", "Design History", "Easy", "Which movement used bold geometric shapes and primary colours?", ["De Stijl", "Rococo", "Art Nouveau", "Gothic"], "A", "De Stijl is known for simple geometry and a limited primary palette."),
    nat("ceed", "Numerical Reasoning", "Medium", "A designer makes 1 pattern in 8 minutes. How many complete patterns are made in 2 hours?", 15, "2 hours = 120 minutes. 120 ÷ 8 = 15 patterns."),
    mcq("ceed", "Materials", "Easy", "Which material is a good conductor of heat?", ["Copper", "Wood", "Felt", "Foam"], "A", "Metals such as copper conduct heat well."),
    nat("ceed", "Observation", "Easy", "A shelf has 8 containers per row and 5 rows. How many containers in total?", 40, "8 × 5 = 40 containers."),
    mcq("ceed", "Analytical Reasoning", "Medium", "If P happens before Q and Q happens before R, which order is impossible?", ["R before P", "P before R", "Q before R", "P before Q"], "A", "If P → Q → R, then R cannot occur before P."),
    nat("ceed", "Numerical Reasoning", "Medium", "A package weighs 12 kg 500 g. How many grams is that?", 12500, "12 kg = 12,000 g. 12,000 + 500 = 12,500 g."),
    mcq("ceed", "Typography", "Easy", "What typeface quality helps distinguish one letter from another?", ["Distinctive shapes", "Uniform weight", "Tiny texture", "Invisible spacing"], "A", "Distinctive letterforms make characters easier to tell apart."),
    mcq("ceed", "Design Awareness", "Easy", "Which process step is most directly about understanding users?", ["Research", "Materials", "Decoration", "Marketing"], "A", "Research is the step focused on users, context, and needs."),
    nat("ceed", "Pattern Recognition", "Medium", "A shape rotates 90° clockwise in each step. In how many steps does it return to its original orientation?", 4, "Four 90° rotations make a full 360° turn."),
    nat("ceed", "Numerical Reasoning", "Medium", "A designer makes 4 sketches in 20 minutes. How many sketches in 1 hour?", 12, "1 hour = 60 minutes. 60 ÷ 20 = 3 groups of 4 = 12 sketches.")
  ];

  var nift = [
    mcq("nift", "English", "Easy", "Choose the word closest in meaning to 'abandon'.", ["Desert", "Assist", "Preserve", "Attach"], "A", "'Abandon' means to desert or leave something behind."),
    mcq("nift", "English", "Easy", "Choose the word opposite in meaning to 'ancient'.", ["Modern", "Old", "Ancient", "Timeless"], "A", "'Modern' is the usual opposite of 'ancient'."),
    mcq("nift", "English", "Medium", "Choose the grammatically correct sentence.", ["The committee decides tomorrow.", "The committee decide tomorrow.", "The committee will decide tomorrow.", "The committee had decided tomorrow."], "A", "Subject-verb agreement with a collective noun is handled contextually, and tomorrow suggests a future action with 'will'."),
    mcq("nift", "Quantitative Aptitude", "Easy", "A set of 24 chairs is arranged in rows. Which number of chairs per row is not a factor of 24?", ["5", "6", "8", "12"], "A", "5 does not divide 24 evenly, whereas 6, 8, and 12 are factors of 24."),
    mcq("nift", "Quantitative Aptitude", "Easy", "A shirt is priced at ₹1200 with a 15% discount. What is the selling price?", ["₹1020", "₹1074", "₹1200", "₹1260"], "A", "Discount = 0.15 × 1200 = 180. Selling price = 1020."),
    mcq("nift", "Quantitative Aptitude", "Medium", "A pattern uses 3 pieces of fabric to make 1 garment. How many garments can be made from 27 pieces?", ["9", "6", "12", "27"], "A", "27 ÷ 3 = 9 garments."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian city is known as the 'silk city' of India?", ["Bhagalpur", "Kanpur", "Pune", "Surat"], "A", "Bhagalpur is famous for its silk industry."),
    mcq("nift", "Analytical Reasoning", "Easy", "If every artist has a portfolio and Ravi has a portfolio, what follows?", ["Nothing definite", "Ravi is an artist", "Ravi is not an artist", "Ravi is a curator"], "A", "The statement is necessary but not sufficient to conclude Ravi is an artist."),
    mcq("nift", "Pattern Recognition", "Easy", "What comes next in 2, 5, 11, 23, ___?", ["47", "41", "38", "35"], "A", "Each term doubles and adds 1. 23 × 2 + 1 = 47."),
    mcq("nift", "English", "Easy", "Choose the correct preposition: 'The design was displayed ___ the exhibition.'", ["at", "onto", "into", "for"], "A", "'At' is the usual preposition for the location of an event."),
    mcq("nift", "Quantitative Aptitude", "Easy", "A fabric sells at ₹120 per metre. What is the cost of 5 metres?", ["₹600", "₹560", "₹580", "₹620"], "A", "5 × ₹120 = ₹600."),
    mcq("nift", "Quantitative Aptitude", "Medium", "A pattern requires 4 rectangles to make 1 set. How many sets can be made from 36 rectangles?", ["9", "8", "10", "12"], "A", "36 ÷ 4 = 9 sets."),
    mcq("nift", "General Knowledge", "Easy", "Which country is the traditional originator of batik textile art?", ["Indonesia", "Brazil", "Egypt", "Thailand"], "A", "Indonesia is widely known for batik."),
    mcq("nift", "Analytical Reasoning", "Easy", "All cotton garments are breathable. This garment is not breathable. What can we conclude?", ["It is not cotton", "It is cotton", "It is durable", "It is synthetic"], "A", "If not breathable, it cannot fall into the set of cotton garments."),
    mcq("nift", "Pattern Recognition", "Easy", "What comes next: 4, 8, 16, 32, ___?", ["64", "40", "48", "52"], "A", "Each term doubles. 32 × 2 = 64."),
    mcq("nift", "English", "Medium", "Choose the correct variant.", ["The cup was beautiful and detailed.", "The cup were beautiful and detailed.", "The cup am beautiful and detailed.", "The cup be beautiful and detailed."], "A", "Subject-verb agreement requires 'was'."),
    mcq("nift", "Quantitative Aptitude", "Medium", "A pattern uses 5 stitches to make 1 unit. How many units are made from 45 stitches?", ["9", "8", "10", "11"], "A", "45 ÷ 5 = 9 units."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian state is famous for handwoven Pochampally ikat?", ["Telangana", "Kerala", "Punjab", "Odisha"], "A", "Pochampally ikat is associated with Telangana."),
    mcq("nift", "Analytical Reasoning", "Medium", "If A is greater than B and B is greater than C, which is definitely the greatest?", ["A", "B", "C", "Cannot be determined"], "A", "By transitivity, A > B > C, so A is greatest."),
    mcq("nift", "Quantitative Aptitude", "Easy", "67 × 4 equals", ["268", "266", "272", "270"], "A", "67 × 4 = 268."),
    mcq("nift", "Quantitative Aptitude", "Easy", "A packet sells for ₹48 and has a 25% discount. What is the discounted price?", ["₹36", "₹32", "₹40", "₹35"], "A", "Discount = 0.25 × 48 = 12. Price = 36."),
    mcq("nift", "English", "Easy", "Choose the correct sentence.", ["These are the details I need.", "These are detail I need.", "This are the details I need.", "These is the details I need."], "A", "Plural subject requires plural verb 'are'."),
    mcq("nift", "Quantitative Aptitude", "Medium", "A woman walks 350 metres from her shop to a workshop in 7 minutes. What is her average speed in metres per minute?", ["50", "45", "55", "60"], "A", "Speed = 350 ÷ 7 = 50 m/min."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian city is known for animal motifs in hand-painted cotton textiles, like the Madhubani style?", ["Patna", "Jaipur", "Kanpur", "Surat"], "A", "The Madhubani tradition is associated with the Mithila region near Patna in Bihar."),
    mcq("nift", "Analytical Reasoning", "Easy", "Which number does not belong: 2, 4, 8, 16, 24?", ["24", "16", "8", "4"], "A", "The other numbers are powers of 2; 24 is not.")
  ];

  var nid = [
    mcq("nid", "General Knowledge", "Easy", "Which handloom tradition is associated with Banarasi weaving?", ["Uttar Pradesh", "Tamil Nadu", "Karnataka", "Gujarat"], "A", "Banarasi weaving is a traditional craft of Uttar Pradesh."),
    mcq("nid", "Design Awareness", "Easy", "Which array of options is most likely to reflect 'user-centred design'?", ["Understanding user needs first", "Building for the fastest prototype", "Choosing the prettiest colour", "Following a set pattern"], "A", "User-centred design begins by understanding user needs."),
    mcq("nid", "Spatial Reasoning", "Easy", "A cube has how many faces?", ["6", "8", "10", "12"], "A", "A cube has six square faces."),
    mcq("nid", "Pattern Recognition", "Easy", "Which number completes 2, 4, 6, 8, ___?", ["10", "9", "12", "16"], "A", "The sequence increases by 2, so the next term is 10."),
    mcq("nid", "Analytical Reasoning", "Medium", "If A comes before B and B comes before C, which of the following is definitely true?", ["A is before C", "C is before A", "C is between A and B", "Cannot be determined"], "A", "By transitivity, A before B and B before C implies A before C."),
    mcq("nid", "Design Awareness", "Medium", "Which of these is most useful for translating observations into design directions?", ["Insightful research", "Large budget", "Expensive tools", "Long meetings"], "A", "Insightful research turns observations into usable design directions."),
    mcq("nid", "Spatial Reasoning", "Easy", "How many edges does a triangular pyramid have?", ["6", "4", "5", "8"], "A", "A tetrahedron has six edges."),
    mcq("nid", "Pattern Recognition", "Easy", "What comes next: 1, 4, 7, 10, ___?", ["13", "12", "11", "14"], "A", "The pattern increases by 3. 10 + 3 = 13."),
    mcq("nid", "General Knowledge", "Easy", "Which Indian city is widely known for marble work in sculptural craft?", ["Makrana", "Kochi", "Lucknow", "Mysuru"], "A", "Makrana in Rajasthan is famous for its marble."),
    mcq("nid", "Design Awareness", "Medium", "Which is the most direct way to improve accessibility?", ["Clear, predictable interactions", "Extra decoration", "Complex layout", "Luxury typeface"], "A", "Clarity and predictability are core accessibility principles."),
    mcq("nid", "Spatial Reasoning", "Medium", "A cylindrical tube has radius 3 cm and length 10 cm. What is its approximate volume in cm³?", ["282", "252", "312", "302"], "A", "Volume = πr²h ≈ 3.14 × 9 × 10 = 282.6 cm³, approximately 282."),
    mcq("nid", "Pattern Recognition", "Easy", "Which number completes 5, 10, 20, 40, ___?", ["80", "60", "70", "90"], "A", "Each term doubles. 40 × 2 = 80."),
    mcq("nid", "General Knowledge", "Easy", "Which Indian craft style is traditionally associated with 'Pattu woolen shawls'?", ["Kullu", "Gond", "Tholu Bommalata", "Chikankari"], "A", "Kullu in Himachal Pradesh is known for handwoven woollen pattu shawls."),
    mcq("nid", "Analytical Reasoning", "Easy", "All ceramics are handmade in this studio. This object is not handmade. What follows?", ["It is not a ceramic from this studio", "It is ceramic", "It is handmade", "It is new"], "A", "If not handmade, it cannot be one of the ceramics in the studio."),
    mcq("nid", "Design Awareness", "Easy", "Which consideration most supports sustainable design?", ["Material choice", "Bright colour", "Small logo", "Large margin"], "A", "Good material choice is a primary driver of sustainable or less wasteful design."),
    mcq("nid", "Spatial Reasoning", "Easy", "A rectangular prism measures 4 × 3 × 2. What is its volume?", ["24", "26", "30", "28"], "A", "4 × 3 × 2 = 24."),
    mcq("nid", "Pattern Recognition", "Medium", "What comes next: 3, 6, 12, 24, ___?", ["48", "36", "44", "60"], "A", "Each term doubles. 24 × 2 = 48."),
    mcq("nid", "General Knowledge", "Easy", "Which Indian craft is traditionally linked with 'Madhubani' painting?", ["Folk art", "Pottery", "Wooden block printing", "Metal work"], "A", "Madhubani is a folk painting tradition from the Mithila region.")
  ];

  var uceed2 = [
    nat("uceed", "Spatial Reasoning", "Easy", "A cylinder has radius 5 cm and height 8 cm. What is its approximate volume in cm³?", 628, "Volume = πr²h ≈ 3.14 × 25 × 8 = 628 cm³."),
    nat("uceed", "Observation", "Easy", "A shelf has 8 bottles in each of 4 rows. How many bottles in total?", 32, "8 rows × 4 bottles = 32 bottles."),
    mcq("uceed", "Visual Reasoning", "Easy", "Which design choice best communicates 'this control can be dragged'?", ["Rounded edges and contrast", "Thick solid border", "Rotated text", "Low contrast"], "A", "Rounded edges and contrast make an element easier to identify as interactive."),
    mcq("uceed", "Pattern Recognition", "Easy", "Which number completes 3, 6, 12, 24, ___?", ["48", "36", "44", "52"], "A", "Each term doubles. 24 × 2 = 48."),
    nat("uceed", "Numerical Reasoning", "Medium", "A vendor prints 8 posters at 3 minutes each. How many minutes are needed in total?", 24, "8 × 3 = 24 minutes."),
    mcq("uceed", "Design Awareness", "Easy", "Which of these is the clearest way to show equal emphasis to four sections on a page?", ["Equal type size", "Random colour blocks", "Sensitive margins", "Thick borders"], "A", "Equal type size and consistent margins let each section appear equally weighted."),
    mcq("uceed", "Colour Theory", "Easy", "Which colour pair are complementary colours?", ["Red and cyan", "Blue and green", "Yellow and orange", "White and black"], "A", "Red and cyan sit opposite each other on the colour wheel."),
    mcq("uceed", "Typography", "Easy", "Which font style is best for a hand-drawn feel?", ["Handwritten", "Clean geometric", "Condensed sans-serif", "Serif"], "A", "Handwritten cues help a design feel personal or organic."),
    nat("uceed", "Observation", "Easy", "A stamp sheet has 6 stamps per row and 5 rows. How many stamps in total?", 30, "6 × 5 = 30 stamps."),
    mcq("uceed", "Analytical Reasoning", "Easy", "If each correct answer earns 4 marks, how many marks are earned by 5 correct answers?", ["20", "15", "18", "25"], "A", "5 × 4 = 20 marks."),
    mcq("uceed", "Language", "Easy", "Which word is closest in meaning to 'clarity'?", ["Simplicity", "Decorativeness", "Thick texture", "Colourfulness"], "A", "'Clarity' means easy to understand or see clearly."),
    nat("uceed", "Spatial Reasoning", "Easy", "A rectangular box is 6 cm by 4 cm by 2 cm. What is its volume in cm³?", 48, "6 × 4 × 2 = 48 cm³."),
    mcq("uceed", "Design Awareness", "Easy", "Which option most directly helps visually impaired users navigate a screen?", ["High-contrast text", "Extra decoration", "Complex layout", "Tiny type"], "A", "High contrast and larger type make interfaces easier to read."),
    mcq("uceed", "Pattern Recognition", "Easy", "Which sequence continues 5, 10, 20, 40, ___?", ["80", "60", "70", "100"], "A", "Each term doubles. 40 × 2 = 80.")
  ];

  var ceed2 = [
    nat("ceed", "Spatial Reasoning", "Easy", "A rectangular block is 6 cm × 5 cm × 4 cm. What is its volume in cm³?", 120, "6 × 5 × 4 = 120 cm³."),
    mcq("ceed", "Visual Reasoning", "Easy", "Which icon set is most likely to be recognised quickly?", ["Consistent style with distinct meaning", "Inconsistent style", "Overlapping shapes", "Random colour coding"], "A", "Consistent style with distinct meaning supports quick recognition."),
    mcq("ceed", "Pattern Recognition", "Easy", "Which shape rotation is 90° clockwise?", [":90", ":-90", "180", "45"], "A", "A 90° clockwise rotation turns a shape a quarter turn."),
    nat("ceed", "Numerical Reasoning", "Medium", "A pattern repeats every 4 cm. How many repeats are in 100 cm?", 25, "100 ÷ 4 = 25 repeats."),
    mcq("ceed", "Design Awareness", "Easy", "Which process step directly follows user research?", ["Ideation", "Manufacturing", "Decoration", "Marketing"], "A", "After research, teams usually generate ideas."),
    mcq("ceed", "Typography", "Easy", "Which typeface is usually best for small screen text?", ["Sans-serif", "Decorative", "Script", "Condensed serif"], "A", "Sans-serif faces render well on small screens."),
    mcq("ceed", "Materials", "Easy", "Which material is most suitable for lightweight waterproof packaging?", ["Polyethylene film", "Wood", "Aluminium", "Steel"], "A", "Polyethylene film is light and water resistant."),
    mcq("ceed", "Analytical Reasoning", "Easy", "If P comes after Q and Q comes after R, what is true?", ["P comes after R", "P comes before R", "P and Q are simultaneous", "Cannot be determined"], "A", "Ordering implies P is after both Q and R."),
    nat("ceed", "Pattern Recognition", "Easy", "A hexagon has how many sides?", 6, "A hexagon has six sides."),
    mcq("ceed", "Design Awareness", "Easy", "Which of these best reduces visual clutter?", ["Simpler shapes and consistent colour", "More decoration", "More symbols", "higher contrast only"], "A", "Simpler shapes and consistent colour reduce clutter."),
    nat("ceed", "Numerical Reasoning", "Medium", "A design bundle contains 8 files, but only 6 are used. How many unused files are there?", 2, "8 − 6 = 2 files unused."),
    mcq("ceed", "Visual Reasoning", "Easy", "Which construction best indicates a face behind a panel?", ["Transparency", "Low contrast", "Random texture", "Folding line"], "A", "Transparency helps indicate a hidden face."),
    mcq("ceed", "Language", "Easy", "Which word is most nearly opposite of 'vague'?", ["Clear", "Dim", "Wide", "Thick"], "A", "'Clear' is the direct opposite of 'vague'.")
  ];

  var nift2 = [
    mcq("nift", "English", "Easy", "Which word is closest in meaning to 'expand'?", ["Enlarge", "Minify", "Shorten", "Simplify"], "A", "'Expand' means to enlarge."),
    mcq("nift", "Quantitative Aptitude", "Easy", "A store buys fabric at ₹120 per metre and sells at ₹160. What is profit per metre?", ["₹40", "₹20", "₹160", "₹280"], "A", "160 − 120 = ₹40 profit per metre."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian state is famous for Jamdani weaving?", ["West Bengal", "Rajasthan", "Punjab", "Kerala"], "A", "Jamdani weaving is a traditional handloom craft of West Bengal."),
    mcq("nift", "Analytical Reasoning", "Easy", "A box has 3 red, 4 green, and 5 blue balls. What is the probability of drawing a green ball?", ["4/12", "1/3", "1/4", "1/2"], "A", "4 green balls out of 12 total means 4/12 = 1/3."),
    mcq("nift", "Pattern Recognition", "Easy", "What comes next in 2, 5, 11, 23, ___?", ["47", "41", "38", "35"], "A", "Each term doubles and adds 1. 23 × 2 + 1 = 47."),
    mcq("nift", "English", "Easy", "Choose the correct sentence.", ["The pattern is elegant and consistent.", "The pattern were elegant and consistent.", "The pattern are elegant and consistent.", "The pattern is elegance and consistency."], "A", "Subject-verb agreement requires 'is'."),
    mcq("nift", "Quantitative Aptitude", "Medium", "A pattern needs 3 metres of fabric. How many patterns can be made from 18 metres?", ["6", "5", "7", "8"], "A", "18 ÷ 3 = 6 patterns."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian city is famous for Kanjeevaram silk sarees?", ["Kanchipuram", "Mysuru", "Jaipur", "Lucknow"], "A", "Kanchipuram is the home of Kanjeevaram silk sarees."),
    mcq("nift", "Analytical Reasoning", "Medium", "If A is less than B and B is less than C, which is smallest?", ["A", "B", "C", "Cannot be determined"], "A", "By transitivity, A < B < C, so A is smallest."),
    mcq("nift", "Pattern Recognition", "Easy", "Which number does not belong: 3, 6, 9, 12, 16?", ["16", "6", "9", "12"], "A", "The other numbers are multiples of 3; 16 is not."),
    mcq("nift", "English", "Medium", "Choose the best form: 'Sunday, 5 January, the shipment was delayed.'", ["On Sunday, 5 January, the shipment was delayed.", "Sunday, 5 January, the shipment was delayed.", "Sunday 5 January the shipment was delayed.", "Sunday, 5 January the shipment was delayed"], "A", "Use the comma after the date phrase and 'on' before the day."),
    mcq("nift", "Quantitative Aptitude", "Easy", "A sample has 8 units. How many units in 7 samples?", ["56", "48", "54", "60"], "A", "7 × 8 = 56 units."),
    mcq("nift", "General Knowledge", "Easy", "Which Indian state is famous for the Pochampally ikat tradition?", ["Telangana", "Gujarat", "Karnataka", "Bihar"], "A", "Pochampally ikat is associated with Telangana.")
  ];

  var nid2 = [
    mcq("nid", "Analytical Reasoning", "Easy", "Which shape has rotational symmetry of order 4?", ["Square", "Equilateral triangle", "Hexagon", "Circle"], "A", "A square maps onto itself four times in a full rotation."),
    mcq("nid", "General Knowledge", "Easy", "Which Indian state is famous for Kantha embroidery?", ["West Bengal", "Rajasthan", "Punjab", "Kerala"], "A", "Kantha embroidery is traditionally linked to West Bengal."),
    mcq("nid", "Design Awareness", "Easy", "Which step directly follows 'ideation' in a design process?", ["Prototyping", "Marketing", "Decoration", "Manufacturing"], "A", "After ideation, teams usually make prototypes."),
    mcq("nid", "Spatial Reasoning", "Easy", "A rectangle is 5 cm by 8 cm. What is its area in cm²?", ["40", "35", "36", "45"], "A", "5 × 8 = 40 cm²."),
    mcq("nid", "Pattern Recognition", "Easy", "What comes next in 3, 6, 12, 24, ___?", ["48", "36", "44", "60"], "A", "Each term doubles. 24 × 2 = 48."),
    mcq("nid", "General Knowledge", "Easy", "Which traditional craft is linked with Jaipur blue pottery?", ["Rajasthan", "Gujarat", "Kerala", "Odisha"], "A", "Jaipur blue pottery is a traditional Rajasthani craft."),
    mcq("nid", "Analytical Reasoning", "Medium", "Which number completes 5, 10, 20, 40, ___?", ["80", "60", "70", "90"], "A", "Each term doubles. 40 × 2 = 80."),
    mcq("nid", "Design Awareness", "Easy", "Which option best supports accessibility in typography?", ["High contrast and simple shapes", "Low contrast", "Dense texture", "Complex layout"], "A", "High contrast and simple letterforms make typography more accessible."),
    mcq("nid", "Spatial Reasoning", "Easy", "A right triangle has sides 3 cm, 4 cm, and 5 cm. What is its area in cm²?", ["6", "12", "15", "20"], "A", "Area = (1/2) × base × height = (1/2) × 3 × 4 = 6 cm²."),
    mcq("nid", "Pattern Recognition", "Easy", "Which number completes 2, 3, 5, 8, 12, ___?", ["17", "16", "18", "20"], "A", "Differences are 1, 2, 3, 4; next difference is 5. 12 + 5 = 17."),
    mcq("nid", "General Knowledge", "Easy", "Which traditional textile is linked with Kanchipuram?", ["Kanchi silk", "Kantha embroidery", "Pashmina", "Chikankari"], "A", "Kanchi silk is associated with the town of Kanchipuram."),
    mcq("nid", "Analytical Reasoning", "Easy", "Which option best describes figure-ground relation?", ["The relationship between subject and background", "Only the subject", "Only the background", "None"], "A", "Figure-ground describes how the subject and background are perceived together."),
    mcq("nid", "Spatial Reasoning", "Easy", "A conical cup has radius 3 cm and height 6 cm. What is its approximate volume in cm³?", ["56.5", "30", "75", "90"], "A", "Volume = (1/3)πr²h ≈ (1/3) × 3.14 × 9 × 6 = 56.5 cm³.")
  ];

  var batch = [].concat(uceed, uceed2, ceed, ceed2, nift, nift2, nid, nid2);

  window.PRACTICE_BANK.push.apply(window.PRACTICE_BANK, batch);
})();
