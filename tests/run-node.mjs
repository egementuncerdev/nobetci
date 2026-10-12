// Aynı testleri komut satırında çalıştırır: node tests/run-node.mjs
import { run } from './harness.js';
import './calc.test.js';
import './storage.test.js';
import './planner.test.js';
import './ics.test.js';

const results = await run();
for (const r of results) console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.pass ? '' : `\n    ${r.error}`}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} geçti`);
process.exit(failed ? 1 : 0);
