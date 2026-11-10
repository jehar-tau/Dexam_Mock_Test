import {isOrderReference,linkedPurchaseReference} from './purchase-history.js';

export const bugReportStatuses=new Set(['open','investigating','fixed','closed']);
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const stamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,19)===value.slice(0,19);
const length=value=>Array.from(value).length;

export function bugReportContext(href){
 try{const url=new URL(href);return['http:','https:'].includes(url.protocol)?(url.origin+url.pathname).slice(0,1000):null;}catch{return null;}
}
export function prepareBugReport(value,href,createId=()=>crypto.randomUUID()){
 const title=typeof value.title==='string'?value.title.trim():'',description=typeof value.description==='string'?value.description.trim():'';
 const errors={};if(length(title)<5||length(title)>140)errors.title='Use a title of 5 to 140 characters.';
 if(length(description)<10||length(description)>5000)errors.description='Describe the problem in 10 to 5,000 characters.';
 if(Object.keys(errors).length)return{errors,request:null};
 const purchaseOrder=value.purchaseOrder;
 if(purchaseOrder!=null&&!isOrderReference(purchaseOrder))throw new Error('Invalid linked order');
 const requestId=createId();if(!uuid.test(requestId))throw new Error('Could not prepare the report. Please try again.');
 return{errors,request:Object.freeze({p_title:title,p_description:description,p_page_url:bugReportContext(href),p_request_id:requestId,
  ...(purchaseOrder==null?{}:{p_purchase_order_id:purchaseOrder})})};
}
export function validateBugReportReceipt(value){if(typeof value!=='string'||!uuid.test(value))throw new Error('Unconfirmed report receipt');return value;}
export function bugReportFailure(error){
 if(error?.details==='bug_report_limit'||error?.code==='P0001'&&error?.message==='Too many reports. Please try again later')return{definitive:true,message:'You can send up to five reports per hour. Please try again later.'};
 if(error?.details==='bug_report_conflict')return{definitive:true,message:'This report request has changed. Refresh your reports before starting another.'};
 if(error?.details==='purchase_order_unavailable')return{definitive:true,message:'This order is unavailable for your account. Remove the order link to send a general report.'};
 if(['22023','23514','23502'].includes(error?.code))return{definitive:true,message:'Check the title and description, then try again.'};
 if(error?.code==='PGRST202')return{definitive:true,message:'Reporting is temporarily unavailable. Please try again later.'};
 return{definitive:false,message:'Couldn’t confirm your report. Retry the same report to check it.'};
}
export function validateBugReportPage(value,ownerId){
 if(!value||!Array.isArray(value.items)||value.items.length>25||!Object.hasOwn(value,'nextCursor'))throw new Error('Invalid report page');
 const ids=new Set();
 for(const row of value.items){
  if(!row||!uuid.test(row.id)||ids.has(row.id)||typeof row.title!=='string'||length(row.title)<5||length(row.title)>140||typeof row.description!=='string'||length(row.description)<10||length(row.description)>5000||!bugReportStatuses.has(row.status)||
   row.adminReply!==null&&typeof row.adminReply!=='string'||!stamp(row.createdAt)||!stamp(row.updatedAt))throw new Error('Invalid report page');
  ids.add(row.id);
 }
 const cursor=value.nextCursor;
 if(cursor!==null&&(!cursor||Object.keys(cursor).sort().join(',')!=='createdAt,id,ownerId,snapshotAt'||cursor.ownerId!==ownerId||!uuid.test(cursor.id)||!stamp(cursor.createdAt)||!stamp(cursor.snapshotAt)||cursor.createdAt>cursor.snapshotAt||
  value.items.length===0||cursor.id!==value.items.at(-1).id||cursor.createdAt!==value.items.at(-1).createdAt))throw new Error('Invalid report cursor');
 const items=value.items.map(({id,title,description,status,adminReply,createdAt,updatedAt,purchase})=>{
  const order=linkedPurchaseReference(purchase);
  return{id,title,description,status,adminReply,createdAt,updatedAt,...(order?{purchase:order}:{})};
 });
 return{items,nextCursor:cursor?{...cursor}:null};
}
export function appendBugReports(current,next){
 const ids=new Set(current.map(row=>row.id));if(next.some(row=>ids.has(row.id)))throw new Error('Report page changed');return[...current,...next];
}
