// Product design thinking on the method pattern: User + Context + Problem +
// Feature + Material + Label. Items live in src/learn/decks/product.js.
// Specification: docs/learn/topics/product-design.md.
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });
const CHECKLIST = 'Checklist for your own drawing: name the user, state the context, write the problem in one line, give three features that each solve a stated problem, justify the material in one word, and label every feature with a short phrase and a leader line.';

export const productDesignProgramme = Object.freeze({
  slug: 'product-design', title: 'Product design thinking',
  summary: 'Work a design brief step by step: who the users are, what the context demands, the real problem, features that answer it, the right material, clear labels and the order of the design process.',
  topic: 'design-sensitivity', exams: ['nid', 'uceed', 'ceed', 'nift'], minutes: 80, status: 'preview', pattern: 'method',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'formula', title: 'The method in one line', minutes: 10, level: 2, summary: 'User + Context + Problem + Feature + Material + Label.', steps: [
        { id: 'formula', kind: 'slide', title: 'User + Context + Problem + Feature + Material + Label', text: ['Every product answer names who uses it, where and when, the problem it solves, features that solve it, the material and why, and labels that make each feature visible to the examiner.', 'Never start with form. Start with the pain point.'] },
        { id: 'users', kind: 'slide', title: 'Users are specific', text: 'Not “people”, but distinct groups with different bodies, ages or abilities. Each group’s challenge should come from the setting: its motion, height, reach, hygiene or time pressure.' },
        check('check-1', 'pd-users', 1, 2), check('check-2', 'pd-users', 2, 2), check('check-3', 'pd-users', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Name the group and the body constraint the setting creates.' }] },
      { id: 'labels-materials', title: 'Labels and materials', minutes: 10, level: 2, summary: 'Short labels on leader lines; one word to justify a material.', steps: [
        { id: 'labels', kind: 'slide', title: 'An unlabelled feature is invisible', text: 'Label each feature with a short noun phrase, never a sentence, and point to the exact part with a straight leader line. Show the product in two states if the brief asks, and label what changes.' },
        { id: 'material', kind: 'slide', title: 'One word for the material', text: 'Justify a material with the one property the use demands: light, waterproof, durable, washable, low-cost, recyclable. For stability, look for the widest base and lowest bulk.' },
        check('check-1', 'pd-label', 1, 2), check('check-2', 'pd-label', 2, 2), check('check-3', 'pd-material', 1, 2), check('check-4', 'pd-material', 2, 2),
        { id: 'remember', kind: 'takeaway', body: 'Short labels, leader lines, one-word material reasons.' }] },
      { id: 'process', title: 'The design process in order', minutes: 6, level: 2, summary: 'Research, analysis, ideas, prototype, development, market.', steps: [
        { id: 'order', kind: 'slide', title: 'A fixed order', text: 'Research the need, analyse the findings, generate ideas, prototype and test, develop the product, take it to market. Label each jumbled step with its phase, then read them off in phase order.' },
        check('check-1', 'pd-process', 1, 2), check('check-2', 'pd-process', 2, 2),
        { id: 'remember', kind: 'takeaway', body: 'Research before ideas, ideas before prototypes, prototypes before the business.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'pd-users', level: 2, count: 2 }, { kind: 'pd-label', level: 2, count: 2 }, { kind: 'pd-material', level: 2, count: 2 }, { kind: 'pd-process', level: 2, count: 2 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'context', title: 'Context decides the answer', minutes: 10, level: 3, summary: 'Find the one variable the setting depends on.', steps: [
        hook('Four ramps. Which is easiest for a wheelchair?', 'pd-context', 1, 3),
        { id: 'variable', kind: 'slide', title: 'One variable', text: 'Where and when a product is used changes what counts as right. Find the one physical variable the setting depends on, such as slope, space or light, and reject answers that ignore it or claim “always”.' },
        worked('pd-context', 2, 3),
        check('check-1', 'pd-context', 3, 3), check('check-2', 'pd-context', 5, 3),
        practice('pd-context', 3), check('check-hook', 'pd-context', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Name the variable; reject absolute claims.' }] },
      { id: 'pain', title: 'The real problem', minutes: 10, level: 3, summary: 'Solve the burden under the stated demand.', steps: [
        hook('Two sides, two demands. What actually hurts?', 'pd-pain', 1, 3),
        { id: 'under', kind: 'slide', title: 'Under the demand', text: 'Separate what each side asks for from what actually hurts. Name the burden in one sentence. Good ideas remove it and leave both sides’ real interests intact.' },
        worked('pd-pain', 2, 3),
        check('check-1', 'pd-pain', 3, 3), check('check-2', 'pd-pain', 4, 3),
        practice('pd-pain', 3), check('check-hook', 'pd-pain', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'The stated demand is a solution; find the problem under it.' }] },
      { id: 'features', title: 'Features that trace to problems', minutes: 10, level: 3, summary: 'Every feature answers a named constraint.', steps: [
        hook('A brief and four features. Which one answers nothing?', 'pd-feature', 1, 3),
        { id: 'trace', kind: 'slide', title: 'Trace every feature', text: 'List the constraints exactly as given. Each feature should answer one, by a different working principle: seal, redirect, collect, block, absorb. A beautiful form with no problem attached scores nothing.' },
        worked('pd-feature', 2, 3),
        check('check-1', 'pd-feature', 3, 3), check('check-2', 'pd-feature', 4, 3),
        practice('pd-feature', 3), check('check-hook', 'pd-feature', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'No problem, no feature.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 12, pass: 5, marking: 'plain', questions: [{ kind: 'pd-context', level: 3, count: 2 }, { kind: 'pd-pain', level: 3, count: 2 }, { kind: 'pd-feature', level: 3, count: 2 }, { kind: 'pd-users', level: 2, count: 1 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'full-brief', title: 'A full brief', minutes: 12, level: 4, summary: 'All the steps at once, then the checklist for your own drawing.', steps: [
        hook('Which set of features answers the whole brief?', 'pd-feature', 4, 4),
        { id: 'together', kind: 'slide', title: 'Run the whole formula', text: 'For a full brief: users, context, the problem in one line, three features each answering a constraint, the material in one word, and labels. Check every feature against the list of constraints before you draw.' },
        check('check-1', 'pd-feature', 1, 4), check('check-2', 'pd-process', 3, 4), check('check-3', 'pd-process', 4, 4),
        practice('pd-feature', 4),
        { id: 'checklist', kind: 'takeaway', body: CHECKLIST }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 10, pass: 4, marking: 'plain', questions: [{ kind: 'pd-feature', level: 4, count: 3 }, { kind: 'pd-process', level: 4, count: 2 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 6, level: 5, summary: 'The method once more before the timed set.', steps: [
        { id: 'mistakes', kind: 'slide', title: 'Common mistakes', text: 'A beautiful form with no link to a problem. Ignoring weight, grip or cleaning. Long sentences instead of labels. No reason for the material. Judging an option by its wording instead of the variable it implies. Guessing process order instead of labelling each step.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'pd-pain', level: 3 }, streak: 2 },
        { id: 'checklist', kind: 'takeaway', body: CHECKLIST }] },
    ], quiz: { title: 'Timed exam set', minutes: 12, pass: 8, marking: 'uceed', description: 'Ten design-thinking questions at exam pace, marked like UCEED.', questions: [{ kind: 'pd-users', level: 2, count: 1 }, { kind: 'pd-label', level: 2, count: 1 }, { kind: 'pd-material', level: 2, count: 1 }, { kind: 'pd-context', level: 3, count: 2 }, { kind: 'pd-pain', level: 3, count: 2 }, { kind: 'pd-feature', level: 4, count: 2 }, { kind: 'pd-process', level: 4, count: 1 }] } },
  ],
});
