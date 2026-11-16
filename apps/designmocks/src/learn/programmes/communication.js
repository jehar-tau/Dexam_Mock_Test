// Posters, mascots and campaigns, and Storyboarding, on the method pattern.
// Items live in src/learn/decks/communication.js.
// Specifications: docs/learn/topics/posters.md and storyboarding.md.
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

const POSTER_CHECKLIST = 'Checklist for your own poster: one message; one dominant visual; headline largest, call to action clear; a slogan of six to eight words that matches the tone; a mascot with personality and a clear silhouette; a symbol that still reads small and in one colour.';
export const postersProgramme = Object.freeze({
  slug: 'posters', title: 'Posters, mascots and campaigns',
  summary: 'Build a poster around one message, write a slogan that carries it, design mascots and symbols that read at a glance, and choose the right medium and tone for a campaign.',
  topic: 'design-sensitivity', exams: ['nid', 'nift', 'uceed'], minutes: 70, status: 'preview', pattern: 'method',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'hierarchy', title: 'One message, one focal point', minutes: 10, level: 2, summary: 'Visual, headline, message, call to action.', steps: [
        { id: 'one', kind: 'slide', title: 'Built round one idea', text: ['Find the one message. Choose one dominant visual that carries it. Make the headline largest, supporting text smaller, the call to action clear.', 'Sketch two or three thumbnails, then check the poster reads from across a room in a few seconds.'] },
        check('check-1', 'pc-hierarchy', 1, 2), check('check-2', 'pc-hierarchy', 3, 2), check('check-3', 'pc-hierarchy', 5, 2),
        { id: 'remember', kind: 'takeaway', body: 'One message, one dominant visual, a clear size order.' }] },
      { id: 'slogans', title: 'Slogans', minutes: 8, level: 2, summary: 'Short, rhythmic, and true to the tone.', steps: [
        { id: 'cut', kind: 'slide', title: 'Draft long, cut short', text: 'Write the idea out in full, then cut it to six or eight words. Prefer rhythm, repetition or wordplay. Check it still makes sense without the poster, and that its tone matches: serious campaign or cheerful advertisement.' },
        check('check-1', 'pc-slogan', 1, 2), check('check-2', 'pc-slogan', 2, 2), check('check-3', 'pc-slogan', 3, 2),
        { id: 'remember', kind: 'takeaway', body: 'Six to eight words that carry the idea alone.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 6, pass: 5, marking: 'plain', questions: [{ kind: 'pc-hierarchy', level: 2, count: 3 }, { kind: 'pc-slogan', level: 2, count: 3 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'mascots', title: 'Mascots and symbols', minutes: 12, level: 3, summary: 'Characters that carry a value; marks that read at a glance.', steps: [
        hook('Which mascot carries the campaign?', 'pc-mascot', 1, 3),
        { id: 'value', kind: 'slide', title: 'Value, character, traits, silhouette', text: ['A mascot starts from the campaign’s value: cleanliness, safety, honesty, health. Choose a character that can carry it, give it two or three traits, a prop that links back, and a silhouette you would know in outline.', 'A symbol is one form that reads as the idea, stripped until it works small, fitted to the format: circular, square, one colour.'] },
        worked('pc-mascot', 2, 3),
        check('check-1', 'pc-mascot', 3, 3), check('check-2', 'pc-symbol', 1, 3), check('check-3', 'pc-symbol', 2, 3),
        practice('pc-symbol', 3), check('check-hook', 'pc-mascot', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Mascot: value plus personality. Symbol: one form that reads small.' }] },
      { id: 'campaigns', title: 'Campaigns', minutes: 10, level: 3, summary: 'Audience, medium, tone, one action.', steps: [
        hook('Who is this for, and how will it reach them?', 'pc-campaign', 1, 3),
        { id: 'audience', kind: 'slide', title: 'Audience first', text: 'Identify the issue and the audience: age, literacy, access to media. Choose a medium that reaches them, a tone that fits the issue, and build the message round one action that reads without words.' },
        worked('pc-campaign', 2, 3),
        check('check-1', 'pc-campaign', 3, 3), check('check-2', 'pc-campaign', 4, 3), check('check-3', 'pc-hierarchy', 2, 3),
        practice('pc-campaign', 3), check('check-hook', 'pc-campaign', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Audience, medium, tone, one action.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 10, pass: 5, marking: 'plain', questions: [{ kind: 'pc-mascot', level: 3, count: 2 }, { kind: 'pc-symbol', level: 3, count: 2 }, { kind: 'pc-campaign', level: 3, count: 2 }, { kind: 'pc-hierarchy', level: 3, count: 1 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'critique', title: 'What is wrong with this poster?', minutes: 10, level: 4, summary: 'Diagnose the common mistakes, then use the checklist on your own work.', steps: [
        hook('A poster that looks good but scores nothing. Why?', 'pc-critique', 1, 4),
        { id: 'mistakes', kind: 'slide', title: 'Common mistakes', text: 'Too much small text. No single focal point. A mascot without personality. A slogan unrelated to the visual. A poster that decorates instead of communicating.' },
        check('check-1', 'pc-critique', 2, 4), check('check-2', 'pc-critique', 3, 4), check('check-3', 'pc-campaign', 1, 4),
        practice('pc-critique', 4),
        { id: 'checklist', kind: 'takeaway', body: POSTER_CHECKLIST }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 8, pass: 4, marking: 'plain', questions: [{ kind: 'pc-critique', level: 4, count: 3 }, { kind: 'pc-campaign', level: 4, count: 2 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 6, level: 5, summary: 'Mixed practice before the timed set.', steps: [
        { id: 'practice-1', kind: 'practice', question: { kind: 'pc-mascot', level: 3 }, streak: 2 },
        { id: 'checklist', kind: 'takeaway', body: POSTER_CHECKLIST }] },
    ], quiz: { title: 'Timed exam set', minutes: 10, pass: 7, marking: 'uceed', description: 'Nine poster and campaign questions at exam pace, marked like UCEED.', questions: [{ kind: 'pc-hierarchy', level: 2, count: 1 }, { kind: 'pc-slogan', level: 2, count: 2 }, { kind: 'pc-mascot', level: 3, count: 2 }, { kind: 'pc-symbol', level: 3, count: 1 }, { kind: 'pc-campaign', level: 4, count: 1 }, { kind: 'pc-critique', level: 4, count: 2 }] } },
  ],
});

const STORY_CHECKLIST = 'Checklist for your own storyboard: plan thumbnails first; setup, problem, twist, resolution; change something in every frame; keep the character identical; vary wide, close-up and reaction shots; show feelings through posture and setting; captions only for what the drawing cannot show.';
export const storyboardingProgramme = Object.freeze({
  slug: 'storyboarding', title: 'Storyboarding',
  summary: 'Tell a story in four frames, choose shots, write captions that add meaning, show a process step by step, draw motion that obeys physics, and show feelings through posture.',
  topic: 'design-sensitivity', exams: ['nid', 'nift', 'uceed'], minutes: 70, status: 'preview', pattern: 'method',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'four-frames', title: 'Four frames', minutes: 10, level: 2, summary: 'Setup, problem, twist, resolution.', steps: [
        { id: 'jobs', kind: 'slide', title: 'One job per frame', text: ['Frame 1 sets up the normal situation; frame 2 brings the problem; frame 3 a twist or escalation; frame 4 the resolution.', 'Keep the main character identical across frames; vary the camera.'] },
        check('check-1', 'sb-frames', 1, 2), check('check-2', 'sb-frames', 3, 2), check('check-3', 'sb-frames', 5, 2),
        { id: 'remember', kind: 'takeaway', body: 'Setup, problem, twist, resolution.' }] },
      { id: 'shots-captions', title: 'Shots and captions', minutes: 10, level: 2, summary: 'Wide, close-up, reaction; captions for what cannot be drawn.', steps: [
        { id: 'shots', kind: 'slide', title: 'The camera does a job', text: 'Wide shots set up the place. Close-ups show the problem in detail. Reaction shots show feeling. A caption names a feeling, a sound or a jump in time the drawing cannot show, in one short line.' },
        check('check-1', 'sb-shots', 1, 2), check('check-2', 'sb-shots', 2, 2), check('check-3', 'sb-caption', 1, 2), check('check-4', 'sb-caption', 2, 2),
        { id: 'remember', kind: 'takeaway', body: 'Wide to set up, close-up for detail, reaction for feeling. Captions only add.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 6, pass: 5, marking: 'plain', questions: [{ kind: 'sb-frames', level: 2, count: 2 }, { kind: 'sb-shots', level: 2, count: 2 }, { kind: 'sb-caption', level: 2, count: 2 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'process', title: 'Process sequences', minutes: 10, level: 3, summary: 'The steps that change the material.', steps: [
        hook('Raw material to product, jumbled.', 'sb-process', 1, 3),
        { id: 'verbs', kind: 'slide', title: 'One action per frame', text: 'Name the start material and the end product. Keep the three or four steps that really change it, each around one action verb: wash, cut, cook, pack. Arrows point forward.' },
        worked('sb-process', 2, 3),
        check('check-1', 'sb-process', 3, 3), check('check-2', 'sb-process', 4, 3),
        practice('sb-process', 3), check('check-hook', 'sb-process', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Material changes in every frame.' }] },
      { id: 'movement', title: 'Movement that obeys physics', minutes: 10, level: 3, summary: 'Spacing shows speed.', steps: [
        hook('A swinging pendulum in five frames.', 'sb-movement', 1, 3),
        { id: 'spacing', kind: 'slide', title: 'Spacing shows speed', text: 'At equal time steps, big gaps between frames mean fast motion and small gaps slow motion. A pendulum is fastest at the bottom, so frames bunch near the ends of the swing, symmetrically.' },
        worked('sb-movement', 2, 3),
        check('check-1', 'sb-movement', 3, 3), check('check-2', 'sb-emotion', 1, 3), check('check-3', 'sb-emotion', 2, 3),
        practice('sb-emotion', 3), check('check-hook', 'sb-movement', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Fast: wide spacing. Slow: tight spacing. Feelings: posture first.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 10, pass: 5, marking: 'plain', questions: [{ kind: 'sb-process', level: 3, count: 2 }, { kind: 'sb-movement', level: 3, count: 2 }, { kind: 'sb-emotion', level: 3, count: 2 }, { kind: 'sb-frames', level: 3, count: 1 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'critique', title: 'What is wrong with this storyboard?', minutes: 10, level: 4, summary: 'Diagnose the common mistakes, then use the checklist.', steps: [
        hook('Four frames that do not tell a story. Why?', 'sb-critique', 1, 4),
        { id: 'mistakes', kind: 'slide', title: 'Common mistakes', text: 'Disconnected drawings. No visible change between frames. Too much text. An inconsistent character. No beginning, middle and end. A process shown only as before and after.' },
        check('check-1', 'sb-critique', 2, 4), check('check-2', 'sb-critique', 3, 4), check('check-3', 'sb-movement', 1, 4),
        practice('sb-critique', 4),
        { id: 'checklist', kind: 'takeaway', body: STORY_CHECKLIST }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 8, pass: 4, marking: 'plain', questions: [{ kind: 'sb-critique', level: 4, count: 3 }, { kind: 'sb-movement', level: 4, count: 2 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 6, level: 5, summary: 'Mixed practice before the timed set.', steps: [
        { id: 'practice-1', kind: 'practice', question: { kind: 'sb-process', level: 3 }, streak: 2 },
        { id: 'checklist', kind: 'takeaway', body: STORY_CHECKLIST }] },
    ], quiz: { title: 'Timed exam set', minutes: 10, pass: 7, marking: 'uceed', description: 'Nine storyboarding questions at exam pace, marked like UCEED.', questions: [{ kind: 'sb-frames', level: 2, count: 1 }, { kind: 'sb-shots', level: 2, count: 1 }, { kind: 'sb-caption', level: 2, count: 1 }, { kind: 'sb-process', level: 3, count: 2 }, { kind: 'sb-movement', level: 4, count: 2 }, { kind: 'sb-critique', level: 4, count: 2 }] } },
  ],
});
