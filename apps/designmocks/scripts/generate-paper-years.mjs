import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yearPaperCatalogue } from '../src/paper-years.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'server/data/exports/dexam-bank-export.json'), 'utf8'));
const target = path.join(root, 'apps/designmocks/src/paper-years.generated.json');
const content = `${JSON.stringify(yearPaperCatalogue(source.questions), null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
    console.error('Year-wise Papers catalogue is stale. Run npm run papers:generate.');
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(target, content);
  console.log(`Generated ${JSON.parse(content).length} source paper groups`);
}
