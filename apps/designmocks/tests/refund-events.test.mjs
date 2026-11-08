import test from'node:test';
import assert from'node:assert/strict';
import * as commerce from'../supabase/functions/_shared/commerce.mjs';
const event=()=>({event:'refund.processed',payload:{refund:{entity:{id:'rfnd_fictional123',payment_id:'pay_fictional123',amount:119300,currency:'INR',status:'processed'}},payment:{entity:{id:'pay_fictional123',order_id:'order_fictional123',amount:119300,currency:'INR',status:'refunded',captured:true,amount_refunded:119300}}}});
test('only processed, captured and internally matched refunds become reconciliation candidates',()=>{
 assert.equal(typeof commerce.processedRefund,'function');
 assert.deepEqual(commerce.processedRefund(event()),{refundId:'rfnd_fictional123',paymentId:'pay_fictional123',orderId:'order_fictional123',paymentAmount:119300,refundAmount:119300,totalRefunded:119300,currency:'INR'});
 for(const name of['refund.created','refund.failed','payment.captured'])assert.equal(commerce.processedRefund({...event(),event:name}),null);
 const automatic=event();automatic.payload.payment.entity.captured=false;assert.equal(commerce.processedRefund(automatic),null);
});
test('refund validation rejects foreign, malformed and inconsistent money or identity fields',()=>{
 assert.equal(typeof commerce.processedRefund,'function');
 for(const[target,key,value]of[['refund','id','bad'],['refund','payment_id','pay_other'],['refund','status','created'],['refund','amount',0],['refund','amount',119301],['refund','amount',1.5],['refund','currency','USD'],['payment','id','bad'],['payment','order_id','bad'],['payment','currency','USD'],['payment','status','authorized'],['payment','captured',undefined],['payment','amount_refunded',-1],['payment','amount_refunded',1],['payment','amount_refunded',119301],['payment','amount',NaN]]){
  const input=event();input.payload[target].entity[key]=value;assert.throws(()=>commerce.processedRefund(input));
 }
});
test('partial processed refunds retain exact minor-unit and cumulative amounts for operator review',()=>{
 assert.equal(typeof commerce.processedRefund,'function');const input=event();input.payload.refund.entity.amount=30000;input.payload.payment.entity.amount_refunded=50000;input.payload.payment.entity.status='captured';assert.deepEqual(commerce.processedRefund(input),{refundId:'rfnd_fictional123',paymentId:'pay_fictional123',orderId:'order_fictional123',paymentAmount:119300,refundAmount:30000,totalRefunded:50000,currency:'INR'});
});
