const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const text=value=>typeof value==='string'&&value.trim().length>0&&Array.from(value).length<=1000;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const date=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value));
export const assessmentExams = Object.freeze(['uceed', 'ceed', 'nid', 'nift']);
const exam=value=>assessmentExams.includes(value);
const candidateAlias = value => typeof value === 'string' && /^Candidate-[A-F0-9]{6}(?:[A-F0-9]{4})?$/.test(value);
const invalid=()=>{throw new Error('The current mock choices could not be verified.');};

export function allIndiaExamSelection(events, requestedExam) {
  const selectedExam = exam(requestedExam) ? requestedExam : '';
  return { selectedExam, visibleEvents: selectedExam ? events.filter(event => event.exam === selectedExam) : events };
}

function resultSharing(value) {
 if (!record(value) || !uuid(value.publicationId) || !integer(value.revision) ||
     typeof value.shared !== 'boolean' || (value.shared && value.revision === 0) || !candidateAlias(value.alias)) invalid();
 const { publicationId, revision, shared, alias } = value;
 return { publicationId, revision, shared, alias };
}

export function rankingShareReceipt(input, previous, shared) {
 const receipt = resultSharing(input);
 if (receipt.publicationId !== previous.publicationId || receipt.alias !== previous.alias ||
     receipt.revision !== previous.revision + 1 || receipt.shared !== shared) invalid();
 return receipt;
}

export function validatePublicAllIndiaResults(input) {
 if (!Array.isArray(input) || input.length > 8) invalid();
 const events = input.filter(event => event?.sharingVersion === 1).map(event => {
  const { eventId, exam: eventExam, title, releasedAt, topTen } = event;
  if (!uuid(eventId) || !exam(eventExam) || !text(title) || !date(releasedAt) || !Array.isArray(topTen) || topTen.length > 10) invalid();
  const results = topTen.map(result => {
   if (!record(result) || !candidateAlias(result.alias) || !integer(result.rank) || result.rank < 1 || result.rank > 10 ||
       !finite(result.score) || !finite(result.total) || result.total < 0) invalid();
   const { rank, alias, score, total } = result;
   return { rank, alias, score, total };
  });
  return { eventId, exam: eventExam, title, topTen: results };
 });
 if (new Set(events.map(event => event.eventId)).size !== events.length) invalid();
 return events.filter(event => event.topTen.length > 0);
}
// Seats and entry are optional: older events carry neither.
function eventSeats(item){
 const entry=item.entry??'pass',seatCap=item.seatCap??null,seatsLeft=item.seatsLeft??null,registered=item.registered??false;
 if(!['pass','free'].includes(entry)||typeof registered!=='boolean'||(seatCap!==null&&(!integer(seatCap)||seatCap<1))
   ||(seatCap===null)!==(seatsLeft===null)||(seatCap!==null&&(!integer(seatsLeft)||seatsLeft>seatCap)))invalid();
 return{entry,seatCap,seatsLeft,registered};
}
export function validatePublicAllIndiaUpcoming(input){
 if(!Array.isArray(input)||input.length>8)invalid();
 const rows=input.map(item=>{
  if(!record(item)||!uuid(item.id)||!exam(item.exam)||!text(item.title)||!['startsAt','endsAt','lastStartAt','reviewEndsAt'].every(key=>date(item[key]))
    ||!integer(item.durationSeconds)||item.durationSeconds===0||!integer(item.uploadGraceSeconds))invalid();
  const{entry,seatCap,seatsLeft}=eventSeats(item);
  return{id:item.id,exam:item.exam,title:item.title,startsAt:item.startsAt,endsAt:item.endsAt,lastStartAt:item.lastStartAt,
   reviewEndsAt:item.reviewEndsAt,durationSeconds:item.durationSeconds,uploadGraceSeconds:item.uploadGraceSeconds,entry,seatCap,seatsLeft};
 });
 if(new Set(rows.map(row=>row.id)).size!==rows.length)invalid();
 return rows;
}
export function registrationInput(catalog,id){
 const event=catalog?.find(item=>item.id===id);
 if(!event||!['scheduled','open'].includes(event.state)||event.registered||event.attemptId||event.seatsLeft===0)
  throw Object.assign(new Error('Refresh these choices before reserving a seat.'),{code:'catalogue_selection'});
 return{p_event_id:id};
}
export const catalogueKinds=Object.freeze({exam:{read:'exam_mock_catalog',start:'start_exam_mock',refresh:'Refresh exam mocks',className:'exam-mocks',signIn:'Sign in to take a mock'},allIndia:{read:'all_india_event_catalog',start:'start_all_india_attempt',refresh:'Refresh All India mocks',className:'all-india',signIn:'Sign in for All India mocks'},topic:{read:'topic_catalog',start:'start_topic_practice',refresh:'Refresh practice topics',className:'topic-practice',signIn:'Sign in to practise'}});
export function catalogueSpec(kind){if(!Object.hasOwn(catalogueKinds,kind))invalid();return catalogueKinds[kind];}
export function validateCatalogue(kind,input){
 catalogueSpec(kind);if(kind==='exam'&&input===null)return[];if(!Array.isArray(input))invalid();
 const rows=input.map(item=>{
  if(!record(item)||!exam(item.exam))invalid();
  if(kind==='topic'){if(!text(item.topic)||!integer(item.questions))invalid();return{exam:item.exam,topic:item.topic,questions:item.questions};}
  if(kind==='exam'){
   if(!integer(item.questionCount)||item.questionCount===0||!integer(item.durationSeconds)||item.durationSeconds===0||!integer(item.freeAttemptLimit)||!integer(item.freeAttemptsUsed)||typeof item.ready!=='boolean'||typeof item.enabled!=='boolean'||item.ready&&!item.enabled||(item.sectionLabel!=null&&!text(item.sectionLabel))||(item.structureVersion!=null&&!text(item.structureVersion)))invalid();
   let sectionCounts=null;if(item.sectionCounts!=null){if(!record(item.sectionCounts)||!Object.keys(item.sectionCounts).length||Object.entries(item.sectionCounts).some(([key,value])=>!['nat','msq','mcq'].includes(key)||!integer(value))||Object.values(item.sectionCounts).reduce((a,b)=>a+b,0)!==item.questionCount)invalid();sectionCounts=Object.fromEntries(Object.entries(item.sectionCounts));}
   return{exam:item.exam,questionCount:item.questionCount,durationSeconds:item.durationSeconds,freeAttemptLimit:item.freeAttemptLimit,freeAttemptsUsed:item.freeAttemptsUsed,ready:item.ready,enabled:item.enabled,sectionCounts,sectionLabel:item.sectionLabel??null,structureVersion:item.structureVersion??null};
  }
  if(!uuid(item.id)||!text(item.title)||!['scheduled','open','closing','review','released','paused'].includes(item.state)||!['startsAt','endsAt','lastStartAt','reviewEndsAt'].every(key=>date(item[key]))||!integer(item.durationSeconds)||item.durationSeconds===0||!integer(item.uploadGraceSeconds)||typeof item.qualityHeld!=='boolean'||item.state==='open'&&item.qualityHeld||item.attemptId!=null&&!uuid(item.attemptId))invalid();
  let result=null;if(item.result!=null){const value=item.result;if(item.state!=='released'||!item.attemptId||!record(value)||!finite(value.score)||!finite(value.total)||value.total<0||!integer(value.rank)||value.rank<1||!integer(value.cohortSize)||value.cohortSize<value.rank)invalid();result={score:value.score,total:value.total,rank:value.rank,cohortSize:value.cohortSize};}
  if (item.result?.sharing != null) {
   if (result.rank > 10) invalid();
   result.sharing = resultSharing(item.result.sharing);
  }
  return{id:item.id,exam:item.exam,title:item.title,state:item.state,startsAt:item.startsAt,endsAt:item.endsAt,lastStartAt:item.lastStartAt,reviewEndsAt:item.reviewEndsAt,durationSeconds:item.durationSeconds,uploadGraceSeconds:item.uploadGraceSeconds,qualityHeld:item.qualityHeld,attemptId:item.attemptId??null,result,...eventSeats(item)};
 });
 const keys=rows.map(item=>kind==='topic'?JSON.stringify([item.exam,item.topic]):kind==='exam'?item.exam:item.id);if(new Set(keys).size!==keys.length)invalid();return rows;
}
export function catalogueInput(kind,catalog,input){
 catalogueSpec(kind);const fail=()=>{throw Object.assign(new Error('Refresh these choices before starting a mock.'),{code:'catalogue_selection'});};
 if(kind==='exam'){if(!catalog.some(item=>item.exam===input&&item.ready&&item.enabled))fail();return{p_exam:input};}
 if(kind==='allIndia'){if(!catalog.some(item=>item.id===input&&item.state==='open'&&!item.qualityHeld&&!item.attemptId&&(item.registered||item.seatsLeft!==0)))fail();return{p_event_id:input};}
 if(!record(input)||![10,20,30].includes(input.count)||![900,1800,2700].includes(input.duration)||!catalog.some(item=>item.exam===input.exam&&item.topic===input.topic&&item.questions>=input.count))fail();
 return{p_exam:input.exam,p_topic:input.topic,p_count:input.count,p_duration_seconds:input.duration};
}
export function savedCatalogueAttempts(input){
 if(!Array.isArray(input)||input.some(item=>!record(item)||!uuid(item.id)||!text(item.title)||!['active','submitted'].includes(item.status))||new Set(input.map(item=>item.id)).size!==input.length)invalid();
 return input.filter(item=>item.status==='active').slice(0,10).map(item=>({id:item.id,title:item.title}));
}
const knownRejections=new Set(['An active pass is required','Free accounts include one topic practice session a day','Free topic practice sessions have 10 questions','Complete your verified profile first','Finish an active attempt before starting another','Not enough reviewed questions for this practice','Not enough reviewed questions for every required section','This exam mock is not released','New starts are paused while a question is under human review','This All India mock is not open','This All India mock is not released','This All India mock is not open for new attempts','This All India mock can only be attempted once','There is no full attempt window available','The start window has closed','All seats for this All India mock are taken','Registration for this All India mock has closed','All India paper paused for fresh-question review']);
export function catalogueStartFailure(error){
 if(error?.code==='catalogue_selection')return{definitive:true,message:'Refresh these choices before starting a mock.'};
 if(error?.code==='P0001'&&knownRejections.has(error.message))return{definitive:true,message:error.message};
 return{definitive:false,message:'Couldn’t confirm this start. Refresh these choices and check your saved attempts before starting again.'};
}
