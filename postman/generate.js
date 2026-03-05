// Postman Collection Generator for LeadFlow AI CRM
// Run: node postman/generate.js
import { writeFileSync } from 'fs';
import { folders00to05 } from './parts/p1.js';
import { folders06to11 } from './parts/p2.js';
import { folders12to17 } from './parts/p3.js';
import { folders18to23 } from './parts/p4.js';

const collection = {
    info: {
        name: "LeadFlow AI CRM — Complete API Collection v3",
        description: "Auto-generated from actual source code (Zod schemas, Express routes, service files). Every field name, path, and response shape is verified against the codebase.",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
        { key: "baseUrl", value: "http://localhost:5000" },
        { key: "token", value: "" },
        { key: "refreshToken", value: "" },
        { key: "orgId", value: "" },
        { key: "userId", value: "" },
        { key: "projectId", value: "" },
        { key: "unitId", value: "" },
        { key: "unitId2", value: "" },
        { key: "unitId3", value: "" },
        { key: "unitId4", value: "" },
        { key: "bookingId", value: "" },
        { key: "leadId", value: "" },
        { key: "customerId", value: "" },
        { key: "customerId2", value: "" },
        { key: "salesPersonId", value: "" },
        { key: "agentId", value: "" },
        { key: "paymentId", value: "" },
        { key: "demandLetterId", value: "" },
        { key: "siteVisitId", value: "" },
        { key: "followUpId", value: "" },
        { key: "cancellationId", value: "" },
        { key: "transferId", value: "" },
        { key: "possessionId", value: "" },
        { key: "snagId", value: "" },
        { key: "documentId", value: "" },
        { key: "nocDocumentId", value: "" },
        { key: "complaintId", value: "" },
        { key: "approvalId", value: "" },
        { key: "loanId", value: "" },
        { key: "idempotencyKey", value: "550e8400-e29b-41d4-a716-446655440001" },
        { key: "towerId", value: "" },
        { key: "communicationId", value: "" },
        { key: "receiptNumber", value: "" },
        { key: "bookingCode", value: "" }
    ],
    item: [
        ...folders00to05(),
        ...folders06to11(),
        ...folders12to17(),
        ...folders18to23()
    ]
};

const json = JSON.stringify(collection, null, 2);
writeFileSync('postman/LeadFlow-AI-Postman-Collection-v3.json', json);
const reqCount = collection.item.reduce((sum, f) => sum + (f.item ? f.item.length : 0), 0);
console.log(`✅ Collection saved: postman/LeadFlow-AI-Postman-Collection-v3.json`);
console.log(`📊 Total folders: ${collection.item.length}`);
console.log(`📊 Total requests: ${reqCount}`);
