// Folders 12–17: Demand Letters, Documents, Complaints, Communications, Approvals, Loans
import { mkReq, statusTest, saveVar } from './helpers.js';

export function folders12to17() {
    return [
        // ── 12. Demand Letters ───────────────────────────────────────────
        {
            name: "12. Demand Letters",
            item: [
                mkReq("Create Demand Letter", "POST", "/v1/demand-letters", {
                    desc: "Fields: bookingId(uuid), customerId(uuid), unitId(uuid), milestoneName(min2,max100), milestonePct(0-100), demandAmount(positive), dueDate(datetime).",
                    body: {
                        bookingId: "{{bookingId}}",
                        customerId: "{{customerId}}",
                        unitId: "{{unitId}}",
                        milestoneName: "Foundation Complete (20%)",
                        milestonePct: 20,
                        demandAmount: 1500000,
                        dueDate: "2026-04-15T00:00:00.000Z"
                    },
                    test: [statusTest(201), saveVar("demandLetterId", ".data.id")].join("\n")
                }),
                mkReq("List Demand Letters", "GET", "/v1/demand-letters", { test: statusTest(200) }),
                mkReq("Get Demand Letter", "GET", "/v1/demand-letters/{{demandLetterId}}", { test: statusTest(200) }),
                mkReq("Send Reminder", "POST", "/v1/demand-letters/{{demandLetterId}}/remind", {
                    desc: "Fields: reminderNote?(max500).",
                    body: { reminderNote: "Payment deadline approaching in 7 days" },
                    test: statusTest(200)
                })
            ]
        },

        // ── 13. Documents (S3 flow) ──────────────────────────────────────
        {
            name: "13. Documents (S3 flow: upload-url → confirm → download)",
            item: [
                mkReq("Get Upload URL (S3 presigned)", "POST", "/v1/documents/upload-url", {
                    desc: "Returns presigned S3 upload URL + creates pending document record. Body: customerId, category, fileName, contentType. Response: data.documentId, data.uploadUrl, data.fileKey.",
                    body: {
                        customerId: "{{customerId}}",
                        category: "pan_card",
                        fileName: "priya_pan_card.pdf",
                        contentType: "application/pdf"
                    },
                    test: [
                        statusTest(200),
                        `let j = pm.response.json();`,
                        `pm.test("Save documentId", () => {`,
                        `  pm.collectionVariables.set("documentId", j.data.documentId);`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Confirm Upload", "POST", "/v1/documents/{{documentId}}/confirm", {
                    desc: "Marks pending document as 'uploaded' after S3 PUT completes.",
                    test: [statusTest(200), `pm.test("Status uploaded", () => { pm.expect(pm.response.json().data.status).to.eql("uploaded"); });`].join("\n")
                }),
                mkReq("Download Document (confirmed)", "GET", "/v1/documents/{{documentId}}/download", {
                    desc: "Returns presigned S3 download URL. Only works for 'uploaded' or 'verified' documents.",
                    test: [statusTest(200), `pm.test("Has downloadUrl", () => { pm.expect(pm.response.json().data.downloadUrl).to.exist; });`].join("\n")
                }),
                mkReq("Upload via Schema (direct register)", "POST", "/v1/documents", {
                    desc: "Direct document registration. Fields: customerId(uuid), bookingId?(uuid), category(enum: pan_card,aadhaar,photo,address_proof,income_proof,bank_statement,agreement,registration,noc,allotment_letter,possession_letter,other), fileName, fileKey, fileSize(max 10MB), mimeType?, remarks?.",
                    body: {
                        customerId: "{{customerId}}",
                        bookingId: "{{bookingId}}",
                        category: "agreement",
                        fileName: "sale_agreement.pdf",
                        fileKey: "docs/skyline-dev/agreement_001.pdf",
                        fileSize: 524288,
                        mimeType: "application/pdf",
                        remarks: "Sale agreement copy"
                    },
                    test: statusTest(201)
                }),
                mkReq("Upload NOC Document (for transfer)", "POST", "/v1/documents", {
                    desc: "NOC document needed for transfer test.",
                    body: {
                        customerId: "{{customerId}}",
                        category: "noc",
                        fileName: "noc_transfer.pdf",
                        fileKey: "docs/skyline-dev/noc_001.pdf",
                        fileSize: 102400,
                        mimeType: "application/pdf"
                    },
                    test: [statusTest(201), saveVar("nocDocumentId", ".data.id")].join("\n")
                }),
                mkReq("List Documents", "GET", "/v1/documents", { test: statusTest(200) }),
                mkReq("Verify Document", "PATCH", "/v1/documents/{{documentId}}/verify", {
                    desc: "Fields: status(enum: verified,rejected), remarks?.",
                    body: { status: "verified", remarks: "Document verified successfully" },
                    test: statusTest(200)
                }),
                mkReq("Download Pending (unconfirmed) → 404", "GET", "/v1/documents/00000000-0000-0000-0000-000000000000/download", {
                    desc: "BUSINESS RULE: Download only works for uploaded/verified docs. Non-existent or pending → 404.",
                    test: statusTest(404)
                })
            ]
        },

        // ── 14. Complaints ───────────────────────────────────────────────
        {
            name: "14. Complaints",
            item: [
                mkReq("Create Complaint", "POST", "/v1/complaints", {
                    desc: "Fields: customerId(uuid), unitId?(uuid), bookingId?(uuid), category(payment,construction,documentation,general default:general), subject(min5,max200), description(min10,max2000), priority(high,medium,low default:medium).",
                    body: {
                        customerId: "{{customerId}}",
                        unitId: "{{unitId}}",
                        bookingId: "{{bookingId}}",
                        category: "construction",
                        subject: "Water leakage in master bedroom",
                        description: "Water seepage observed on the ceiling of master bedroom near AC duct area. Issue started after recent heavy rains.",
                        priority: "high"
                    },
                    test: [statusTest(201), saveVar("complaintId", ".data.id")].join("\n")
                }),
                mkReq("List Complaints", "GET", "/v1/complaints", { test: statusTest(200) }),
                mkReq("Get Complaint", "GET", "/v1/complaints/{{complaintId}}", { test: statusTest(200) }),
                mkReq("Update Complaint", "PATCH", "/v1/complaints/{{complaintId}}", {
                    desc: "Fields: assignedTo?(uuid), priority?(high,medium,low), remarks?.",
                    body: { assignedTo: "{{userId}}", priority: "high", remarks: "Escalating to maintenance team" },
                    test: statusTest(200)
                }),
                mkReq("Resolve Complaint", "POST", "/v1/complaints/{{complaintId}}/resolve", {
                    desc: "Fields: resolution(min10,max2000), remarks?.",
                    body: { resolution: "Fixed the water seepage by re-sealing the AC duct area and waterproofing treatment applied.", remarks: "Issue resolved within SLA" },
                    test: statusTest(200)
                }),
                mkReq("Escalate Complaint", "POST", "/v1/complaints/{{complaintId}}/escalate", {
                    desc: "Fields: remarks(min5,max500).",
                    body: { remarks: "Re-escalating — issue recurred after initial fix" },
                    test: statusTest(200)
                })
            ]
        },

        // ── 15. Communications ───────────────────────────────────────────
        {
            name: "15. Communications",
            item: [
                mkReq("Log Communication", "POST", "/v1/communications", {
                    desc: "Fields: customerId?(uuid), leadId?(uuid) — at least one required (refine). channel(call,email,whatsapp,sms,in_person default:call), direction(inbound,outbound default:outbound), subject?, content?, durationSeconds?.",
                    body: {
                        customerId: "{{customerId}}",
                        channel: "call",
                        direction: "outbound",
                        subject: "Payment reminder",
                        content: "Reminded customer about upcoming demand letter due date of April 15. Customer confirmed payment by April 10.",
                        durationSeconds: 180
                    },
                    test: statusTest(201)
                }),
                mkReq("Log Communication (lead)", "POST", "/v1/communications", {
                    body: {
                        leadId: "{{leadId}}",
                        channel: "whatsapp",
                        direction: "outbound",
                        subject: "Brochure shared",
                        content: "Shared project brochure and floor plans via WhatsApp"
                    },
                    test: statusTest(201)
                }),
                mkReq("List Communications", "GET", "/v1/communications", { test: statusTest(200) }),
                mkReq("Get Communication Summary", "GET", "/v1/communications/summary", { test: statusTest(200) })
            ]
        },

        // ── 16. Approvals ────────────────────────────────────────────────
        {
            name: "16. Approvals (incl. self-review rejection)",
            item: [
                mkReq("Create Approval Request", "POST", "/v1/approvals", {
                    desc: "Fields: requestType(cancellation,transfer,discount,refund,possession,other), entityType(min2,max100), entityId(uuid), justification(min10,max1000), requestData?(record).",
                    body: {
                        requestType: "discount",
                        entityType: "booking",
                        entityId: "{{bookingId}}",
                        justification: "Customer is a repeat buyer with referral. Requesting 3% discount on agreement value as loyalty benefit.",
                        requestData: { discountPct: 3, reason: "repeat_buyer" }
                    },
                    test: [statusTest(201), saveVar("approvalId", ".data.id")].join("\n")
                }),
                mkReq("List Approvals", "GET", "/v1/approvals", { test: statusTest(200) }),
                mkReq("Get Approval", "GET", "/v1/approvals/{{approvalId}}", { test: statusTest(200) }),
                mkReq("Get Pending Count", "GET", "/v1/approvals/pending/count", {
                    desc: "Returns pending approval counts by type for dashboard badges.",
                    test: statusTest(200)
                }),
                mkReq("Self-Review Approval → 422", "POST", "/v1/approvals/{{approvalId}}/review", {
                    desc: "BUSINESS RULE: Cannot review your own approval request. Requestor == reviewer → 422.",
                    body: { status: "approved", reviewRemarks: "Self-approving this request" },
                    test: [statusTest(422), `pm.test("Self-review blocked", () => { pm.expect(pm.response.json().error.message).to.include("own"); });`].join("\n")
                }),
                mkReq("Review Approval (approved)", "POST", "/v1/approvals/{{approvalId}}/review", {
                    desc: "Fields: status(approved,rejected), reviewRemarks(min5,max500). NOTE: This will succeed only if reviewer != requestor. May need a different user.",
                    body: { status: "approved", reviewRemarks: "Approved — valid justification for repeat buyer discount." },
                    test: statusTest(200)
                })
            ]
        },

        // ── 17. Loans ────────────────────────────────────────────────────
        {
            name: "17. Loans",
            item: [
                mkReq("Create Loan", "POST", "/v1/loans", {
                    desc: "Fields: bookingId(uuid), customerId(uuid), unitId(uuid), bankName(min2,max100), branchName?, loanAccountNumber?, sanctionedAmount(positive), interestRate(0-30), tenureMonths(12-360), emiAmount?, loanOfficer?, loanOfficerMobile?(Indian), remarks?.",
                    body: {
                        bookingId: "{{bookingId}}",
                        customerId: "{{customerId}}",
                        unitId: "{{unitId}}",
                        bankName: "State Bank of India",
                        branchName: "Pune Kothrud Branch",
                        loanAccountNumber: "SBI-HL-2026-001234",
                        sanctionedAmount: 5000000,
                        interestRate: 8.5,
                        tenureMonths: 240,
                        emiAmount: 43391,
                        loanOfficer: "Rahul Deshpande",
                        loanOfficerMobile: "9876012345",
                        remarks: "Home loan sanctioned"
                    },
                    test: [statusTest(201), saveVar("loanId", ".data.id")].join("\n")
                }),
                mkReq("List Loans", "GET", "/v1/loans", { test: statusTest(200) }),
                mkReq("Get Loan", "GET", "/v1/loans/{{loanId}}", { test: statusTest(200) }),
                mkReq("Update Loan", "PATCH", "/v1/loans/{{loanId}}", {
                    desc: "Fields: bankName?, branchName?, loanAccountNumber?, loanOfficer?, loanOfficerMobile?, remarks?.",
                    body: { loanOfficer: "Rahul D. (Senior)", remarks: "Officer changed" },
                    test: statusTest(200)
                }),
                mkReq("Record Disbursement", "POST", "/v1/loans/{{loanId}}/disbursement", {
                    desc: "Fields: amount(positive), disbursementDate(datetime), transactionRef?, remarks?.",
                    body: {
                        amount: 2500000,
                        disbursementDate: "2026-04-01T00:00:00.000Z",
                        transactionRef: "SBI-DISB-001",
                        remarks: "First tranche disbursement"
                    },
                    test: statusTest(201)
                }),
                mkReq("Update Loan Status", "PATCH", "/v1/loans/{{loanId}}/status", {
                    desc: "Fields: status(applied,sanctioned,disbursed,rejected,closed), remarks?.",
                    body: { status: "disbursed", remarks: "First tranche disbursed" },
                    test: statusTest(200)
                })
            ]
        }
    ];
}
