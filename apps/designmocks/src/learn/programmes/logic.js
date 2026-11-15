// Three reasoning programmes built on src/learn/logic.js: codes and number
// patterns, arrangements and puzzles, and directions, clocks and calendars.
// Specification: docs/learn/topics/logic.md.
const lab = mode => ({ tool: 'logic-lab', props: { mode } });
const check = (id, kind, seed, level) => ({ id, kind: 'check', question: { kind, seed, level } });
const hook = (text, kind, seed, level) => ({ id: 'hook', kind: 'hook', text, question: { kind, seed, level } });
const worked = (kind, seed, level) => ({ id: 'worked-1', kind: 'worked', question: { kind, seed, level } });
const practice = (kind, level) => ({ id: 'practice', kind: 'practice', question: { kind, level }, streak: 3 });
const review = (title, text, kinds, body) => ({
  id: 'review', title: 'Mixed review', minutes: 8, level: 5, summary: 'The methods once more, then mixed practice before the timed set.',
  steps: [{ id: 'methods', kind: 'slide', title, text }, { id: 'pace', kind: 'slide', title: 'Exam pace and marking', text: 'About a minute and a half a question. Single-choice questions lose marks when wrong: check your answer against every clue before you choose.' }, ...kinds.map(([kind, level], i) => ({ id: `practice-${i + 1}`, kind: 'practice', question: { kind, level }, streak: 2 })), { id: 'remember', kind: 'takeaway', body }],
});

export const codesPatternsProgramme = Object.freeze({
  slug: 'codes-patterns', title: 'Codes and number patterns',
  summary: 'Number series, letter codes, symbol codes and number figures: find the rule, then use it.',
  topic: 'logical-reasoning', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 90, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'series', title: 'What comes next', minutes: 8, level: 1, summary: 'Write the gaps between numbers; the rule is usually in the gaps.', steps: [
        { id: 'gaps', kind: 'slide', title: 'Look at the gaps', text: 'Subtract each number from the next. If the gaps are equal, add the gap. If each number is a multiple of the last, multiply.' },
        check('check-1', 'number-series', 1, 1), check('check-2', 'number-series', 2, 1), check('check-3', 'number-series', 5, 1), check('check-4', 'number-series', 7, 1),
        { id: 'remember', kind: 'takeaway', body: 'Gaps first. Equal gaps: add. Growing by the same factor: multiply.' }] },
      { id: 'letter-codes', title: 'Letter codes', minutes: 8, level: 2, summary: 'Each letter moves the same number of places along the alphabet.', steps: [
        { id: 'shift', kind: 'slide', title: 'Move along the alphabet', text: 'Compare the first letter of the word with the first letter of its code. Count how far it moved. Check that every other letter moved the same way.', ...lab('shift'), hint: 'Move the slider and watch every letter shift together.' },
        { id: 'backwards', kind: 'slide', title: 'Sometimes it is written backwards', text: 'If the first letter of the code matches the last letter of the word, the code is reversed. Check both ends.' },
        check('check-1', 'letter-shift', 1, 2), check('check-2', 'letter-shift', 2, 2), check('check-3', 'letter-shift', 3, 2), check('check-4', 'letter-shift', 5, 2),
        { id: 'remember', kind: 'takeaway', body: 'Find the shift from one letter, check it on the rest, and check both ends for a reversal.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 6, pass: 6, marking: 'plain', questions: [{ kind: 'number-series', level: 1, count: 4 }, { kind: 'letter-shift', level: 2, count: 4 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'harder-series', title: 'Harder series', minutes: 12, level: 3, summary: 'Primes, squares, growing gaps and two series taking turns.', steps: [
        hook('The gaps are not equal. They are still a pattern.', 'series-rule', 1, 3),
        { id: 'gap-series', kind: 'slide', title: 'The gaps have their own pattern', text: 'If the gaps grow by the same amount, the gaps form a series of their own. Odd, uneven gaps often mean primes; numbers near squares mean squares plus or minus one.' },
        { id: 'turns', kind: 'slide', title: 'Two series taking turns', text: 'If every other number fits a simple rule, split the series into the 1st, 3rd, 5th… and the 2nd, 4th, 6th… and solve each.' },
        worked('series-rule', 2, 3),
        check('check-1', 'series-rule', 3, 3), check('check-2', 'series-rule', 4, 3), check('check-3', 'series-rule', 6, 3),
        practice('series-rule', 3), check('check-hook', 'series-rule', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Gaps of gaps, primes, squares, or two series in turn. Test each before guessing.' }] },
      { id: 'symbol-codes', title: 'Symbol codes', minutes: 12, level: 3, summary: 'Words written in symbols: find each letter\'s symbol from the words that share it.', steps: [
        hook('Three words and their codes. One letter at a time, the code gives itself away.', 'word-code', 1, 3),
        { id: 'shared', kind: 'slide', title: 'Shared letters, shared symbols', text: 'Find two words with one letter in common. The symbol their codes share is that letter\'s code. Then check whether the code runs forwards or backwards.' },
        worked('word-code', 2, 3),
        check('check-1', 'word-code', 3, 3), check('check-2', 'word-code', 4, 3), check('check-3', 'word-code', 7, 3),
        practice('word-code', 3), check('check-hook', 'word-code', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Shared letters give shared symbols. Then check the order.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 12, pass: 6, marking: 'plain', questions: [{ kind: 'series-rule', level: 3, count: 4 }, { kind: 'word-code', level: 3, count: 4 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'number-figures', title: 'Number figures', minutes: 14, level: 4, summary: 'Four numbers around a centre, made by one rule that works for every figure.', steps: [
        hook('The same rule makes the middle number in every figure.', 'figure-number', 1, 4),
        { id: 'try-rules', kind: 'slide', title: 'Try rules in order', text: 'Start simple: add all four. Then pairs: top with bottom, left with right, multiplied or added. A rule counts only if it works for every complete figure.' },
        worked('figure-number', 2, 4),
        check('check-1', 'figure-number', 3, 4), check('check-2', 'figure-number', 5, 4), check('check-3', 'figure-number', 6, 4),
        practice('figure-number', 4), check('check-hook', 'figure-number', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Test a rule on every complete figure before using it on the last.' }] },
      { id: 'wrong-term', title: 'The number that does not fit', minutes: 10, level: 4, summary: 'One number has been changed. It spoils two gaps next to each other.', steps: [
        hook('Every number but one fits the rule.', 'series-odd', 1, 4),
        { id: 'two-gaps', kind: 'slide', title: 'One wrong number, two wrong gaps', text: 'Write all the gaps. A wrong number makes the gap before it and the gap after it both odd. The number between those two gaps is the one to change.' },
        check('check-1', 'series-odd', 2, 4), check('check-2', 'series-odd', 3, 4), check('check-3', 'series-odd', 4, 4),
        practice('series-odd', 4), check('check-hook', 'series-odd', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Look for two neighbouring gaps that break the pattern; the number between them is wrong.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 14, pass: 5, marking: 'plain', questions: [{ kind: 'figure-number', level: 4, count: 3 }, { kind: 'series-odd', level: 4, count: 3 }, { kind: 'word-code', level: 3, count: 2 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [review('Find the rule, then use it', 'Series: gaps, then gaps of gaps, primes, squares or two series. Codes: shift or symbol per letter, then the order. Figures: one rule for every figure.', [['series-rule', 3], ['figure-number', 4]], 'The rule must fit everything you are given before you use it.')],
      quiz: { title: 'Timed exam set', minutes: 16, pass: 9, marking: 'uceed', description: 'Twelve pattern and code questions at exam pace, marked like UCEED.', questions: [{ kind: 'series-rule', level: 3, count: 3 }, { kind: 'word-code', level: 3, count: 2 }, { kind: 'letter-shift', level: 2, count: 1 }, { kind: 'figure-number', level: 4, count: 3 }, { kind: 'series-odd', level: 4, count: 3 }] } },
  ],
});

export const arrangementsProgramme = Object.freeze({
  slug: 'arrangements', title: 'Arrangements and puzzles',
  summary: 'Order people from clues, seat them in a row or round a table, crack symbol sums, follow rules in order and count handshakes.',
  topic: 'logical-reasoning', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 90, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'ranking', title: 'Putting people in order', minutes: 8, level: 1, summary: 'Each comparison links two people; chain them into one line.', steps: [
        { id: 'chain', kind: 'slide', title: 'Make one line', text: 'Write the names in a column as you read. "A is taller than B" puts A above B. Each new fact slots someone in above or below.' },
        check('check-1', 'ranking', 1, 1), check('check-2', 'ranking', 3, 1), check('check-3', 'ranking', 4, 1), check('check-4', 'ranking', 5, 1),
        { id: 'remember', kind: 'takeaway', body: 'One line, built a fact at a time. Read the question\'s position carefully.' }] },
      { id: 'rows', title: 'Seats in a row', minutes: 10, level: 2, summary: 'Place the fixed people first, then the ones tied to them.', steps: [
        { id: 'fixed-first', kind: 'slide', title: 'Fixed first', text: 'Start with clues that pin someone to a seat: an end, the middle, next to someone already placed. Leave "not next to" clues for last; they only rule things out.', ...lab('seats'), hint: 'Tap two people to swap them, until every clue holds.' },
        check('check-1', 'row-seating', 1, 2), check('check-2', 'row-seating', 2, 2), check('check-3', 'row-seating', 3, 2), check('check-4', 'row-seating', 8, 2),
        { id: 'remember', kind: 'takeaway', body: 'Pin the fixed seats, link the neighbours, use "not" clues last.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'ranking', level: 1, count: 4 }, { kind: 'row-seating', level: 2, count: 4 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'round-table', title: 'Round a table', minutes: 12, level: 3, summary: 'Facing the centre, left and right swap compared with the page.', steps: [
        hook('Six people facing the centre. Left and right are theirs, not yours.', 'circle-seating', 1, 3),
        { id: 'left', kind: 'slide', title: 'Whose left?', text: 'Seen from above, with everyone facing the centre, each person\'s left hand points to the next seat clockwise. Draw the table and an arrow for one person before you place anyone.' },
        { id: 'anchor', kind: 'slide', title: 'Anchor one person', text: 'A circle has no first seat. Put one person at the top and place everyone else relative to them. Opposite clues fix two seats at once.' },
        worked('circle-seating', 2, 3),
        check('check-1', 'circle-seating', 3, 3), check('check-2', 'circle-seating', 4, 3), check('check-3', 'circle-seating', 6, 3),
        practice('circle-seating', 3), check('check-hook', 'circle-seating', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Anchor one person. Facing in, left is clockwise seen from above. Opposite clues first.' }] },
      { id: 'symbol-sums', title: 'Sums in symbols', minutes: 12, level: 3, summary: 'Symbols that add like the digits of a small number base.', steps: [
        hook('Each symbol is a digit. Find which, and how they carry.', 'symbol-sum', 1, 3),
        { id: 'zero', kind: 'slide', title: 'Find nothing first', text: 'The symbol that changes nothing when added is 0. A sum of two single symbols that gives two symbols is a carry: the base is small.' },
        worked('symbol-sum', 2, 3),
        check('check-1', 'symbol-sum', 3, 3), check('check-2', 'symbol-sum', 4, 3), check('check-3', 'symbol-sum', 6, 3),
        practice('symbol-sum', 3), check('check-hook', 'symbol-sum', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Zero first, then the carry. Then read every symbol string as a number.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 14, pass: 6, marking: 'plain', questions: [{ kind: 'circle-seating', level: 3, count: 4 }, { kind: 'symbol-sum', level: 3, count: 3 }, { kind: 'row-seating', level: 2, count: 1 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'rules-in-order', title: 'Rules in order', minutes: 12, level: 4, summary: 'A row of symbols changed by several rules, one after another.', steps: [
        hook('Four rules, in order. Do not do two in your head at once.', 'rule-sequence', 1, 4),
        { id: 'write', kind: 'slide', title: 'Write the row after every rule', text: 'Number the positions above the row. Apply rule 1 and write the new row. Apply rule 2 to that row, and so on.' },
        worked('rule-sequence', 2, 4),
        check('check-1', 'rule-sequence', 3, 4), check('check-2', 'rule-sequence', 4, 4), check('check-3', 'rule-sequence', 6, 4),
        practice('rule-sequence', 4), check('check-hook', 'rule-sequence', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'A new row after every rule. Wrong options skip a rule or swap the order.' }] },
      { id: 'handshakes', title: 'Handshakes', minutes: 10, level: 4, summary: 'Count the pairs: everyone with everyone, or one group with another.', steps: [
        hook('Each handshake is one pair.', 'handshakes', 1, 4),
        { id: 'pairs', kind: 'slide', title: 'Pairs, not people', text: 'n people all shaking hands make n(n − 1) ÷ 2 handshakes. One group of a with another of b, and no one else, makes a × b.' },
        check('check-1', 'handshakes', 2, 4), check('check-2', 'handshakes', 3, 4), check('check-3', 'handshakes', 4, 4),
        practice('handshakes', 4), check('check-hook', 'handshakes', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Everyone with everyone: n(n − 1) ÷ 2. Group with group: a × b.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 14, pass: 5, marking: 'plain', questions: [{ kind: 'rule-sequence', level: 4, count: 3 }, { kind: 'handshakes', level: 4, count: 2 }, { kind: 'circle-seating', level: 3, count: 2 }, { kind: 'symbol-sum', level: 3, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [review('Place, then check every clue', 'Rows: fixed seats first. Tables: anchor one person; facing in, left is clockwise seen from above. Symbol sums: zero, then the carry. Rules: a new row each time.', [['circle-seating', 3], ['rule-sequence', 4]], 'Before choosing, check your arrangement against every clue.')],
      quiz: { title: 'Timed exam set', minutes: 18, pass: 9, marking: 'uceed', description: 'Twelve arrangement and puzzle questions at exam pace, marked like UCEED.', questions: [{ kind: 'row-seating', level: 2, count: 2 }, { kind: 'circle-seating', level: 3, count: 3 }, { kind: 'symbol-sum', level: 3, count: 2 }, { kind: 'rule-sequence', level: 4, count: 3 }, { kind: 'handshakes', level: 4, count: 2 }] } },
  ],
});

export const directionsProgramme = Object.freeze({
  slug: 'directions', title: 'Directions, clocks and calendars',
  summary: 'Follow a walk, trace a family, find the day of the week, correct a clock and find the fewest doors through a maze.',
  topic: 'logical-reasoning', exams: ['uceed', 'ceed', 'nid', 'nift'], minutes: 90, status: 'preview',
  tiers: [
    { id: 'foundations', title: 'Foundations', level: 2, lessons: [
      { id: 'turns', title: 'Left and right turns', minutes: 8, level: 1, summary: 'A turn depends on the way you are facing at that moment.', steps: [
        { id: 'facing', kind: 'slide', title: 'Turn from where you face', text: 'Facing north, a right turn faces east. Facing south, a right turn faces west. Keep track of your heading after every turn.', ...lab('compass'), hint: 'Walk a few metres, turn, walk again. Watch the heading and the distance.' },
        check('check-1', 'direction-facing', 1, 1), check('check-2', 'direction-facing', 3, 1), check('check-3', 'direction-facing', 5, 1), check('check-4', 'direction-facing', 7, 1),
        { id: 'remember', kind: 'takeaway', body: 'Right turns go clockwise round the compass, left turns anticlockwise, from wherever you face.' }] },
      { id: 'distance', title: 'How far from the start', minutes: 8, level: 2, summary: 'Add the east–west parts and the north–south parts, then use Pythagoras.', steps: [
        { id: 'parts', kind: 'slide', title: 'Two totals and a triangle', text: 'Add every east step and take away every west step. Do the same for north and south. The straight-line distance is √(across² + up²).' },
        check('check-1', 'direction-distance', 1, 2), check('check-2', 'direction-distance', 2, 2), check('check-3', 'direction-distance', 4, 2), check('check-4', 'direction-distance', 7, 2),
        { id: 'remember', kind: 'takeaway', body: 'Across total, up total, then Pythagoras. Distance walked is not distance from the start.' }] },
    ], quiz: { title: 'Foundations quiz', minutes: 8, pass: 6, marking: 'plain', questions: [{ kind: 'direction-facing', level: 1, count: 4 }, { kind: 'direction-distance', level: 2, count: 4 }] } },
    { id: 'exam-standard', title: 'Exam standard', level: 3, lessons: [
      { id: 'relations', title: 'Family relations', minutes: 12, level: 3, summary: 'Draw the tree: generations up and down, brothers and sisters across.', steps: [
        hook('Three links in a chain. Draw it rather than say it.', 'relations', 1, 3),
        { id: 'tree', kind: 'slide', title: 'Draw a small tree', text: 'Parents above, children below, brothers and sisters side by side. Count generations up and down, and note whether the chain went sideways.' },
        worked('relations', 2, 3),
        check('check-1', 'relations', 3, 3), check('check-2', 'relations', 4, 3), check('check-3', 'relations', 6, 3),
        practice('relations', 3), check('check-hook', 'relations', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Up for parents, down for children, across for siblings. The last link gives male or female.' }] },
      { id: 'days-clocks', title: 'Days and clocks', minutes: 12, level: 3, summary: 'Odd days after whole weeks, and a clock that gains or loses steadily.', steps: [
        hook('Whole weeks change nothing. Only the days left over move the day of the week.', 'day-of-week', 1, 3),
        { id: 'odd-days', kind: 'slide', title: 'Count the odd days', text: 'Count the days from one date to the other, month by month. Divide by 7; the remainder is how many days the weekday moves on.' },
        check('check-1', 'day-of-week', 2, 3), check('check-2', 'day-of-week', 4, 3),
        { id: 'gain', kind: 'slide', title: 'A clock that gains', text: 'A clock gaining 4 minutes an hour is 4 × h minutes ahead after h hours. Count the hours from when it was set right.' },
        check('check-3', 'clock-gain', 1, 3), check('check-4', 'clock-gain', 2, 3),
        practice('day-of-week', 3), check('check-hook', 'day-of-week', 1, 3),
        { id: 'remember', kind: 'takeaway', body: 'Days: the remainder after whole weeks. Clocks: gain per hour × hours since set.' }] },
    ], quiz: { title: 'Exam standard quiz', minutes: 12, pass: 6, marking: 'plain', questions: [{ kind: 'relations', level: 3, count: 3 }, { kind: 'day-of-week', level: 3, count: 3 }, { kind: 'clock-gain', level: 3, count: 2 }] } },
    { id: 'exam-hard', title: 'Exam hard', level: 4, lessons: [
      { id: 'mazes', title: 'Fewest doors through a maze', minutes: 14, level: 4, summary: 'Spread out from the start one opening at a time, and the first number to reach the end is the least.', steps: [
        hook('The shortest path is not the one with the fewest doors. Count doors, not steps.', 'maze-openings', 1, 4),
        { id: 'flood', kind: 'slide', title: 'Number the rooms', text: 'Write 0 in the start room. Write 1 in every room one opening away, 2 in rooms one more opening on, and so on. Never overwrite a number.' },
        worked('maze-openings', 2, 4),
        check('check-1', 'maze-openings', 3, 4), check('check-2', 'maze-openings', 4, 4), check('check-3', 'maze-openings', 8, 4),
        practice('maze-openings', 4), check('check-hook', 'maze-openings', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Number the rooms outward from the start. The first number the target gets is the answer.' }] },
      { id: 'calendars', title: 'When a calendar repeats', minutes: 10, level: 4, summary: 'An ordinary year moves the days on by one, a leap year by two.', steps: [
        hook('Seven years is a common guess, and usually wrong.', 'calendar-repeat', 1, 4),
        { id: 'odd', kind: 'slide', title: 'Add odd days year by year', text: 'An ordinary year is 52 weeks and 1 day; a leap year, 52 weeks and 2 days. Add them year by year until the total is a multiple of 7, and the new year is a leap year exactly when the old one was.' },
        check('check-1', 'calendar-repeat', 2, 4), check('check-2', 'calendar-repeat', 3, 4), check('check-3', 'calendar-repeat', 5, 4),
        practice('calendar-repeat', 4), check('check-hook', 'calendar-repeat', 1, 4),
        { id: 'remember', kind: 'takeaway', body: 'Odd days add to a multiple of 7, and the leap years match. Then the calendar repeats.' }] },
    ], quiz: { title: 'Exam hard quiz', minutes: 14, pass: 5, marking: 'plain', questions: [{ kind: 'maze-openings', level: 4, count: 3 }, { kind: 'calendar-repeat', level: 4, count: 2 }, { kind: 'relations', level: 3, count: 2 }, { kind: 'direction-distance', level: 2, count: 1 }] } },
    { id: 'mastery', title: 'Mastery', level: 5, lessons: [review('Draw it, count it', 'Walks: track the heading. Families: draw the tree. Days: odd days after whole weeks. Mazes: number the rooms outward.', [['relations', 3], ['maze-openings', 4]], 'Every one of these is easier drawn than imagined.')],
      quiz: { title: 'Timed exam set', minutes: 18, pass: 9, marking: 'uceed', description: 'Twelve direction, clock and calendar questions at exam pace, marked like UCEED.', questions: [{ kind: 'direction-distance', level: 2, count: 2 }, { kind: 'relations', level: 3, count: 3 }, { kind: 'day-of-week', level: 3, count: 2 }, { kind: 'clock-gain', level: 3, count: 1 }, { kind: 'maze-openings', level: 4, count: 2 }, { kind: 'calendar-repeat', level: 4, count: 2 }] } },
  ],
});
