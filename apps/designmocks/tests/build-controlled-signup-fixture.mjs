import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compilePublishedNotices} from '../scripts/published-notices.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), 'dmocks-free-notice-test-'));
try {
  const original = JSON.parse(await readFile(new URL('./fixtures/fictional-published-notices.json', import.meta.url), 'utf8'));
  const notice = {...original, scope:'release'};
  const path = join(scratch, 'notices.json');
  await writeFile(path, JSON.stringify(notice));
  execFileSync(process.execPath, [join(app,'node_modules/vite/bin/vite.js'),'build','--mode','production','--outDir','test-results/controlled-public'], {
    cwd:app, stdio:'inherit', env:{...process.env, DMOCKS_PUBLISHED_NOTICES_FILE:path, VITE_TERMS_VERSION:compilePublishedNotices(notice, {freeSignup:true}).version},
  });
} finally {
  await rm(scratch,{recursive:true,force:true});
}
