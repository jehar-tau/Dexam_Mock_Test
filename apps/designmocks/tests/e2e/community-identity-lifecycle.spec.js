import{expect,test}from'@playwright/test';
import{readFile}from'node:fs/promises';
import{portalFixtureURL,seedPortalSession,stubPortalProvider}from'./portal-fixture.js';
import{communityFeedFixture}from'./community-feed-fixture.js';
import{orientationPages}from'./drawing-orientation-fixture.js';
test.use({baseURL:portalFixtureURL});
const first={id:'00000000-0000-4000-8000-000000001601',email:'fictional-community-first@example.invalid'},second={id:'00000000-0000-4000-8000-000000001602',email:'fictional-community-second@example.invalid'};
const postId='10000000-0000-4000-8000-000000001601',createdId='10000000-0000-4000-8000-000000001602';
const post={id:postId,exam:'uceed',topic:'fictional',title:'An original fictional identity discussion',body:'An original fictional approach to solving this design problem.',author:'Fictional student',comments:0,status:'visible',assetCount:1};
const api='https://dmocks-portal-fixture.supabase.co',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
const actorOf=route=>JSON.parse(Buffer.from(route.request().headers().authorization.split(' ')[1].split('.')[1],'base64url')).sub;
async function fixture(page,{identity=null,empty=false,identityHold=null,images=false}={}){
 const samples=images?await orientationPages(6):[];
 const state={identity,identityHold,heldIdentity:0,feedReads:0,feedHold:null,posts:empty?[]:[{...post}],writes:[],edge:[],edgeHold:null,edgeStatus:null,writeHold:null,threadHold:null,threadReads:0,finishedThreads:0};
 const provider=await stubPortalProvider(page,name=>{if(name==='public_all_india_top_ten')return[];});
 await page.route(api+'/auth/v1/user',async route=>{if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const actor=state.identity??actorOf(route),held=state.identityHold;if(held){state.heldIdentity++;await held.promise;}await route.fulfill({headers,json:{id:actor,aud:'authenticated',app_metadata:{provider:'google'},user_metadata:{}}}).catch(()=>{});});
 await page.route(api+'/rest/v1/rpc/**',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const name=new URL(route.request().url()).pathname.split('/').at(-1),input=route.request().postDataJSON(),actor=actorOf(route);let data;
  if(name==='community_feed'){state.feedReads++;data=communityFeedFixture(state.posts,input);const held=state.feedHold;if(held)await held.promise;}
  else if(name==='create_community_post'){
   state.writes.push({actor,input});state.posts=[{...post,id:createdId,title:input.p_title,body:input.p_body,assetCount:0}];data={id:createdId,postId:createdId,parentId:null,status:'visible',postStatus:'visible',canUpload:true,replayed:false};const held=state.writeHold;if(held)await held.promise;
  }else if(name==='community_thread'||name==='community_reply_context'){
   state.threadReads++;const selected=state.posts.find(row=>row.id===input.p_post_id);data={...selected,isMine:true,canAttach:true,version:1,comments:[],nextCursor:null};const held=state.threadHold;if(held)await held.promise;state.finishedThreads++;
  }else throw new Error('Unexpected fictional Community RPC: '+name);
  await route.fulfill({headers,json:data}).catch(()=>{});
 });
 await page.route(api+'/functions/v1/community-media',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});const actor=actorOf(route),multipart=!route.request().headers()['content-type'].startsWith('application/json');state.edge.push({actor,multipart,body:route.request().postData()});const held=state.edgeHold,status=state.edgeStatus??200;if(held)await held.promise;
  await route.fulfill({headers,status,json:status!==200?{error:'private-provider-diagnostic'}:multipart?{id:'30000000-0000-4000-8000-000000001601',ordinal:1}:{media:samples.slice(0,1).map(item=>({...item,id:'30000000-0000-4000-8000-000000001601'})),serverNow:'2026-11-08T00:00:00Z',expiresAt:'2026-11-08T00:05:00Z'}}).catch(()=>{});
 });
 await page.goto('/account');await seedPortalSession(page,first);await page.goto('/dashboard/community/discussions');await expect(page.getByRole('heading',{name:/Ask clearly/})).toBeVisible();return Object.assign(state,provider);
}
async function compose(page,images=false){await page.getByLabel('Topic',{exact:true}).fill('fictional');await page.getByLabel('Question title',{exact:true}).fill(post.title);await page.getByLabel('Your approach or question',{exact:true}).fill(post.body);if(images)await page.getByLabel('Question images (optional, up to 3)',{exact:true}).setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:await readFile(new URL('../fixtures/drawing-images/fictional-drawing.png',import.meta.url))});}
const send=page=>page.getByRole('button',{name:'Post to community',exact:true});

test('Community verifies the current identity before opening discussions and drafts',async({page})=>{
 const state=await fixture(page,{identity:second.id});await expect(page.getByRole('alert')).toContainText('Community access');expect(state.feedReads).toBe(0);await expect(page.getByLabel('Question title',{exact:true})).toHaveCount(0);
});

test('a Community history change disposes the previous unsent text and selected files',async({page})=>{
 const state=await fixture(page);await compose(page,true);await page.evaluate(()=>{history.pushState({...history.state,key:'new-private-community-history'},'',location.href);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));});await expect(page.getByLabel('Question title',{exact:true})).toHaveValue('');await expect(page.getByLabel('Your approach or question',{exact:true})).toHaveValue('');expect(await page.getByLabel('Question images (optional, up to 3)',{exact:true}).evaluate(node=>node.files.length)).toBe(0);expect(state.writes).toEqual([]);
});

test('a silent token change cannot post another account draft',async({page})=>{
 const state=await fixture(page,{empty:true});await compose(page);await seedPortalSession(page,second);await send(page).click();await expect(page.getByRole('alert')).toContainText('Community access');expect(state.writes).toEqual([]);expect(state.edge).toEqual([]);
});

test('a token change after a thread read cannot sign its private images as another actor',async({page})=>{
 const state=await fixture(page),held=deferred();state.threadHold=held;await page.getByRole('button',{name:'Open discussion',exact:true}).click();await expect.poll(()=>state.threadReads).toBe(1);await seedPortalSession(page,second);held.resolve();await expect(page.getByRole('alert')).toContainText('Community access');expect(state.edge).toEqual([]);await expect(page.getByRole('region',{name:'Discussion thread',exact:true})).toHaveCount(0);
});

test('a saved post cannot upload its selected images as an unannounced new account',async({page})=>{
 const state=await fixture(page,{empty:true}),held=deferred();state.writeHold=held;await compose(page,true);await send(page).click();await expect.poll(()=>state.writes.length).toBe(1);await seedPortalSession(page,second);held.resolve();await expect(page.getByRole('alert')).toContainText('Community access');expect(state.writes[0].actor).toBe(first.id);expect(state.edge).toEqual([]);
});

test('visible identity loss clears Community drafts and private views without replay',async({page})=>{
 await page.clock.install();const state=await fixture(page);await compose(page);await page.getByLabel('Question title',{exact:true}).focus();state.identity=second.id;await page.clock.fastForward(60001);await expect(page.getByRole('alert')).toContainText('Community access');await expect(page.getByLabel('Question title',{exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:/Ask clearly/})).toBeFocused();expect(state.writes).toEqual([]);
});

test('a late initial identity check cannot reopen Community after its deadline',async({page})=>{
 await page.clock.install();const held=deferred(),state=await fixture(page,{identityHold:held});await expect.poll(()=>state.heldIdentity).toBeGreaterThan(0);await page.clock.fastForward(10001);await expect(page.getByRole('alert')).toContainText('Community access');expect(state.feedReads).toBe(0);state.identityHold=null;held.resolve();await expect(page.getByLabel('Question title',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Check Community access',exact:true}).press('Enter');await expect(send(page)).toBeVisible();await expect.poll(()=>state.feedReads).toBe(1);expect(state.writes).toEqual([]);
});

test('a post verified before a token change remains bound to its original author',async({page})=>{
 const state=await fixture(page,{empty:true});await expect.poll(()=>state.feedReads).toBe(1);await compose(page);const held=deferred();state.identityHold=held;await send(page).click();await expect.poll(()=>state.heldIdentity).toBe(1);await seedPortalSession(page,second);state.identityHold=null;held.resolve();await expect(page.getByRole('alert')).toContainText('Community access');expect(state.writes.map(row=>row.actor)).toEqual([first.id]);await expect(page.getByLabel('Question title',{exact:true})).toHaveCount(0);
});

for(const kind of['multipart upload','private signing'])test(`a ${kind} verified before a token change keeps the captured actor`,async({page})=>{
 const multipart=kind==='multipart upload',state=await fixture(page,{empty:multipart}),readHold=deferred(),identityHold=deferred();
 if(multipart){state.writeHold=readHold;await compose(page,true);await send(page).click();await expect.poll(()=>state.writes.length).toBe(1);}
 else{state.threadHold=readHold;await page.getByRole('button',{name:'Open discussion',exact:true}).click();await expect.poll(()=>state.threadReads).toBe(1);}
 state.identityHold=identityHold;readHold.resolve();await expect.poll(()=>state.heldIdentity).toBe(1);await seedPortalSession(page,second);state.identityHold=null;identityHold.resolve();await expect.poll(()=>state.edge.length).toBe(1);expect(state.edge[0]).toMatchObject({actor:first.id,multipart});await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.getByRole('alert')).toContainText('Community access');await expect(page.getByRole('region',{name:'Discussion thread',exact:true})).toHaveCount(0);
});

test('a denied image target preserves another permitted Community draft and files',async({page})=>{
 const state=await fixture(page);await compose(page,true);state.edgeStatus=403;await page.getByRole('button',{name:'Open discussion',exact:true}).click();await expect(page.getByText('This discussion or its images are unavailable. Refresh the feed or try again.',{exact:true})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByLabel('Question title',{exact:true})).toHaveValue(post.title);expect(await page.getByLabel('Question images (optional, up to 3)',{exact:true}).evaluate(node=>node.files.length)).toBe(1);await expect(send(page)).toBeEnabled();await expect(page.getByText('private-provider-diagnostic',{exact:false})).toHaveCount(0);state.edgeStatus=null;await page.getByRole('button',{name:'Open discussion',exact:true}).click();await expect(page.getByRole('region',{name:'Discussion thread',exact:true})).toBeVisible();expect(state.writes).toEqual([]);
});

test('a feed deadline ignores its late page and preserves the unsent draft until explicit refresh',async({page})=>{
 await page.clock.install();const state=await fixture(page);await expect.poll(()=>state.feedReads).toBe(1);await compose(page);const held=deferred();state.feedHold=held;await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect.poll(()=>state.feedReads).toBe(2);await page.clock.fastForward(20001);await expect(page.getByRole('status')).toHaveText('Couldn’t load discussions. Try again.');await expect(page.getByLabel('Question title',{exact:true})).toHaveValue(post.title);state.feedHold=null;held.resolve();await expect(page.getByRole('button',{name:'Open discussion',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Refresh discussions',exact:true}).press('Enter');await expect(page.getByRole('button',{name:'Open discussion',exact:true})).toBeVisible();expect(state.writes).toEqual([]);
});

test('an upload deadline retains the saved text and exact image retry without an automatic resend',async({page})=>{
 await page.clock.install();const state=await fixture(page,{empty:true}),held=deferred();state.edgeHold=held;await compose(page,true);await send(page).click();await expect.poll(()=>state.edge.filter(row=>row.multipart).length).toBe(1);await page.clock.fastForward(60001);await expect(page.getByText('An image did not confirm. Retry the remaining images; your saved text will not be posted again.',{exact:true})).toBeVisible();const retry=page.getByRole('button',{name:'Retry post images',exact:true});await expect(retry).toBeEnabled();expect(state.writes).toHaveLength(1);expect(state.edge.filter(row=>row.multipart)).toHaveLength(1);state.edgeHold=null;await retry.press('Enter');await expect(page.getByText('Your post is live. All images confirmed.',{exact:true})).toBeVisible();held.resolve();expect(state.writes).toHaveLength(1);const uploads=state.edge.filter(row=>row.multipart);expect(uploads.map(row=>row.actor)).toEqual([first.id,first.id]);for(const upload of uploads){expect(upload.body).toContain(createdId);expect(upload.body).toContain('fictional.png');}await expect(page.getByRole('region',{name:'Saved post images',exact:true})).toHaveCount(0);
});

test('losing current identity closes an active image inspector and restores the public heading',async({page})=>{
 const state=await fixture(page,{images:true});await page.getByRole('button',{name:'Open discussion',exact:true}).click();await page.getByRole('button',{name:'Inspect question attachment 1',exact:true}).press('Enter');await expect(page.getByRole('dialog',{name:'Question attachment 1',exact:true})).toBeVisible();state.identity=second.id;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.getByRole('alert')).toContainText('Community access');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('heading',{name:/Ask clearly/})).toBeFocused();expect(state.writes).toEqual([]);
});
