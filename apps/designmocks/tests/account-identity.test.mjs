import test from'node:test';
import assert from'node:assert/strict';
import{authorizationHeaders,runForVerifiedAccount,verifiedAccountToken,verifiedRoleCheck}from'../src/account-identity.js';
import{createAdminAccessScope}from'../src/admin-access.js';
const signal=()=>new AbortController().signal;
test('a verified account returns only the exact captured token even if SDK state changes',async()=>{let token='opaque-fictional-first',seen;const auth={getSession:async()=>({data:{session:{user:{id:'first'},access_token:token}}}),getUser:async value=>{seen=value;token='opaque-fictional-second';return{data:{user:{id:'first'}}};}};assert.equal(await verifiedAccountToken(auth,'first',signal()),'opaque-fictional-first');assert.equal(seen,'opaque-fictional-first');});
test('a different cached account or missing token cannot dispatch a private request',async()=>{for(const session of[null,{user:{id:'second'},access_token:'opaque-fictional-second'},{user:{id:'first'}},{user:{id:'first'},access_token:''}]){let calls=0;const auth={getSession:async()=>({data:{session}}),getUser:async()=>{calls++;return{data:{user:{id:'first'}}};}};assert.equal(await verifiedAccountToken(auth,'first',signal()),null);assert.equal(calls,0);}});
test('the server identity must match and provider errors cannot produce a usable token',async()=>{for(const response of[{data:{user:{id:'second'}}},{data:{user:null}},{data:{user:null},error:new Error('Private diagnostic')}]){const auth={getSession:async()=>({data:{session:{user:{id:'first'},access_token:'opaque-fictional-first'}}}),getUser:async()=>response};if(response.error)await assert.rejects(verifiedAccountToken(auth,'first',signal()));else assert.equal(await verifiedAccountToken(auth,'first',signal()),null);}});
test('an abort during identity verification cannot return a token for a later request',async()=>{const controller=new AbortController(),auth={getSession:async()=>({data:{session:{user:{id:'first'},access_token:'opaque-fictional-first'}}}),getUser:async()=>{controller.abort();return{data:{user:{id:'first'}}};}};await assert.rejects(verifiedAccountToken(auth,'first',controller.signal),{name:'AbortError'});});
test('a changed cached identity closes the private scope without dispatch',async()=>{const scope=createAdminAccessScope({check:async()=>true});await scope.verify();let calls=0;await assert.rejects(runForVerifiedAccount(scope,{getSession:async()=>({data:{session:{user:{id:'second'},access_token:'opaque-fictional-second'}}})},'first',()=>{calls++;}));assert.equal(calls,0);assert.equal(scope.snapshot().status,'unavailable');scope.dispose();});
test('a cancelled identity read does not close the permitted scope or dispatch work',async()=>{const scope=createAdminAccessScope({check:async()=>true}),controller=new AbortController();await scope.verify();let calls=0;const auth={getSession:async()=>({data:{session:{user:{id:'first'},access_token:'opaque-fictional-first'}}}),getUser:async()=>{controller.abort();return{data:{user:{id:'first'}}};}};await assert.rejects(runForVerifiedAccount(scope,auth,'first',()=>{calls++;},controller.signal),{name:'AbortError'});assert.equal(calls,0);assert.equal(scope.snapshot().status,'allowed');scope.dispose();});
test('the verified operation keeps its captured token across a later SDK change',async()=>{const scope=createAdminAccessScope({check:async()=>true});await scope.verify();let current='opaque-fictional-first';const auth={getSession:async()=>({data:{session:{user:{id:'first'},access_token:current}}}),getUser:async()=>{current='opaque-fictional-second';return{data:{user:{id:'first'}}};}};assert.equal(await runForVerifiedAccount(scope,auth,'first',token=>token),'opaque-fictional-first');assert.equal(scope.snapshot().status,'allowed');scope.dispose();});
test('failed current identity verification clears the scope and hides the original failure',async()=>{const scope=createAdminAccessScope({check:async()=>true});await scope.verify();const auth={getSession:async()=>{throw new Error('Original private provider diagnostic');}};await assert.rejects(runForVerifiedAccount(scope,auth,'first',()=>{}),error=>error.code==='admin_access_ended'&&!error.message.includes('Original'));assert.equal(scope.snapshot().status,'unavailable');scope.dispose();});
test('per-request authorization replaces every caller casing without mutating other headers',()=>{const original={Authorization:'old-uppercase',authorization:'old-lowercase','AUTHORIZATION':'old-other','Content-Type':'application/octet-stream','X-Original':'fictional'};assert.deepEqual(authorizationHeaders(original,'opaque-fictional-first'),{'Content-Type':'application/octet-stream','X-Original':'fictional',Authorization:'Bearer opaque-fictional-first'});assert.equal(original.authorization,'old-lowercase');});

test('role probes pin the verified token and drop replies after an account change', async () => {
  const make = (state) => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: state.id }, access_token: state.token } }, error: null }),
      getUser: async (token) => ({ data: { user: { id: state.id } }, error: null, token }),
    },
    client: { rpc(name) { const call = { name }; state.calls.push(call); const builder = {
      setHeader(key, value) { call[key] = value; return builder; },
      abortSignal() { return Promise.resolve({ data: true, error: null }).then(r => { state.afterRpc?.(); return r; }); },
    }; return builder; } },
  });
  const state = { id: 'a', token: 'first', calls: [] };
  const { auth, client } = make(state);
  const ok = await verifiedRoleCheck(auth, client, 'a', 'can_review_drawings', new AbortController().signal);
  assert.equal(ok.data, true);
  assert.deepEqual(state.calls.map(c => c.Authorization), ['Bearer first']);
  const wrong = await verifiedRoleCheck(auth, client, 'b', 'can_review_drawings', new AbortController().signal);
  assert.equal(wrong.data, null);
  assert.ok(wrong.error);
  assert.equal(state.calls.length, 1);
  state.afterRpc = () => { state.id = 'c'; state.token = 'second'; };
  const swapped = await verifiedRoleCheck(auth, client, 'a', 'can_review_drawings', new AbortController().signal);
  assert.equal(swapped.data, null);
  assert.ok(swapped.error);
  const controller = new AbortController(); controller.abort();
  state.afterRpc = undefined; state.id = 'a'; state.token = 'first';
  await assert.rejects(verifiedRoleCheck(auth, client, 'a', 'x', controller.signal));
});

test('role probes expire during a stalled identity verification and never dispatch after its reply', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finishIdentity;
  const identity = new Promise(resolve => { finishIdentity = resolve; });
  const auth = {
    getSession: async () => ({ data: { session: { user: { id: 'a' }, access_token: 'first' } } }),
    getUser: () => identity,
  };
  let calls = 0;
  const client = { rpc() { calls++; } };
  const result = verifiedRoleCheck(auth, client, 'a', 'can_enter_staging_portal', signal());
  const rejection = assert.rejects(result, { name: 'AbortError' });
  await Promise.resolve();
  await Promise.resolve();
  t.mock.timers.tick(20_000);
  await rejection;
  finishIdentity({ data: { user: { id: 'a' } } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 0);
});
