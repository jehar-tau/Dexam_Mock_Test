import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProviderOrder } from '../supabase/functions/_shared/provider-order.mjs';
import { createOrderHandler } from '../supabase/functions/_shared/create-order.mjs';

const internal = '00000000-0000-4000-8000-000000001999';
const prepared = { id: internal, amount: 119300, currency: 'INR', mode: 'test', providerOrderId: null };
const keyId = 'rzp_test_fictional', keySecret = 'fictional-secret';
const provider = (patch = {}) => ({ entity: 'order', id: 'order_fictional', receipt: internal,
  notes: { designmocks_order: internal }, amount: 119300, currency: 'INR', status: 'created',
  amount_paid: 0, amount_due: 119300, partial_payment: false, ...patch });
const collection = items => ({ entity: 'collection', count: items.length, items });
function world({ existing = null, lostCreate = false, barrier = 0 } = {}) {
  const state = { calls: [], created: existing, commits: 0, lookups: 0 };
  let release;
  const held = barrier ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  const fetcher = async (address, init = {}) => {
    const url = new URL(address), method = init.method ?? 'GET';
    assert.equal(url.origin, 'https://api.razorpay.com');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, 'Basic ' + btoa(keyId + ':' + keySecret));
    assert.ok(init.signal instanceof AbortSignal);
    state.calls.push({ method, pathname: url.pathname, query: url.search });
    if (method === 'GET' && url.pathname === '/v1/orders') {
      assert.equal(url.searchParams.get('receipt'), internal);assert.equal(url.searchParams.get('count'), '2');
      const before = state.created;
      if (barrier && ++state.lookups <= barrier) { if (state.lookups === barrier) release(); await held; }
      return Response.json(collection(before ? [before] : []));
    }
    if (method === 'GET') {
      assert.equal(url.pathname, '/v1/orders/order_fictional');
      return state.created ? Response.json(state.created) : Response.json({}, { status: 404 });
    }
    assert.equal(method, 'POST');
    assert.deepEqual(JSON.parse(init.body), { amount: 119300, currency: 'INR', receipt: internal,
      partial_payment: false, notes: { designmocks_order: internal } });
    if (state.created) return Response.json({ error: 'Fictional duplicate receipt.' }, { status: 400 });
    state.created = provider();state.commits++;
    if (lostCreate) throw new Error('Fictional committed response loss.');
    return Response.json(state.created);
  };
  return { state, fetcher, options: { keyId, keySecret, fetcher } };
}

test('a new order follows verified empty receipt lookup with exactly one fixed-price nonpartial create', async () => {
  const w = world();assert.equal(await resolveProviderOrder(prepared, w.options), 'order_fictional');
  assert.deepEqual(w.state.calls.map(c => c.method), ['GET', 'POST']);assert.equal(w.state.commits, 1);
});
test('a lost committed provider reply is recovered by receipt without a second create', async () => {
  const w = world({ lostCreate: true });assert.equal(await resolveProviderOrder(prepared, w.options), 'order_fictional');
  assert.deepEqual(w.state.calls.map(c => c.method), ['GET', 'POST', 'GET']);assert.equal(w.state.commits, 1);
});
test('an earlier unattached provider commit is reused without posting a new order', async () => {
  const w = world({ existing: provider() });assert.equal(await resolveProviderOrder(prepared, w.options), 'order_fictional');
  assert.deepEqual(w.state.calls.map(c => c.method), ['GET']);assert.equal(w.state.commits, 0);
});
test('an attached order is independently verified by its exact provider ID and receipt', async () => {
  const w = world({ existing: provider({ status: 'attempted' }) });
  assert.equal(await resolveProviderOrder({ ...prepared, providerOrderId: 'order_fictional' }, w.options), 'order_fictional');
  assert.equal(w.state.calls[0].pathname, '/v1/orders/order_fictional');assert.equal(w.state.calls.length, 1);
  w.state.created = provider({ id: 'order_different' });
  await assert.rejects(resolveProviderOrder({ ...prepared, providerOrderId: 'order_fictional' }, w.options));
});
test('twelve concurrent empty lookups recover the same unique receipt after provider duplicate responses', async () => {
  const w = world({ barrier: 12 });
  const ids = await Promise.all(Array.from({ length: 12 }, () => resolveProviderOrder(prepared, w.options)));
  assert.deepEqual([...new Set(ids)], ['order_fictional']);assert.equal(w.state.commits, 1);
});
test('another receipt, account note, amount, currency, ID or entity is never a recovery candidate', async () => {
  for (const patch of [{ receipt: 'another' }, { notes: { designmocks_order: 'another' } }, { notes: {} },
    { amount: 119301 }, { currency: 'USD' }, { id: 'order_bad/path' }, { entity: 'payment' }]) {
    const w = world({ existing: provider(patch) });await assert.rejects(resolveProviderOrder(prepared, w.options));
    assert.equal(w.state.calls.length, 1);assert.equal(w.state.commits, 0);
  }
});
test('paid, partially paid, partial-enabled and inconsistent-due orders never open or create another checkout', async () => {
  for (const patch of [{ status: 'paid', amount_paid: 119300, amount_due: 0 }, { amount_paid: 100, amount_due: 119200 },
    { partial_payment: true }, { amount_due: 0 }, { amount_paid: '0' }, { status: 'refunded' }]) {
    const w = world({ existing: provider(patch) });await assert.rejects(resolveProviderOrder(prepared, w.options));
    assert.equal(w.state.calls.length, 1);assert.equal(w.state.commits, 0);
  }
});
test('unavailable, malformed, duplicate and ambiguous lookup data fail closed before creating anything', async () => {
  for (const result of [null, {}, { entity: 'collection', count: 1, items: [] }, collection([provider(), provider()]),
    { entity: 'collection', count: '0', items: [] }]) {
    let calls = 0;await assert.rejects(resolveProviderOrder(prepared, { keyId, keySecret, fetcher: async () => {
      calls++;return Response.json(result);
    } }));assert.equal(calls, 1);
  }
  for (const response of [new Response('broken'), Response.json({}, { status: 503 }), new Response(' '.repeat(65537))]) {
    let calls = 0;await assert.rejects(resolveProviderOrder(prepared, { keyId, keySecret, fetcher: async () => { calls++;return response; } }));assert.equal(calls, 1);
  }
});
test('an uncertain create with no recoverable order performs only one POST', async () => {
  for (const failure of [() => { throw new Error('Fictional failure'); }, () => Response.json({}, { status: 400 }),
    () => Response.json(provider({ receipt: 'another' }))]) {
    const calls=[];await assert.rejects(resolveProviderOrder(prepared, { keyId, keySecret, fetcher: async (_, init) => {
      calls.push(init.method??'GET');return init.method==='POST'?failure():Response.json(collection([]));
    } }));assert.deepEqual(calls, ['GET', 'POST', 'GET']);
  }
});
test('invalid server money, mode, identifiers or merchant key never reach a provider', async () => {
  for (const patch of [{ amount: 119301 }, { currency: 'USD' }, { mode: 'unknown' }, { mode: 'live' },
    { id: 'untrusted' }, { providerOrderId: 'order_/untrusted' }, { providerOrderId: undefined }]) {
    const w=world();await assert.rejects(resolveProviderOrder({ ...prepared, ...patch },w.options));assert.equal(w.state.calls.length,0);
  }
  const w=world();await assert.rejects(resolveProviderOrder(prepared,{...w.options,keyId:'rzp_test_bad\nvalue'}));assert.equal(w.state.calls.length,0);
});
test('a bounded lookup ignores a late success and cannot post after its deadline', async () => {
  const calls=[];let release;
  const task=resolveProviderOrder(prepared,{keyId,keySecret,timeoutMilliseconds:10,fetcher:async(_,init)=>{
    calls.push(init.method??'GET');return new Promise(resolve=>{release=resolve;});
  }});
  await assert.rejects(task);release(Response.json(collection([])));await new Promise(resolve=>setTimeout(resolve,1));
  assert.deepEqual(calls,['GET']);
});
test('a cancelled provider operation never dispatches or attaches a late order', async () => {
  const controller=new AbortController();controller.abort();const w=world();
  await assert.rejects(resolveProviderOrder(prepared,{...w.options,signal:controller.signal}));assert.equal(w.state.calls.length,0);
});

const origin='http://127.0.0.1:7698';
function handlerFixture({attach='order_fictional',keys=true,prepareError=false,identity=true,timeoutMilliseconds=18000}={}){
  const w=world({lostCreate:true}),calls=[],failures=[],settings={PUBLIC_APP_ORIGIN:origin,SUPABASE_URL:'http://127.0.0.1:63321',
    SUPABASE_ANON_KEY:'fictional-anon',SUPABASE_SERVICE_ROLE_KEY:'fictional-service',...(keys?{RAZORPAY_KEY_ID:keyId,RAZORPAY_KEY_SECRET:keySecret}:{})};
  const handler=createOrderHandler({readEnvironment:key=>settings[key],providerFetch:w.fetcher,timeoutMilliseconds,reportFailure:code=>failures.push(code),
    createClient:(url,key,options)=>{
      assert.equal(url,settings.SUPABASE_URL);
      if(key===settings.SUPABASE_ANON_KEY)assert.equal(options.global.headers.Authorization,'Bearer fictional-actor');
      else assert.equal(key,settings.SUPABASE_SERVICE_ROLE_KEY);
      return{auth:{getUser:async token=>{calls.push('getUser');assert.equal(token,'fictional-actor');return{data:{user:identity?{id:internal}:null},error:null};}},
        rpc:async(name,input)=>{calls.push(name);if(name==='prepare_order')return{data:prepared,error:prepareError?new Error('Private diagnostic'):null};
          assert.equal(name,'attach_provider_order');assert.deepEqual(input,{p_id:internal,p_provider_id:'order_fictional'});return{data:attach,error:null};}};
    }});
  const request=(body={plan:'annual'},headers={})=>new Request(origin+'/functions/v1/create-order',{method:'POST',headers:{Origin:origin,Authorization:'Bearer fictional-actor','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  return{handler,request,calls,w,failures};
}
test('the actual order handler recovers and binds the order without granting a pass or returning diagnostics',async()=>{
  const f=handlerFixture(),response=await f.handler(f.request());assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{orderId:'order_fictional',keyId,amount:119300,currency:'INR'});
  assert.deepEqual(f.calls,['getUser','prepare_order','attach_provider_order']);assert.equal(f.w.state.commits,1);
  assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
});
test('an unexpected saved provider ID cannot open a window for a different attached order',async()=>{
  const f=handlerFixture({attach:'order_unrelated'}),response=await f.handler(f.request());assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'Could not confirm checkout. Check your pass before trying again.'});
  assert.deepEqual(f.failures,['checkout_unconfirmed']);
});
test('missing merchant configuration, origin and identity failures cannot reach the provider',async()=>{
  for(const scenario of[{keys:false,status:503},{identity:false,status:401},{prepareError:true,status:409}]){
    const f=handlerFixture(scenario),response=await f.handler(f.request());assert.equal(response.status,scenario.status);assert.equal(f.w.state.calls.length,0);
  }
  const f=handlerFixture();assert.equal((await f.handler(f.request(undefined,{Origin:'https://unrelated.invalid'}))).status,403);assert.equal(f.calls.length,0);
  assert.equal((await f.handler(f.request(undefined,{Authorization:''}))).status,401);assert.equal(f.w.state.calls.length,0);
});
test('unknown plans and malformed JSON never prepare an order',async()=>{
  const f=handlerFixture();assert.equal((await f.handler(f.request({plan:'monthly'}))).status,400);
  const bad=new Request(origin,{method:'POST',headers:{Origin:origin,Authorization:'Bearer fictional-actor'},body:'{'});
  assert.equal((await f.handler(bad)).status,400);assert.equal(f.calls.includes('prepare_order'),false);assert.equal(f.w.state.calls.length,0);
});
test('the complete handler deadline fences an SDK identity reply that arrives after the response',async()=>{
  let release,preparedCalls=0,providerCalls=0;
  const handler=createOrderHandler({readEnvironment:key=>({PUBLIC_APP_ORIGIN:origin,SUPABASE_URL:'fictional',SUPABASE_ANON_KEY:'fictional',SUPABASE_SERVICE_ROLE_KEY:'fictional',RAZORPAY_KEY_ID:keyId,RAZORPAY_KEY_SECRET:keySecret})[key],timeoutMilliseconds:10,
    providerFetch:async()=>{providerCalls++;assert.fail('No late provider call');},createClient:()=>({auth:{getUser:()=>new Promise(resolve=>{release=resolve;})},rpc:()=>{preparedCalls++;}})});
  const response=await handler(new Request(origin,{method:'POST',headers:{Origin:origin,Authorization:'Bearer fictional-actor'},body:'{"plan":"annual"}'}));
  assert.equal(response.status,503);release({data:{user:{id:internal}},error:null});await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal(preparedCalls,0);assert.equal(providerCalls,0);
});
