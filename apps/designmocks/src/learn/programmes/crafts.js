// Crafts, textiles, materials and making: the first programme built on the
// recall pattern. Facts live in src/learn/decks/crafts.js.
// Specification: docs/learn/topics/crafts.md and recall-pattern.md.
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const craftsProgramme = Object.freeze({
  slug: 'crafts', title: 'Crafts, materials and making',
  summary: 'Indian embroidery, weaves, printing and dyeing; plastics, metals, fibres and clay; how things are moulded, cast, bound and printed; and the words of sustainable design.',
  topic: 'design-sensitivity', exams: ['nid', 'nift', 'uceed', 'ceed'], minutes: 90, status: 'preview', pattern: 'recall',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'textiles', title: 'Embroidery and weaves', minutes: 10, level: 2, summary: 'Where each style comes from and what makes it itself.', steps: [
        { id: 'embroidery', kind: 'slide', title: 'Embroidery by region', text: ['Chikankari, Lucknow: white-on-white shadow work. Phulkari, Punjab: flower work in silk floss. Kantha, West Bengal: running stitch quilting old saris.', 'Zardozi, Lucknow and Bhopal: gold and silver thread. Kashida, Kashmir: chain-stitch flowers. Aari, Gujarat: hooked-needle chain stitch. Shisha, Kutch and Rajasthan: mirror work.'] },
        { id: 'weaves', kind: 'slide', title: 'Weaves by region', text: ['Banarasi, Varanasi: zari brocade. Jamdani, Bengal: fine muslin with extra weft figures. Kanjeevaram, Tamil Nadu: heavy silk with contrast zari borders.', 'Patola, Patan in Gujarat: double ikat. Pochampally, Telangana, and Sambalpuri, Odisha: ikat.'] },
        check('check-1', 'tex-name', 1, 1), check('check-2', 'tex-name', 2, 1), check('check-3', 'tex-which', 1, 2), check('check-4', 'tex-which', 2, 2),
        { id: 'remember', kind: 'takeaway', body: 'Learn each style as a pair: its region and the one feature that makes it recognisable.' }] },
      { id: 'materials', title: 'Materials', minutes: 10, level: 2, summary: 'Plastics, metals, fibres and clay, and how to tell their groups apart.', steps: [
        { id: 'groups', kind: 'slide', title: 'Groups that matter', text: ['Thermoplastics (PET, HDPE, PVC, polypropylene, ABS) soften on heating and can be remoulded. Thermosets (epoxy, melamine, Bakelite) set for good.', 'Ferrous metals contain iron (steel, cast iron). Brass is copper and zinc; bronze is copper and tin.', 'Plant fibres: cotton, jute. Animal fibres: silk, wool. Synthetic: polyester, nylon. Clay fired hotter gets denser: terracotta, stoneware, porcelain.'] },
        check('check-1', 'mat-name', 1, 1), check('check-2', 'mat-which', 1, 2), check('check-3', 'mat-which', 2, 2), check('check-4', 'mat-name', 2, 1),
        { id: 'remember', kind: 'takeaway', body: 'Remould: thermoplastic. Iron inside: ferrous. Copper with zinc is brass, with tin bronze.' }] },
      { id: 'making', title: 'How things are made', minutes: 10, level: 2, summary: 'Moulding, casting, binding and printing, and what each is for.', steps: [
        { id: 'processes', kind: 'slide', title: 'Match the process to the product', text: ['Injection moulding: bottle caps and toys. Blow moulding: hollow bottles. Rotational moulding: large tanks.', 'Sand casting: large rough parts. Die casting: precise parts such as zips. Lost-wax: jewellery and Dokra.', 'Saddle stitch: thin booklets; perfect binding: paperbacks; case binding: hardcovers. Offset: books; flexography: corrugated packaging; 3D printing: prototypes.'] },
        check('check-1', 'make-name', 1, 1), check('check-2', 'make-which', 1, 2), check('check-3', 'make-name', 2, 1), check('check-4', 'make-which', 2, 2),
        { id: 'remember', kind: 'takeaway', body: 'Ask what the product is and how many are needed; the process follows.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 7, marking: 'plain', questions: [{ kind: 'tex-name', level: 1, count: 2 }, { kind: 'tex-which', level: 2, count: 2 }, { kind: 'mat-name', level: 1, count: 1 }, { kind: 'mat-which', level: 2, count: 2 }, { kind: 'make-name', level: 1, count: 2 }, { kind: 'make-which', level: 2, count: 1 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'match-textiles', title: 'Match the following: textiles', minutes: 10, level: 3, summary: 'Three items, three regions or descriptions.', steps: [
        hook('A match-the-following question, exam style.', 'tex-match', 1, 3),
        { id: 'surest', kind: 'slide', title: 'Surest pair first', text: 'Start with the pair you are surest of and strike out every option that disagrees. Usually one or two pairs settle the answer.' },
        check('check-1', 'tex-match', 2, 3), check('check-2', 'tex-odd', 1, 3), check('check-3', 'tex-odd', 2, 3),
        practice('tex-match', 3), check('check-hook', 'tex-match', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'One sure pair rules out most options.' }] },
      { id: 'match-materials', title: 'Materials and sustainability', minutes: 10, level: 3, summary: 'Odd one out across groups, and the words of sustainable design.', steps: [
        hook('Three belong together. Which does not?', 'mat-odd', 1, 3),
        { id: 'words', kind: 'slide', title: 'Words that examiners reward', text: ['Biodegradable: broken down by microbes. Compostable: becomes compost, often only in special conditions. Recyclable: reprocessed into new material.', 'Upcycling raises value; downcycling lowers it. Design for disassembly: parts that come apart for repair or recycling. Cradle to cradle: every output is a nutrient, biological or technical.'] },
        check('check-1', 'mat-odd', 2, 3), check('check-2', 'mat-match', 1, 3), check('check-3', 'mat-match', 2, 3),
        practice('mat-odd', 3), check('check-hook', 'mat-odd', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Name each item’s group first; the odd one shows itself.' }] },
      { id: 'match-making', title: 'Processes in pairs', minutes: 10, level: 3, summary: 'Match processes to products, and find the stray process.', steps: [
        hook('Match each process with what it makes.', 'make-match', 1, 3),
        check('check-1', 'make-match', 2, 3), check('check-2', 'make-odd', 1, 3), check('check-3', 'make-odd', 2, 3),
        practice('make-match', 3), check('check-hook', 'make-match', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Moulding is for plastics, casting for metal, binding for books.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 12, pass: 6, marking: 'plain', questions: [{ kind: 'tex-match', level: 3, count: 2 }, { kind: 'tex-odd', level: 3, count: 1 }, { kind: 'mat-odd', level: 3, count: 2 }, { kind: 'mat-match', level: 3, count: 1 }, { kind: 'make-match', level: 3, count: 1 }, { kind: 'make-odd', level: 3, count: 1 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'sequences', title: 'Processes in order', minutes: 10, level: 4, summary: 'Put the steps of a process in order.', steps: [
        hook('Lost-wax casting, shuffled.', 'make-order', 1, 4),
        { id: 'why', kind: 'slide', title: 'Each step needs the one before', text: 'For any process, ask what each step needs: the wax must exist before it is coated, and must be melted out before metal goes in. Ikat yarn is bound, dyed and unbound before it is woven.' },
        check('check-1', 'make-order', 2, 4), check('check-2', 'mat-order', 1, 4), check('check-3', 'tex-order', 1, 4),
        practice('make-order', 4), check('check-hook', 'make-order', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Order follows need: what must exist before the next step can happen?' }] },
      { id: 'two-conditions', title: 'Two conditions and four pairs', minutes: 10, level: 4, summary: 'Harder matching and questions that test two facts at once.', steps: [
        hook('Both the group and the region must fit.', 'tex-two', 1, 4),
        check('check-1', 'tex-two', 2, 4), check('check-2', 'tex-match', 1, 4), check('check-3', 'mat-match', 1, 4), check('check-4', 'make-match', 1, 4),
        practice('tex-two', 4), check('check-hook', 'tex-two', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Test the first condition on every option, then the second.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 12, pass: 6, marking: 'plain', questions: [{ kind: 'tex-two', level: 4, count: 2 }, { kind: 'tex-match', level: 4, count: 2 }, { kind: 'make-order', level: 4, count: 2 }, { kind: 'mat-order', level: 4, count: 1 }, { kind: 'mat-match', level: 4, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'Mixed practice before the timed set.', steps: [
        { id: 'how', kind: 'slide', title: 'Revising facts', text: ['Learn facts in pairs and groups, not one by one: style and region, material and group, process and product.', 'Test yourself with match-the-following: it is how the exam asks.'] },
        { id: 'practice-1', kind: 'practice', question: { kind: 'tex-match', level: 4 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'mat-odd', level: 3 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Pairs and groups, then test by matching.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 12, pass: 10, marking: 'uceed', description: 'Fourteen recall questions at exam pace, marked like UCEED.', questions: [{ kind: 'tex-name', level: 1, count: 2 }, { kind: 'tex-match', level: 4, count: 2 }, { kind: 'tex-two', level: 4, count: 1 }, { kind: 'mat-which', level: 2, count: 2 }, { kind: 'mat-odd', level: 3, count: 2 }, { kind: 'make-name', level: 1, count: 2 }, { kind: 'make-match', level: 3, count: 1 }, { kind: 'make-order', level: 4, count: 2 }] } },
  ],
});
