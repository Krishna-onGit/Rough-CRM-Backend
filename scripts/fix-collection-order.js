/**
 * Fix 9: Swap sections 03 (Units) and 04 (Sales Team) so that
 * Create Sales Person runs before Block Unit tests.
 * Also adds unique spCode/mobile/email to Create Sales Person to
 * prevent 409 conflicts on reruns.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const collectionPath = join(__dirname, '..', 'postman', 'LeadFlow-AI-Postman-Collection-v3.json');
const col = JSON.parse(readFileSync(collectionPath, 'utf8'));

const items = col.item;

// Find indices of the Units and Sales Team folders
const unitsIdx = items.findIndex(i => i.name.startsWith('03. Units'));
const salesIdx = items.findIndex(i => i.name.startsWith('04. Sales Team'));

if (unitsIdx === -1 || salesIdx === -1) {
    console.error('Could not find Units or Sales Team sections');
    console.log('Section names:', items.map(i => i.name));
    process.exit(1);
}

console.log(`Found "03. Units" at index ${unitsIdx}`);
console.log(`Found "04. Sales Team" at index ${salesIdx}`);

// Swap the two sections
[items[unitsIdx], items[salesIdx]] = [items[salesIdx], items[unitsIdx]];

// Rename to keep logical ordering:
// former "04. Sales Team" is now at unitsIdx (position 2) → rename to "03. Sales Team"
// former "03. Units" is now at salesIdx (position 3) → rename to "04. Units (incl. 3-block limit test)"
items[unitsIdx].name = items[unitsIdx].name.replace('04. Sales Team', '03. Sales Team');
items[salesIdx].name = items[salesIdx].name.replace('03. Units', '04. Units');

console.log(`Renamed: index ${unitsIdx} → "${items[unitsIdx].name}"`);
console.log(`Renamed: index ${salesIdx} → "${items[salesIdx].name}"`);

// Add unique-data pre-request script to "Create Sales Person" to prevent rerun 409
const salesSection = items[unitsIdx]; // now at unitsIdx after swap
const createSpReq = salesSection.item.find(r => r.name === 'Create Sales Person');

if (!createSpReq) {
    console.error('Could not find "Create Sales Person" request in Sales Team section');
    process.exit(1);
}

const preRequestScript = [
    "const ts = Date.now().toString().slice(-6);",
    "pm.collectionVariables.set('spCode', 'SP' + ts);",
    "pm.collectionVariables.set('spMobile', '9' + ts + '0000'.slice(0, 10 - 1 - ts.length));",
    "pm.collectionVariables.set('spEmail', 'sp' + ts + '@skyline-dev.com');"
];

// Ensure event array exists
if (!createSpReq.event) createSpReq.event = [];

// Remove any existing prerequest scripts
createSpReq.event = createSpReq.event.filter(e => e.listen !== 'prerequest');

// Add new pre-request script
createSpReq.event.unshift({
    listen: 'prerequest',
    script: {
        type: 'text/javascript',
        exec: preRequestScript,
    },
});

// Update body to use collection variables
createSpReq.request.body.raw = JSON.stringify({
    spCode: '{{spCode}}',
    fullName: 'Amit Sharma',
    mobile: '{{spMobile}}',
    email: '{{spEmail}}',
    team: 'South Pune',
    designation: 'Manager',
    monthlyTarget: 5000000,
}, null, 2);

console.log('Added pre-request script to Create Sales Person for unique spCode/mobile/email');

// Add collection variables for spCode, spMobile, spEmail if not present
const varKeys = col.variable.map(v => v.key);
for (const key of ['spCode', 'spMobile', 'spEmail']) {
    if (!varKeys.includes(key)) {
        col.variable.push({ key, value: '' });
        console.log(`Added collection variable: ${key}`);
    }
}

writeFileSync(collectionPath, JSON.stringify(col, null, 2));
console.log('\nCollection updated successfully.');
console.log('Section order is now:');
items.forEach((item, i) => console.log(`  [${i}] ${item.name}`));
