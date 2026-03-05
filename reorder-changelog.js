const fs = require('fs');
let content = fs.readFileSync('CHANGELOG.md', 'utf8');

const p14_0 = content.indexOf('## [0.14.0] — 2026-03-03\n\n### 🧱 Phase 14');
const p14_1_start = content.indexOf('## [0.14.1] — 2026-03-03');
const p15_0_start = content.indexOf('## [0.15.0] — 2026-03-03');
const p14_2_start = content.indexOf('## [0.14.2] — 2026-03-03');
const p13_0_start = content.indexOf('## [0.13.0] — 2026-03-03');

const block14_0 = content.substring(p14_0, p14_1_start);
const block14_1 = content.substring(p14_1_start, p15_0_start);
const block15_0 = content.substring(p15_0_start, p14_2_start);
const block14_2 = content.substring(p14_2_start, p13_0_start);

// combine correctly:
let newChunk = block15_0 + block14_2 + block14_1 + block14_0;

content = content.substring(0, p14_0) + newChunk + content.substring(p13_0_start);

fs.writeFileSync('CHANGELOG.md', content);

console.log('Reordered CHANGELOG.md successfully!');
