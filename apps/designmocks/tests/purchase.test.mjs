import test from'node:test';
import assert from'node:assert/strict';
import{createPurchaseFlow,purchaseOrder,purchasePass}from'../src/purchase.js';
const order=()=>({orderId:'order_fictional123',keyId:'rzp_test_fictional123',amount:119300,currency:'INR'});
const waitFor=async predicate=>{for(let n=0;n<100&&!predicate();n++)await new Promise(resolve=>setTimeout(resolve,1));assert.ok(predicate());};
function fixture(options={}){
 const state={current:true,active:false,mode:options.expectedMode??'test',status:[],calls:[],opened:0,closed:0,widgets:[],present:0,order:order(),failure:null};
 const access=()=>({active:state.active,expiresAt:state.active?'2027-11-08T12:00:00Z':null,mode:state.mode});
 class Checkout{constructor(options){this.options=options;this.events={};state.widgets.push(this);}on(name,action){this.events[name]=action;}open(){state.opened++;}close(){state.closed++;this.options.modal.ondismiss();}}
 const services={isCurrent:()=>state.current,async checkIdentity(signal){signal.throwIfAborted();if(!state.current)throw new Error('Changed account.');return true;},async presentForCurrentAccount(operation,signal){signal.throwIfAborted();state.present++;await services.checkIdentity(signal);return operation();},async rpc(name,input,signal){signal.throwIfAborted();state.calls.push(name);if(state.failure===name)throw new Error('Private provider diagnostic');if(name==='my_pass')return state.read?state.read():access();return null;},functions:{async invoke(name,{signal}){signal.throwIfAborted();state.calls.push(name);if(state.failure===name)throw new Error('Private merchant diagnostic');if(state.create)return state.create();return{data:state.order,error:null};}}};
 const flow=createPurchaseFlow({services,termsVersion:'fictional-reviewed-terms',loadCheckout:async()=>{if(state.load)await state.load();return Checkout;},onChange:value=>state.status.push(value),pollMilliseconds:1,maximumPolls:2,requestMilliseconds:1000,confirmationMilliseconds:1000,...options});
 return{state,flow,services,latest:()=>state.status.at(-1)};
}
test('checkout receipts enforce exact plan price, currency and bounded provider identifiers',()=>{
 assert.deepEqual(purchaseOrder({...order(),privateIgnored:'not displayed'}),order());
 for(const[key,value]of[['amount',1193],['amount','119300'],['amount',119300.5],['currency','USD'],['orderId','https://wrong.invalid'],['orderId','order_'+ 'a'.repeat(195)],['keyId','sb_secret_never'],['keyId','rzp_test_']])assert.throws(()=>purchaseOrder({...order(),[key]:value}));
 assert.throws(()=>purchaseOrder(null));assert.throws(()=>purchaseOrder([]));
});
test('only a valid current server pass can display active access',()=>{
 assert.deepEqual(purchasePass({active:true,expiresAt:'2027-11-08T12:00:00Z'}),{active:true,expiresAt:'2027-11-08T12:00:00Z'});
 for(const value of[null,{}, {active:'true',expiresAt:null},{active:true,expiresAt:null},{active:true,expiresAt:'not-a-date'},{active:true,expiresAt:'2027-11-08T12:00:00Z',revoked:true}])assert.throws(()=>purchasePass(value));
});
test('Test and Live order/pass receipts cannot be used interchangeably',()=>{
 assert.doesNotThrow(()=>purchaseOrder(order(),'test'));assert.throws(()=>purchaseOrder(order(),'live'));
 assert.doesNotThrow(()=>purchaseOrder({...order(),keyId:'rzp_live_fictional123'},'live'));assert.throws(()=>purchaseOrder({...order(),keyId:'rzp_live_fictional123'},'test'));
 assert.throws(()=>purchasePass({active:true,expiresAt:'2027-11-08T12:00:00Z',mode:'test'},'live'));
 assert.throws(()=>purchasePass({active:false,expiresAt:null},'test'));
});
test('a nonproduction purchase cannot load a Live widget or display a Live pass',async()=>{
 const{state,flow,latest}=fixture();state.mode='live';await flow.refresh();assert.equal(latest().status,'unconfirmed');assert.equal(await flow.start(true),false);state.mode='test';await flow.refresh();state.order.keyId='rzp_live_fictional123';let loaded=false;state.load=()=>{loaded=true;};assert.equal(await flow.start(true),false);assert.equal(loaded,false);assert.equal(state.opened,0);flow.dispose();
});
test('an existing server pass closes purchase before consent or another order',async()=>{
 const{state,flow,latest}=fixture();state.active=true;assert.equal(await flow.refresh(),true);assert.equal(latest().status,'paid');assert.equal(await flow.start(true),false);assert.deepEqual(state.calls,['my_pass']);flow.dispose();
});
test('synchronous duplicate starts open one verified fixed-price order and never grant from callback',async()=>{
 const{state,flow,latest}=fixture();await flow.refresh();assert.equal(await flow.start(false),false);
 const first=flow.start(true),second=flow.start(true);assert.equal(await second,false);assert.equal(await first,true);assert.equal(state.opened,1);assert.equal(state.calls.filter(name=>name==='create-order').length,1);assert.equal(latest().status,'checkout');
 state.widgets[0].options.handler({razorpay_payment_id:'pay_fictional123'});state.widgets[0].options.handler({});await waitFor(()=>latest().status==='pending');assert.equal(state.status.some(row=>row.status==='paid'),false);assert.equal(state.closed,1);
 state.active=true;assert.equal(await flow.refresh(),true);assert.equal(latest().status,'paid');flow.dispose();
});
test('a successful callback waits for a server-active receipt before displaying paid access',async()=>{
 const{state,flow,latest}=fixture();await flow.refresh();await flow.start(true);state.active=true;state.widgets[0].options.handler({});await waitFor(()=>latest().status==='paid');assert.ok(state.calls.filter(name=>name==='my_pass').length>=2);assert.equal(await flow.start(true),false);flow.dispose();
});
test('an uncertain order freezes further creation until an explicit current pass read',async()=>{
 const{state,flow,latest}=fixture();await flow.refresh();state.failure='create-order';assert.equal(await flow.start(true),false);assert.equal(latest().status,'unconfirmed');assert.doesNotMatch(latest().error,/Private|merchant|diagnostic/);assert.equal(await flow.start(true),false);assert.equal(state.opened,0);
 state.failure=null;await flow.refresh();assert.equal(await flow.start(true),true);assert.equal(state.calls.filter(name=>name==='create-order').length,2);flow.dispose();
});
test('malformed order acknowledgement cannot load or open the payment window',async()=>{
 const{state,flow,latest}=fixture();await flow.refresh();state.order.currency='USD';let loaded=false;state.load=async()=>{loaded=true;};assert.equal(await flow.start(true),false);assert.equal(loaded,false);assert.equal(state.opened,0);assert.equal(latest().status,'unconfirmed');flow.dispose();
});
test('a changed account during delayed script loading cannot open an earlier account order',async()=>{
 const{state,flow}=fixture();await flow.refresh();let release;state.load=()=>new Promise(resolve=>{release=resolve;});const pending=flow.start(true);await waitFor(()=>Boolean(release));state.current=false;release();assert.equal(await pending,false);assert.equal(state.opened,0);flow.dispose();
});
test('the order deadline releases controls and a late receipt cannot open checkout',async()=>{
 const{state,flow,latest}=fixture({requestMilliseconds:10});await flow.refresh();let release;state.create=()=>new Promise(resolve=>{release=resolve;});const pending=flow.start(true);await waitFor(()=>Boolean(release));assert.equal(await pending,false);assert.equal(latest().status,'unconfirmed');release({data:order(),error:null});await new Promise(resolve=>setTimeout(resolve,1));assert.equal(state.opened,0);flow.dispose();
});
test('disposing an open widget closes it and rejects its late callbacks and reads',async()=>{
 const{state,flow}=fixture();await flow.refresh();await flow.start(true);const events=state.status.length,calls=state.calls.length;flow.dispose();assert.equal(state.closed,1);state.widgets[0].options.handler({});state.widgets[0].options.modal.ondismiss();assert.equal(await flow.refresh(),false);assert.equal(state.status.length,events);assert.equal(state.calls.length,calls);
});
test('failure and dismissal require a server check rather than a second automatic payment',async()=>{
 for(const failed of[false,true]){const{state,flow,latest}=fixture();await flow.refresh();await flow.start(true);if(failed)state.widgets[0].events['payment.failed']({error:{description:'private failure'}});else state.widgets[0].options.modal.ondismiss();assert.equal(latest().status,'pending');assert.equal(await flow.start(true),false);assert.equal(state.calls.filter(name=>name==='create-order').length,1);flow.dispose();}
});
test('stalled confirmation ends without fabricating paid access or repeating an order',async()=>{
 const{state,flow,latest}=fixture({confirmationMilliseconds:10,requestMilliseconds:1000});await flow.refresh();await flow.start(true);let release;state.read=()=>new Promise(resolve=>{release=resolve;});state.widgets[0].options.handler({});await waitFor(()=>latest().status==='pending');release({active:true,expiresAt:'2027-11-08T12:00:00Z',mode:'test'});await new Promise(resolve=>setTimeout(resolve,1));assert.equal(state.status.some(row=>row.status==='paid'),false);assert.equal(state.calls.filter(name=>name==='create-order').length,1);flow.dispose();
});
