const exams=new Set(["uceed","ceed","nid","nift"]);
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const timestamp=value=>typeof value==="string" && value.length<=40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const invalid=()=>{throw new Error("Discussions could not be verified. Refresh and try again.");};
const exactKeys=(value,keys)=>value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
export function communityFeedFilters(exam=null,topic=null) {
  if((exam!==null&&typeof exam!=="string")||(topic!==null&&typeof topic!=="string"))return invalid();
  const selected=exam?.trim().toLowerCase()||null,subject=topic?.trim()||null;
  if((selected&&!exams.has(selected))||(subject&&[...subject].length>100))return invalid();
  return {exam:selected,topic:subject};
}
export function communityFeedCursor(cursor,filters) {
  if(!exactKeys(cursor,["createdAt","id","snapshotAt","version","exam","topic"])||typeof cursor.id!=="string"||!uuid.test(cursor.id)||
    !timestamp(cursor.createdAt)||!timestamp(cursor.snapshotAt)||Date.parse(cursor.createdAt)>Date.parse(cursor.snapshotAt)||
    !Number.isSafeInteger(cursor.version)||cursor.version<1||cursor.exam!==filters.exam||cursor.topic!==filters.topic)return invalid();
  // Preserve PostgreSQL microseconds verbatim. Date.toISOString would round them.
  return {...cursor};
}
export function communityFeedInput(filters,cursor=null) {
  const selected=communityFeedFilters(filters?.exam,filters?.topic);
  return {p_exam:selected.exam,p_topic:selected.topic,p_cursor:cursor===null?null:communityFeedCursor(cursor,selected),p_limit:25};
}
export function validateCommunityFeed(value,filters) {
  const selected=communityFeedFilters(filters.exam,filters.topic);
  if(!value||!Array.isArray(value.posts)||value.posts.length>25||!timestamp(value.snapshotAt)||
   !Number.isSafeInteger(value.version)||value.version<1||!exactKeys(value.filters,["exam","topic"])||
   value.filters.exam!==selected.exam||value.filters.topic!==selected.topic)return invalid();
  const ids=new Set();
  for(const item of value.posts) {
    if(!item||typeof item.id!=="string"||!uuid.test(item.id)||ids.has(item.id.toLowerCase())||!exams.has(item.exam)||typeof item.topic!=="string"||[...item.topic].length>100||
      typeof item.title!=="string"||[...item.title].length>160||typeof item.body!=="string"||[...item.body].length>5000||typeof item.author!=="string"||!["visible","locked"].includes(item.status)||
      !Number.isSafeInteger(item.comments)||item.comments<0||
      (selected.exam&&item.exam!==selected.exam)||(selected.topic&&item.topic!==selected.topic))return invalid();
    ids.add(item.id.toLowerCase());
  }
  const cursor=value.nextCursor===null?null:communityFeedCursor(value.nextCursor,selected),last=value.posts.at(-1);
  if(cursor&&(!last||cursor.id!==last.id||cursor.createdAt!==last.createdAt||cursor.version!==value.version||cursor.snapshotAt!==value.snapshotAt))return invalid();
  return {...value,filters:selected,nextCursor:cursor};
}
export function mergeCommunityFeed(previous,next) {
  if(!previous||previous.version!==next.version||previous.snapshotAt!==next.snapshotAt||
   previous.filters.exam!==next.filters.exam||previous.filters.topic!==next.filters.topic)return invalid();
  const ids=new Set(previous.posts.map(item=>item.id));
  if(next.posts.some(item=>ids.has(item.id)))return invalid();
  return {...next,posts:[...previous.posts,...next.posts]};
}
