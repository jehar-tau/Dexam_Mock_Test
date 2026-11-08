const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export const privacyReadMessage='Couldn’t load your privacy requests. Refresh privacy requests to try again.';
export const privacyWriteMessage='Couldn’t confirm that change. Your earlier request may already be saved. Refresh privacy requests before making another change.';
export const privacyExportMessage='Couldn’t prepare your export. Try downloading your data again.';
export function privacyRequestsResponse(value){
 const ids=new Set();let active=0;
 if(!Array.isArray(value)||!value.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).every(key=>['id','type','status','adminNote','createdAt','updatedAt'].includes(key))&&uuid(row.id)&&!ids.has(row.id)&&ids.add(row.id)&&row.type==='account_deletion'&&['open','in_progress','closed','declined','cancelled'].includes(row.status)&&
  (row.adminNote===null||typeof row.adminNote==='string'&&row.adminNote.length<=2000)&&timestamp(row.createdAt)&&timestamp(row.updatedAt)&&(!['open','in_progress'].includes(row.status)||++active===1)))throw new Error(privacyReadMessage);
 return value.map(row=>({...row}));
}
export function privacyRequestReceipt(value){if(!uuid(value))throw new Error(privacyWriteMessage);return value;}
export function privacyCancelReceipt(value){if(value!==null)throw new Error(privacyWriteMessage);}
export async function privacyOperation(operation,signal){
 signal.throwIfAborted();let abort;
 const interrupted=new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});});
 try{return await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return operation();}),interrupted]);}
 finally{signal.removeEventListener('abort',abort);}
}
