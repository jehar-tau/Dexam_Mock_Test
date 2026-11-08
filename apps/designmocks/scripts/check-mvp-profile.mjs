import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
const source=readFileSync(new URL('../supabase/launch/paid-mvp.sql',import.meta.url),'utf8'),manifest=JSON.parse(readFileSync(new URL('../supabase/launch/paid-mvp-rpcs.json',import.meta.url),'utf8'));
assert.ok(Array.isArray(manifest)&&manifest.length>0&&manifest.length<=60);
assert.equal(new Set(manifest.map(row=>row.signature)).size,manifest.length);
for(const row of manifest){assert.match(row.signature,/^public\.[a-z_]+\([a-z\[\], ]*\)$/);assert.ok(['student','staff'].includes(row.category));if(row.category==='staff')assert.match(row.signature,/^public\.(admin_|is_dmocks_admin\()/);assert.doesNotMatch(row.signature,/fulfil_verified_payment|record_verified_refund|attach_provider_order|start_exam_mock|start_topic_practice|start_all_india|learning_|community_|drawing/);}
const block=source.match(/-- BEGIN RPC MANIFEST([\s\S]*?)-- END RPC MANIFEST/);assert.ok(block);
const sqlRows=[...block[1].matchAll(/\('([^']+)','(student|staff)'\)/g)].map(([,signature,category])=>({signature,category}));assert.deepEqual(sqlRows,manifest);
assert.doesNotMatch(source,/update\s+(?:public\.)?launch_settings\s+set\s+sales_enabled\s*=\s*true/i);
assert.doesNotMatch(source,/update\s+dm_private\.registration_policy\s+set\s+mode\s*=\s*'open'/i);
console.log(`PASS: paid MVP deployment profile; ${manifest.length} explicit authenticated RPCs; SHA-256 ${createHash('sha256').update(source).digest('hex')}.`);
