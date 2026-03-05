import { readFileSync, writeFileSync } from 'fs';

const file = 'postman/LeadFlow-AI-Postman-Collection-v3.json';
const col = JSON.parse(readFileSync(file, 'utf8'));

// ── FIX A: Create Project test script ──────────────────────────────────────
const patchA = (items) => {
    for (const item of items) {
        if (item.name === 'Create Project') {
            const testEvent = item.event?.find(e => e.listen === 'test');
            if (testEvent) {
                testEvent.script.exec = [
                    'pm.test("Status 201", () => pm.response.to.have.status(201));',
                    'let j = pm.response.json();',
                    'pm.test("Save projectId", () => {',
                    '  const id = j.data?.project?.id || j.data?.id;',
                    '  pm.expect(id).to.exist;',
                    '  pm.collectionVariables.set("projectId", id);',
                    '});',
                ];
                console.log('Fix A: Create Project test script updated');
                return true;
            }
        }
        if (item.item && patchA(item.item)) return true;
    }
    return false;
};
patchA(col.item);

// ── FIX B: Customer 1 & 2 pre-request scripts + bodies ─────────────────────
const patchB = (items) => {
    for (const item of items) {
        if (item.name === 'Create Customer 1') {
            item.event = item.event || [];
            // Remove any existing prerequest to avoid duplicates
            item.event = item.event.filter(e => e.listen !== 'prerequest');
            item.event.push({
                listen: 'prerequest',
                script: {
                    type: 'text/javascript',
                    exec: [
                        'const ts = Date.now().toString().slice(-7);',
                        'pm.collectionVariables.set("custMobile1", "98765" + ts.slice(0,5));',
                        'pm.collectionVariables.set("custPan1", "ABCDE" + ts.slice(0,4) + "F");',
                        'pm.collectionVariables.set("custEmail1", "priya" + ts + "@example.com");',
                    ],
                },
            });
            item.request.body.raw = JSON.stringify({
                fullName: 'Priya Sharma',
                mobilePrimary: '{{custMobile1}}',
                email: '{{custEmail1}}',
                panNumber: '{{custPan1}}',
                aadhaarNumber: '123456789012',
                dateOfBirth: '1990-06-15',
                currentAddress: '12, Hill Road, Mumbai - 400050',
                occupation: 'Software Engineer',
                annualIncome: 1500000,
            }, null, 2);
            console.log('Fix B: Create Customer 1 patched');
        }

        if (item.name === 'Create Customer 2 (for transfer)') {
            item.event = item.event || [];
            item.event = item.event.filter(e => e.listen !== 'prerequest');
            item.event.push({
                listen: 'prerequest',
                script: {
                    type: 'text/javascript',
                    exec: [
                        'const ts2 = Date.now().toString().slice(-7);',
                        'pm.collectionVariables.set("custMobile2", "91234" + ts2.slice(0,5));',
                        'pm.collectionVariables.set("custEmail2", "vikram" + ts2 + "@example.com");',
                        'pm.collectionVariables.set("custPan2", "XYZPN" + ts2.slice(0,4) + "K");',
                    ],
                },
            });
            item.request.body.raw = JSON.stringify({
                fullName: 'Vikram Nair',
                mobilePrimary: '{{custMobile2}}',
                email: '{{custEmail2}}',
                panNumber: '{{custPan2}}',
                dateOfBirth: '1992-03-20',
                currentAddress: '7, Worli Sea Face, Mumbai - 400030',
            }, null, 2);
            console.log('Fix B: Create Customer 2 patched');
        }

        if (item.item) patchB(item.item);
    }
};
patchB(col.item);

// ── FIX B: Add new collection variables ────────────────────────────────────
const newVars = ['custMobile1', 'custPan1', 'custEmail1', 'custMobile2', 'custEmail2', 'custPan2'];
newVars.forEach(key => {
    const exists = col.variable.find(v => v.key === key);
    if (!exists) {
        col.variable.push({ key, value: '' });
        console.log('Fix B: collection variable added:', key);
    } else {
        console.log('Fix B: collection variable already exists:', key);
    }
});

writeFileSync(file, JSON.stringify(col, null, 2));
console.log('\nCollection saved successfully.');
