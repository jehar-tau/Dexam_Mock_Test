import test from 'node:test';
import assert from 'node:assert/strict';
import { readPaymentReviews } from '../src/admin-payments.js';
const row = { reference:'10000000-0000-4000-8000-000000000001', amountMinor:119300, currency:'INR', status:'paid', refundedMinor:30000, reviewRequired:true, createdAt:'2026-11-01T00:00:00Z', paidAt:'2026-11-01T00:00:00Z', refundedAt:null, passState:'active' };
const page = item => ({mode:'test',items:[item],nextCursor:null});
test('payment reviews preserve bounded order facts and strip incidental private fields', () => {
  assert.deepEqual(readPaymentReviews(page({...row, email:'private@example.invalid',providerPaymentId:'pay_private'})),page(row));
});
test('payment review validation rejects malformed money, state, cursor, duplicates and oversized pages', () => {
  for(const patch of [{reviewRequired:false},{passState:'unknown'},{refundedMinor:119301},{amountMinor:'119300'},{currency:'USD'},{reference:'not-an-order'},{createdAt:'bad'}]) assert.throws(()=>readPaymentReviews(page({...row,...patch})));
  for(const patch of [{mode:'unknown'},{items:Array(11).fill(row)},{items:[row,row]},{nextCursor:{reference:row.reference,createdAt:row.createdAt}}]) assert.throws(()=>readPaymentReviews({...page(row),...patch}));
});
