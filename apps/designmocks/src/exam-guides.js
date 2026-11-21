// Paper-format references are recorded in docs/EXAM_RULES.md and docs/BANK_CONVERSION.md.
// These guides describe the exam. The authenticated catalogue owns paper availability.
export const examGuides = {
  uceed: {
    programme: 'B.Des.', title: 'UCEED',
    introduction: 'Move between shapes, numbers and sketches. UCEED pairs a computer-based Part A with drawing and design aptitude in Part B.',
    sections: [
      ['Part A', 'Objective responses', '120 min', 'Enter numerical answers, select every correct option, or choose one answer. The three sections have different marking rules.'],
      ['Part B', 'Drawing & design aptitude', '60 min', 'Respond to two tasks on paper. Show how you see a scene and how you solve a design problem.'],
    ],
    sample: { title: 'A hole through folded paper', prompt: 'Fold a square sheet in half, then in half again. Punch one hole through the centre of the folded packet. How many holes will you see when you unfold it?', answer: 4, explanation: 'The punch passes through four layers. Because it misses both creases, each layer opens out with its own hole.' },
    source: 'https://www.uceed.iitb.ac.in/2027/assets/downloads/docs/UCEED2027_Information_Brochure.pdf',
  },
  nid: {
    programme: 'B.Des.', title: 'NID DAT',
    introduction: 'Work from a visual brief and make an idea legible on paper. Start with the DAT Prelims format, then try an original design prompt.',
    sections: [
      ['Prelims', 'Text & visual prompts', 'On paper', 'The B.Des. handbook describes a paper-and-pencil or pen test in English. Check your admit card for the duration.'],
      ['Practice', 'Drawing & written responses', 'DMOCKS', 'For a DMocks practice brief, read its specific instructions and review criteria before you begin.'],
    ],
    sample: { title: 'A latch for small hands', prompt: 'On paper, sketch a lunchbox latch that a child could open with one hand. Show the open and closed positions and mark where the thumb presses.', explanation: 'Compare your two views. Can someone tell where to press, which piece moves, and what keeps the lid closed? Add an arrow or a label where the motion is unclear.' },
    source: 'https://admissions.nid.edu/NIDA2027/download/BDES_IntegratedPathway_AdmissionsHandbook2027_28.pdf',
  },
  nift: {
    programme: 'B.Des.', title: 'NIFT',
    introduction: 'Switch from analytical questions to visual ideas. The B.Des. entrance exam includes a computer-based GAT and a paper-based creative test.',
    sections: [
      ['GAT', 'General Ability Test', '120 min', 'Choose one answer per question. The B.Des. GAT awards one mark for a correct answer and deducts a quarter mark for a wrong one.'],
      ['CAT', 'Creative Ability Test', 'On paper', 'Communicate an idea visually. The CAT considers observation, concept development, colour and illustration.'],
    ],
    sample: { title: 'Cutting a fabric length', prompt: 'A studio uses 25% of a 160 cm length of fabric. How many centimetres are left?', options: [40, 100, 120, 135], answer: 120, explanation: 'A quarter of 160 cm is 40 cm. Subtract the cut piece to leave 120 cm.' },
    source: 'https://nift.ac.in/sites/default/files/2026-10/Information%20Bulletin%20-NIFTEE%202027%20-16.10.2026.pdf',
  },
  ceed: {
    programme: 'M.Des.', title: 'CEED',
    introduction: 'Observe how things work and communicate a design response. CEED moves from objective reasoning in Part A to sketching and design tasks in Part B.',
    sections: [
      ['Part A', 'Objective responses', '60 min', 'Work through numerical-answer, multiple-select and multiple-choice sections on the computer.'],
      ['Part B', 'Sketching & design tasks', '120 min', 'Use drawings and written answers to communicate ideas, solve problems and explain design decisions.'],
    ],
    sample: { title: 'A pair of meshing gears', prompt: 'A gear with 12 teeth drives a gear with 36 teeth. If the small gear completes three turns, how many full turns does the large gear make?', answer: 1, explanation: 'Three turns move 36 teeth past the contact point. That takes the 36-tooth gear through one full turn.' },
    source: 'https://www.ceed.iitb.ac.in/2027/downloads/CEED2027_Brochure.pdf',
  },
};

export function initialCatalogueExam(catalog) {
  return catalog.find(paper => paper.enabled && paper.ready)?.exam ?? catalog[0]?.exam ?? 'uceed';
}
