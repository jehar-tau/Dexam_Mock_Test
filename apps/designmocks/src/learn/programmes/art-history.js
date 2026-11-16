// Art and design history on the recall pattern. Facts live in
// src/learn/decks/history.js. Specification: docs/learn/topics/art-history.md.
import { creditsFor, imageFor } from '../decks/images.js';
import { artDeck, designDeck, heritageDeck } from '../decks/history.js';
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });

export const artHistoryProgramme = Object.freeze({
  slug: 'art-history', title: 'Art and design history',
  summary: 'Indian painting and crafts, monuments, classical dance and music, and the design classics and schools that shaped modern design.',
  topic: 'design-sensitivity', exams: ['nid', 'nift', 'uceed', 'ceed'], minutes: 90, status: 'preview', pattern: 'recall',
  credits: creditsFor([artDeck, heritageDeck, designDeck].flatMap(d => d.facts.map(f => f.name))),
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'painting', title: 'Painting and crafts', minutes: 10, level: 2, summary: 'Eight painting traditions and seven crafts, by region and look.', steps: [
        { id: 'paint', kind: 'slide', title: 'Painting traditions', figure: { type: 'photo-row', items: [{ image: imageFor('Ajanta murals'), label: 'Ajanta murals' }, { image: imageFor('Madhubani'), label: 'Madhubani' }, { image: imageFor('Warli'), label: 'Warli' }, { image: imageFor('Pattachitra'), label: 'Pattachitra' }, { image: imageFor('Tanjore painting'), label: 'Tanjore painting' }, { image: imageFor('Mughal miniature'), label: 'Mughal miniature' }, { image: imageFor('Kangra painting'), label: 'Kangra painting' }, { image: imageFor('Kishangarh painting'), label: 'Kishangarh painting' }, { image: imageFor('Raja Ravi Varma'), label: 'Raja Ravi Varma' }, { image: imageFor('Bengal School'), label: 'Bengal School' }].filter(i => i.image) }, text: ['Ajanta, Maharashtra: Buddhist cave murals. Madhubani, Bihar: pattern in every inch. Warli, Maharashtra: white stick figures on mud red. Pattachitra, Odisha: cloth scrolls outlined in black. Tanjore, Tamil Nadu: raised gold leaf.', 'Mughal miniatures: court life in Persian technique. Kangra, Punjab hills: dreamlike Radha–Krishna. Kishangarh: Bani Thani. Raja Ravi Varma: oils of the gods. Bengal School: Abanindranath Tagore’s watercolours.'] },
        { id: 'crafts', kind: 'slide', title: 'Crafts by region', figure: { type: 'photo-row', items: [{ image: imageFor('Pashmina'), label: 'Pashmina' }, { image: imageFor('Blue pottery'), label: 'Blue pottery' }, { image: imageFor('Bidriware'), label: 'Bidriware' }, { image: imageFor('Dhokra'), label: 'Dhokra' }, { image: imageFor('Kalamkari'), label: 'Kalamkari' }, { image: imageFor('Channapatna toys'), label: 'Channapatna toys' }].filter(i => i.image) }, text: 'Pashmina, Kashmir. Blue pottery and Meenakari, Jaipur. Bidriware, Bidar. Dhokra, Chhattisgarh, Odisha and Bengal. Kalamkari, Andhra Pradesh. Channapatna toys, Karnataka.' },
        check('check-1', 'art-name', 1, 1), check('check-2', 'art-name', 2, 1), check('check-3', 'art-which', 1, 2), check('check-4', 'art-identify', 1, 2), check('check-5', 'art-identify', 2, 2),
        { id: 'remember', kind: 'takeaway', body: 'Pair every tradition with its region and one look you would recognise.' }] },
      { id: 'heritage', title: 'Monuments, dance and music', minutes: 10, level: 2, summary: 'Eight monuments, eight classical dances, and the instruments of two traditions.', steps: [
        { id: 'monuments', kind: 'slide', title: 'Monuments', figure: { type: 'photo-row', items: [{ image: imageFor('Taj Mahal'), label: 'Taj Mahal' }, { image: imageFor('Qutub Minar'), label: 'Qutub Minar' }, { image: imageFor('Red Fort'), label: 'Red Fort' }, { image: imageFor('Khajuraho temples'), label: 'Khajuraho temples' }, { image: imageFor('Konark Sun Temple'), label: 'Konark Sun Temple' }, { image: imageFor('Hampi'), label: 'Hampi' }, { image: imageFor('Ajanta and Ellora caves'), label: 'Ajanta and Ellora caves' }, { image: imageFor('Meenakshi Amman Temple'), label: 'Meenakshi Amman Temple' }].filter(i => i.image) }, text: 'Taj Mahal, Agra; Qutub Minar and Red Fort, Delhi; Khajuraho, Madhya Pradesh; Konark, Odisha; Hampi, Karnataka; Ajanta and Ellora, Maharashtra; Meenakshi, Madurai.' },
        { id: 'dance', kind: 'slide', title: 'Dance and music', figure: { type: 'photo-row', items: [{ image: imageFor('Bharatanatyam'), label: 'Bharatanatyam' }, { image: imageFor('Kathak'), label: 'Kathak' }, { image: imageFor('Kathakali'), label: 'Kathakali' }, { image: imageFor('Odissi'), label: 'Odissi' }, { image: imageFor('Kuchipudi'), label: 'Kuchipudi' }, { image: imageFor('Mohiniyattam'), label: 'Mohiniyattam' }, { image: imageFor('Sattriya'), label: 'Sattriya' }, { image: imageFor('Sitar'), label: 'Sitar' }, { image: imageFor('Sarod'), label: 'Sarod' }, { image: imageFor('Tabla'), label: 'Tabla' }, { image: imageFor('Veena'), label: 'Veena' }, { image: imageFor('Mridangam'), label: 'Mridangam' }, { image: imageFor('Bansuri'), label: 'Bansuri' }, { image: imageFor('Tanpura'), label: 'Tanpura' }].filter(i => i.image) }, text: ['Bharatanatyam, Tamil Nadu; Kathak, North India; Kathakali and Mohiniyattam, Kerala; Odissi, Odisha; Kuchipudi, Andhra Pradesh; Manipuri, Manipur; Sattriya, Assam.', 'Hindustani: sitar, sarod, tabla, bansuri. Carnatic: veena, mridangam. Both: tanpura.'] },
        check('check-1', 'her-name', 1, 1), check('check-2', 'her-name', 2, 1), check('check-3', 'her-which', 1, 2), check('check-4', 'her-identify', 1, 2), check('check-5', 'her-identify', 2, 2),
        { id: 'remember', kind: 'takeaway', body: 'Kerala has two dances: Kathakali (painted faces) and Mohiniyattam (white and gold).' }] },
      { id: 'design', title: 'Design classics', minutes: 8, level: 2, summary: 'Who designed which classic, and the schools behind them.', steps: [
        { id: 'classics', kind: 'slide', title: 'Chairs, radios and computers', figure: { type: 'photo-row', items: [{ image: imageFor('Thonet No. 14 chair'), label: 'Thonet No. 14 chair' }, { image: imageFor('Barcelona Chair'), label: 'Barcelona Chair' }, { image: imageFor('Wassily Chair'), label: 'Wassily Chair' }, { image: imageFor('Eames Lounge Chair'), label: 'Eames Lounge Chair' }, { image: imageFor('Braun SK4 radio-phonograph'), label: 'Braun SK4 radio-phonograph' }, { image: imageFor('Apple iMac G3'), label: 'Apple iMac G3' }, { image: imageFor('Bauhaus'), label: 'Bauhaus' }].filter(i => i.image) }, text: ['Thonet No. 14 (1859), Michael Thonet. Barcelona Chair (1929), Mies van der Rohe and Lilly Reich. Wassily Chair, Marcel Breuer at the Bauhaus.', 'Eames Lounge Chair (1956), Charles and Ray Eames. Braun SK4 (1956), Dieter Rams and Hans Gugelot. iMac G3 (1998), Jonathan Ive. NID was founded in Ahmedabad in 1961.'] },
        check('check-1', 'des-name', 1, 1), check('check-2', 'des-name', 2, 1), check('check-3', 'des-which', 1, 2), check('check-4', 'des-identify', 1, 2),
        { id: 'remember', kind: 'takeaway', body: 'Learn each classic as product, designer and year.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 7, marking: 'plain', questions: [{ kind: 'art-name', level: 1, count: 2 }, { kind: 'art-which', level: 2, count: 1 }, { kind: 'her-name', level: 1, count: 3 }, { kind: 'her-which', level: 2, count: 1 }, { kind: 'des-name', level: 1, count: 2 }, { kind: 'des-which', level: 2, count: 1 }, { kind: 'art-identify', level: 2, count: 1 }, { kind: 'her-identify', level: 2, count: 1 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'match-art', title: 'Match the following: art', minutes: 10, level: 3, summary: 'Traditions and crafts against regions and looks.', steps: [
        hook('Match each tradition with its region.', 'art-match', 1, 3),
        check('check-1', 'art-match', 2, 3), check('check-2', 'art-odd', 1, 3), check('check-3', 'art-odd', 2, 3),
        practice('art-match', 3), check('check-hook', 'art-match', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Surest pair first, then strike out options.' }] },
      { id: 'match-heritage', title: 'Match the following: heritage', minutes: 10, level: 3, summary: 'Monuments, dances and instruments.', steps: [
        hook('Match each dance or monument with its region.', 'her-match', 1, 3),
        check('check-1', 'her-match', 2, 3), check('check-2', 'her-odd', 1, 3), check('check-3', 'her-odd', 2, 3),
        practice('her-match', 3), check('check-hook', 'her-match', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Group first: monument, dance or instrument. Then region.' }] },
      { id: 'match-design', title: 'Designers and their work', minutes: 8, level: 3, summary: 'Match designers to classics.', steps: [
        hook('Match each classic with its designer.', 'des-match', 1, 3),
        check('check-1', 'des-match', 2, 3), check('check-2', 'des-odd', 1, 3),
        practice('des-match', 3), check('check-hook', 'des-match', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Product, designer, year: learn them as one.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 12, pass: 6, marking: 'plain', questions: [{ kind: 'art-identify', level: 3, count: 2 }, { kind: 'her-identify', level: 3, count: 1 }, { kind: 'art-match', level: 3, count: 2 }, { kind: 'art-odd', level: 3, count: 1 }, { kind: 'her-match', level: 3, count: 2 }, { kind: 'her-odd', level: 3, count: 1 }, { kind: 'des-match', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'timelines', title: 'Timelines', minutes: 10, level: 4, summary: 'Put monuments, paintings and design classics in date order.', steps: [
        hook('Six monuments. Which came first?', 'her-order', 1, 4),
        { id: 'anchors', kind: 'slide', title: 'Anchor dates', text: ['Monuments: Ajanta and Ellora from the 2nd century BCE; Khajuraho about 1000 CE; Qutub Minar 1192; Konark 13th century; Hampi 14th–16th; Taj Mahal 1632–1653.', 'Design: Thonet 1859, Bauhaus 1919, Barcelona 1929, Eames and Braun 1956, NID 1961, iMac 1998.'] },
        check('check-1', 'her-order', 2, 4), check('check-2', 'des-order', 1, 4), check('check-3', 'art-order', 1, 4),
        practice('des-order', 4), check('check-hook', 'her-order', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Learn a few anchor dates; place everything else around them.' }] },
      { id: 'two-conditions', title: 'Two conditions and four pairs', minutes: 10, level: 4, summary: 'Group and region together; matching four pairs.', steps: [
        hook('A dance from this region, not just any dance.', 'her-two', 1, 4),
        check('check-1', 'her-two', 2, 4), check('check-2', 'art-two', 1, 4), check('check-3', 'art-match', 1, 4), check('check-4', 'her-match', 1, 4),
        practice('art-two', 4), check('check-hook', 'her-two', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Both conditions, every option.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 12, pass: 6, marking: 'plain', questions: [{ kind: 'her-order', level: 4, count: 2 }, { kind: 'des-order', level: 4, count: 1 }, { kind: 'her-two', level: 4, count: 2 }, { kind: 'art-two', level: 4, count: 1 }, { kind: 'art-match', level: 4, count: 1 }, { kind: 'des-match', level: 4, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [
      { id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'Mixed practice before the timed set.', steps: [
        { id: 'how', kind: 'slide', title: 'Revising facts', text: 'Learn in groups and pairs: tradition and region, classic and designer, monument and date. Test yourself the way the exam asks: matching and ordering.' },
        { id: 'practice-1', kind: 'practice', question: { kind: 'her-match', level: 4 }, streak: 2 },
        { id: 'practice-2', kind: 'practice', question: { kind: 'des-match', level: 3 }, streak: 2 },
        { id: 'remember', kind: 'takeaway', body: 'Groups, pairs, anchor dates.' }] },
    ], quiz: { title: 'Timed exam set', minutes: 12, pass: 10, marking: 'uceed', description: 'Fourteen art and design history questions at exam pace, marked like UCEED.', questions: [{ kind: 'art-name', level: 1, count: 2 }, { kind: 'art-match', level: 3, count: 2 }, { kind: 'her-name', level: 1, count: 2 }, { kind: 'her-match', level: 4, count: 2 }, { kind: 'her-order', level: 4, count: 1 }, { kind: 'des-name', level: 1, count: 2 }, { kind: 'des-match', level: 3, count: 2 }, { kind: 'des-order', level: 4, count: 1 }] } },
  ],
});
