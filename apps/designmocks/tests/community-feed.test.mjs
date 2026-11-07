import test from "node:test";
import assert from "node:assert/strict";
import {communityFeedFilters,communityFeedInput,communityFeedCursor,validateCommunityFeed,mergeCommunityFeed} from "../src/community-feed.js";
const filters={exam:"uceed",topic:"Perspective & form"},at="2026-11-08T01:02:03.123456+00:00",snapshot="2026-11-08T01:03:04.654321+00:00";
const row=n=>({id:`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`,exam:"uceed",topic:filters.topic,title:"Original fictional question",body:"An original fictional discussion body.",author:"Student",status:"visible",comments:0,createdAt:at});
const cursor=n=>({createdAt:at,id:row(n).id,snapshotAt:snapshot,version:4,...filters});
const page=(posts,nextCursor=null)=>({posts,nextCursor,filters:{...filters},version:4,snapshotAt:snapshot});
test("feed filters normalize exams and whitespace while retaining exact topic case and punctuation",()=>{
 assert.deepEqual(communityFeedFilters(" UCEED "," Perspective & form "),filters);
 assert.deepEqual(communityFeedFilters("","  "),{exam:null,topic:null});
 assert.deepEqual(communityFeedFilters(null,"perspective"),{exam:null,topic:"perspective"});
 for(const pair of [["invalid",null],[[],null],[null,{}],[null,"x".repeat(101)]])assert.throws(()=>communityFeedFilters(...pair));
});
test("feed RPC input keeps PostgreSQL microseconds and binds both filters with a bounded page size",()=>{
 const original=cursor(1),input=communityFeedInput(filters,original);
 assert.deepEqual(input,{p_exam:filters.exam,p_topic:filters.topic,p_cursor:original,p_limit:25});
 assert.equal(input.p_cursor.createdAt,at);assert.equal(input.p_cursor.snapshotAt,snapshot);
 assert.notEqual(input.p_cursor,original);
 assert.deepEqual(communityFeedInput({exam:null,topic:null}),{p_exam:null,p_topic:null,p_cursor:null,p_limit:25});
});
test("cursor keys, identities, finite times, integral versions and exact filters are verified",()=>{
 for(const value of [null,[],{}, {...cursor(1),extra:true},{...cursor(1),id:"invalid"},{...cursor(1),id:[row(1).id]},{...cursor(1),createdAt:"infinity"},
  {...cursor(1),snapshotAt:snapshot+" ".repeat(1000)},
  {...cursor(1),createdAt:"2027-01-01T00:00:00Z"},{...cursor(1),version:1.5},{...cursor(1),version:0},
  {...cursor(1),version:Number.MAX_SAFE_INTEGER+1},{...cursor(1),exam:"ceed"},{...cursor(1),topic:"perspective & form"}])assert.throws(()=>communityFeedCursor(value,filters));
});
test("validated feed pages are bounded, visible, unique and scoped to the selected filter",()=>{
 const valid=page([row(1)],cursor(1));assert.deepEqual(validateCommunityFeed(valid,filters),valid);
 for(const value of [[],{...valid,posts:Array.from({length:26},(_,n)=>row(n))},{...valid,posts:[row(1),row(1)]},
  {...valid,posts:[{...row(1),status:"hidden"}]},{...valid,posts:[{...row(1),exam:"ceed"}]},
  {...valid,posts:[{...row(1),topic:"Other topic"}]},{...valid,posts:[{...row(1),comments:-1}]},
  {...valid,filters:{exam:"ceed",topic:filters.topic}},{...valid,version:1.5},{...valid,snapshotAt:"invalid"}])assert.throws(()=>validateCommunityFeed(value,filters));
 assert.deepEqual(validateCommunityFeed(page([]),filters).posts,[]);
});
test("a continuation must describe the last returned row in the exact page snapshot",()=>{
 for(const value of [page([],cursor(1)),page([row(1)],cursor(2)),page([row(1)],{...cursor(1),createdAt:"2026-11-08T01:02:03.123000+00:00"}),
  page([row(1)],{...cursor(1),snapshotAt:"2026-11-08T01:03:04.654000+00:00"}),page([row(1)],{...cursor(1),version:3})])assert.throws(()=>validateCommunityFeed(value,filters));
});
test("page merging preserves prior order and refuses overlapping or changed snapshots",()=>{
 const first=page([row(1)],cursor(1)),next=page([row(2)]);
 assert.deepEqual(mergeCommunityFeed(first,next).posts,[row(1),row(2)]);
 for(const changed of [page([row(1)]),{...next,version:5},{...next,snapshotAt:at},{...next,filters:{exam:"ceed",topic:filters.topic}}])assert.throws(()=>mergeCommunityFeed(first,changed));
});
