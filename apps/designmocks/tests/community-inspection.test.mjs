import test from "node:test";
import assert from "node:assert/strict";
import {communityImageKey,communityImageSelection} from "../src/community-inspection.js";
const first={id:"fictional-image-one",url:"https://example.invalid/private/one?token=fictional-first"};
const second={id:"fictional-image-two",url:"https://example.invalid/private/two?token=fictional-second"};
test("member inspection binds the exact image identity and current signed URL",()=>{
 const key=communityImageKey(first);assert.notEqual(key,communityImageKey({...first,url:second.url}));assert.notEqual(key,communityImageKey({...first,id:second.id}));
 assert.deepEqual(communityImageSelection([first,second],key),{image:first,index:0,key});
});
test("refreshed links, removal, empty scope and changed identities close an older selection",()=>{
 const key=communityImageKey(first);
 for(const images of [[],null,[second],[{...first,url:second.url}],[{...first,id:second.id}]])assert.equal(communityImageSelection(images,key),null);
});
test("inspection reads current authorized metadata rather than retaining an older object",()=>{
 const current={...first,orientation:6,width:40,height:60};
 const selected=communityImageSelection([second,current],communityImageKey(first));assert.equal(selected.image,current);assert.equal(selected.index,1);
});
test("ambiguous or malformed image scope cannot open a private inspector",()=>{
 assert.equal(communityImageSelection([first,{...first}],communityImageKey(first)),null);
 for(const value of [null,{}, {id:first.id},{url:first.url},{id:1,url:first.url},{id:first.id,url:{}},{id:"",url:first.url},{id:first.id,url:""}])assert.equal(communityImageKey(value),null);
 assert.equal(communityImageSelection([first],null),null);
});
