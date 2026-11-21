// Only imported by the development/staging review route. The drawings and
// questions are original DMocks samples. This adapter has no network client.
const illustration = (body, alt) => ({
  alt,
  url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="236" viewBox="0 0 640 236">' +
    '<rect width="640" height="236" fill="#f8f5e9"/>' + body + '</svg>'),
});
const tiles = [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],[3,2]];
const mosaic = illustration(tiles.map(([x,y],i) => '<rect x="' + (206+x*56) + '" y="' + (32+y*56) + '" width="56" height="56" fill="' + (i % 2 ? '#9abc9d' : '#2d6854') + '" stroke="#f8f5e9" stroke-width="2"/>').join(""),
  "Nine square tiles. The first row has three adjacent tiles. The second row has tiles in columns one and three. The last row has four adjacent tiles.");
const motif = illustration('<g transform="translate(234 34)"><path d="M0 0h72v54h78v90H0Z" fill="#285743"/><circle cx="36" cy="30" r="13" fill="#ffbf77"/><path d="M96 82h32v31H96z" fill="#f1e8ce"/></g>',
  "An upright L-shaped green motif with a small circle at its upper left and a square on the lower right.");
const sign = illustration('<rect x="130" y="30" width="380" height="176" rx="8" fill="#203e35"/><path d="M169 104h68l-20-20 12-12 42 40-42 40-12-12 20-20h-68z" fill="#f6edce"/><g fill="#f6edce" font-family="sans-serif"><text x="295" y="112" font-size="36" font-weight="bold">STUDIO</text><text x="297" y="143" font-size="16">LEVEL TWO</text></g>',
  "A dark green sign with a large cream right arrow and the word STUDIO above smaller LEVEL TWO lettering.");
const options = (...labels) => labels.map((label,index) => ({id:"ABCD"[index],label}));
const bank = [
  {id:"tiles", kind:"nat", topic:"observation", prompt:"How many square tiles form this mosaic?", figure:mosaic, key:{kind:"nat",accepted:[{exact:"9"}]}, explanation:"Read the occupied squares row by row. The first row has three tiles, the middle row has two and the last row has four. Their sum is nine."},
  {id:"void", kind:"nat", topic:"observation", prompt:"How many completely enclosed empty unit squares are inside the mosaic?", figure:mosaic, key:{kind:"nat",accepted:[{exact:"1"}]}, explanation:"Only the empty centre cell has a tile on all four sides. The space above the right-hand extension remains connected to the outside."},
  {id:"turn", kind:"msq", topic:"spatial-reasoning", prompt:"The motif is rotated a half-turn on the page. Which statements remain true?", figure:motif, options:options("The circle has the same diameter.","The square stays on the right of the circle.","The distance between the two centres stays the same.","The page position of each centre stays the same."), key:{kind:"msq",correct:["A","C"]}, explanation:"Rotation preserves lengths and the distance between points. A half-turn reverses the horizontal order and moves both centres."},
  {id:"sign", kind:"msq", topic:"visual-hierarchy", prompt:"Which two features communicate the direction and destination on this sign?", figure:sign, options:options("The right-pointing arrow.","The corner radius.","The word STUDIO.","The number of corners."), key:{kind:"msq",correct:["A","C"]}, explanation:"The arrow gives the direction of travel. The destination name tells the reader where that direction leads."},
  {id:"mirror", kind:"mcq", topic:"spatial-reasoning", prompt:"If the motif is reflected in a vertical mirror, where is the circle relative to the square?", figure:motif, options:options("Above and to the left.","Above and to the right.","Below and to the left.","Below and to the right."), key:{kind:"mcq",correct:["B"]}, explanation:"A vertical reflection swaps left and right and preserves height. The higher circle moves to the right of the lower square."},
  {id:"type", kind:"mcq", topic:"visual-hierarchy", prompt:"Which change would most directly strengthen the hierarchy between the two lines of text?", figure:sign, options:options("Make both lines the same size.","Rotate both lines by 90 degrees.","Increase the size of STUDIO alone.","Add equal letter spacing to both lines."), key:{kind:"mcq",correct:["C"]}, explanation:"Increasing the destination name alone creates a larger size difference between the two lines. The secondary detail remains readable at its original size."},
];
const duration = 12 * 60000;
export const previewPaperId = "original-visual-design-paper-v1";
const storageKey = "dmocks:preview:" + previewPaperId;

function grade(item, answer) {
  if (answer == null || answer === "" || Array.isArray(answer) && !answer.length) return {outcome:"unanswered", marks:0};
  if (item.kind === "nat") return Number(answer) === Number(item.key.accepted[0].exact) ? {outcome:"correct", marks:4} : {outcome:"wrong", marks:0};
  const choices = Array.isArray(answer) ? [...new Set(answer)] : [answer];
  if (choices.some(id => !item.key.correct.includes(id))) return {outcome:"wrong", marks:-1};
  if (choices.length === item.key.correct.length) return {outcome:"correct", marks:4};
  return {outcome:"partial", marks:choices.length};
}

export function createPreviewPaper({storage, now = Date.now, example = false, fresh = false}) {
  const initial = now();
  let state = {startedAt: initial, submittedAt:null, answers:{}, revisions:{}};
  if (example) state = {startedAt: initial - 480000, submittedAt:initial, answers:{tiles:"9",void:"2",turn:["A"],sign:["A","C"],mirror:"B"}, revisions:{}};
  else if (!fresh) {
    try {
      const old = JSON.parse(storage?.getItem(storageKey));
      if (Number.isFinite(old?.startedAt) && old.answers && old.revisions) state = old;
    } catch { /* Storage may be unavailable. Keep this tab usable. */ }
  }
  const deadline = state.startedAt + duration;
  const persist = () => { if (!example) { try { storage?.setItem(storageKey,JSON.stringify(state)); } catch { /* The open tab retains the sample. */ } } };
  persist();
  const snapshot = () => {
    if (!state.submittedAt && now() >= deadline) { state.submittedAt = deadline; persist(); }
    const submitted = state.submittedAt !== null;
    let score = 0;
    const questions = bank.map((item,i) => {
      const answer = state.answers[item.id] ?? null;
      const {outcome, marks} = grade(item, answer);
      score += marks;
      return {id:item.id, ordinal:i+1, kind:item.kind, topic:item.topic, prompt:item.prompt, options:item.options ?? [],
        marking:{correct:4,wrong:item.kind === "nat" ? 0 : -1,partial:item.kind === "msq"}, points:4, answer, answerRevision:state.revisions[item.id] ?? 0, media:[{alt:item.figure.alt}],
        ...(submitted ? {outcome, correctKey:item.key, explanation:item.explanation} : {})};
    });
    return {id:previewPaperId, title:"Visual design paper", status:submitted ? "submitted" : "active", score:submitted ? score : null, total:24,
      serverNow:new Date(now()).toISOString(), deadline:new Date(deadline).toISOString(), questions};
  };
  return {
    isCurrent:() => true,
    readAttempt:async () => ({data:snapshot(),receivedAt:now()}),
    rpc:async (name, input) => {
      if (name === "save_answer_revision") {
        if (state.submittedAt || now() >= deadline) throw new Error("The sample is closed.");
        const id = input.p_question_id;
        if (!bank.some(item => item.id === id)) throw new Error("Unknown sample question.");
        const accepted = input.p_revision >= (state.revisions[id] ?? 0);
        if (accepted) { state.answers[id] = input.p_answer; state.revisions[id] = input.p_revision; persist(); }
        return {accepted,revision:state.revisions[id],answer:state.answers[id]};
      }
      if (name === "submit_attempt") { state.submittedAt ??= Math.min(now(),deadline); persist(); return snapshot(); }
      if (["my_exam_mock_session","my_exam_mock_report"].includes(name)) return null;
      throw new Error("Unsupported sample action.");
    },
    functions:{invoke:async (name) => {
      if (name !== "attempt-media") throw new Error("Unsupported sample media.");
      return {data:{media:Object.fromEntries(bank.map(item => [item.id,[{url:item.figure.url}]]))}};
    }},
  };
}
