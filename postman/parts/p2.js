// Folders 06–11: Customers, Leads, Site Visits, Follow-Ups, Bookings, Payments
import { mkReq, statusTest, saveVar } from './helpers.js';

export function folders06to11() {
    return [
        // ── 06. Customers ────────────────────────────────────────────────
        {
            name: "06. Customers (incl. minor DOB, duplicate PAN)",
            item: [
                mkReq("Create Customer 1", "POST", "/v1/customers", {
                    desc: "Creates customer. Fields: fullName, fatherSpouse?, dateOfBirth?(ISO, refine: >=18yr), panNumber?(regex ABCDE1234F), aadhaarNumber?(12 digits), mobilePrimary(Indian), mobileAlternate?, email?, currentAddress?, occupation?, companyName?, annualIncome?, paymentMode?(self|loan|nri), preferredBank?, loanAmount?, coApplicantName?, coApplicantPan?, coApplicantRel?.",
                    body: {
                        fullName: "Priya Verma",
                        fatherSpouse: "Ramesh Verma",
                        dateOfBirth: "1990-06-15",
                        panNumber: "ABCDE1234F",
                        aadhaarNumber: "123456789012",
                        mobilePrimary: "9988776655",
                        email: "priya@example.com",
                        currentAddress: "402, Green Meadows, Kothrud, Pune 411038",
                        occupation: "Software Engineer",
                        companyName: "Infosys Ltd",
                        annualIncome: 1500000,
                        paymentMode: "loan",
                        preferredBank: "SBI",
                        loanAmount: 5000000
                    },
                    test: [statusTest(201), saveVar("customerId", ".data.id")].join("\n")
                }),
                mkReq("Create Customer 2 (for transfer)", "POST", "/v1/customers", {
                    desc: "Second customer for transfer testing.",
                    body: {
                        fullName: "Vikram Patel",
                        dateOfBirth: "1985-03-22",
                        panNumber: "FGHIJ5678K",
                        mobilePrimary: "9876501234",
                        email: "vikram@example.com",
                        currentAddress: "101, Blue Ridge, Wakad, Pune"
                    },
                    test: [statusTest(201), saveVar("customerId2", ".data.id")].join("\n")
                }),
                mkReq("Create Customer with Minor DOB → 400", "POST", "/v1/customers", {
                    desc: "BUSINESS RULE: Must be 18+. dateOfBirth refine rejects minors.",
                    body: {
                        fullName: "Underage Student",
                        dateOfBirth: "2015-01-01",
                        mobilePrimary: "9123456789",
                        currentAddress: "Test Address"
                    },
                    test: [statusTest(400), `pm.test("Minor rejected", () => { pm.expect(pm.response.json().error.message).to.include("validation"); });`].join("\n")
                }),
                mkReq("Create Customer with Duplicate PAN → isExisting:true", "POST", "/v1/customers", {
                    desc: "BUSINESS RULE: Duplicate PAN returns 200 with isExisting:true via find-or-create pattern (BKG-006). Response: data.isExisting=true.",
                    body: {
                        fullName: "Priya Verma Duplicate",
                        panNumber: "ABCDE1234F",
                        mobilePrimary: "9112233445"
                    },
                    test: [statusTest(200), `pm.test("Returns existing", () => { pm.expect(pm.response.json().data.isExisting).to.eql(true); });`].join("\n")
                }),
                mkReq("List Customers", "GET", "/v1/customers", { test: statusTest(200) }),
                mkReq("Get Customer by ID", "GET", "/v1/customers/{{customerId}}", { test: statusTest(200) }),
                mkReq("Update Customer", "PATCH", "/v1/customers/{{customerId}}", {
                    desc: "Partial update. PAN and Aadhaar excluded from update schema.",
                    body: { occupation: "Tech Lead", annualIncome: 2500000 },
                    test: statusTest(200)
                }),
                mkReq("Verify KYC", "PATCH", "/v1/customers/{{customerId}}/kyc", {
                    desc: "Fields: kycVerified(bool,required), remarks?. Requires PAN on file.",
                    body: { kycVerified: true, remarks: "PAN and Aadhaar verified" },
                    test: statusTest(200)
                })
            ]
        },

        // ── 07. Leads ────────────────────────────────────────────────────
        {
            name: "07. Leads",
            item: [
                mkReq("Create Lead", "POST", "/v1/leads", {
                    desc: "Fields: fullName, mobile(Indian), email?, source(enum: whatsapp,website,referral,walk_in default:walk_in), interestedProject?(uuid), interestedConfig?(BHK_1..Penthouse), budgetMin?, budgetMax?, assignedTo?(uuid), remarks?.",
                    body: {
                        fullName: "Sneha Reddy",
                        mobile: "7654321098",
                        email: "sneha@gmail.com",
                        source: "website",
                        interestedProject: "{{projectId}}",
                        interestedConfig: "BHK_2",
                        budgetMin: 5000000,
                        budgetMax: 8000000,
                        assignedTo: "{{salesPersonId}}",
                        remarks: "Found via Google Ads campaign"
                    },
                    test: [statusTest(201), saveVar("leadId", ".data.id")].join("\n")
                }),
                mkReq("List Leads", "GET", "/v1/leads", { test: statusTest(200) }),
                mkReq("Get Lead", "GET", "/v1/leads/{{leadId}}", { test: statusTest(200) }),
                mkReq("Update Lead", "PATCH", "/v1/leads/{{leadId}}", {
                    body: { score: 75, remarks: "Very interested after site visit" },
                    test: statusTest(200)
                }),
                mkReq("Update Lead Status", "PATCH", "/v1/leads/{{leadId}}/status", {
                    desc: "Enum: new,contacted,site_visit_scheduled,site_visit_done,interested,negotiation,won,lost,junk. Optional: remarks, lostReason, convertedBookingId.",
                    body: { status: "interested", remarks: "Good response to pricing" },
                    test: statusTest(200)
                })
            ]
        },

        // ── 08. Site Visits ──────────────────────────────────────────────
        {
            name: "08. Site Visits",
            item: [
                mkReq("Create Site Visit", "POST", "/v1/site-visits", {
                    desc: "Fields: leadId(uuid), projectId(uuid), salesPersonId?(uuid), visitDate(datetime), visitType(enum: first_visit,revisit,family_visit,loan_agent_visit default:first_visit), visitorCount(1-20 default:1), remarks?.",
                    body: {
                        leadId: "{{leadId}}",
                        projectId: "{{projectId}}",
                        salesPersonId: "{{salesPersonId}}",
                        visitDate: "2026-03-10T10:00:00.000Z",
                        visitType: "first_visit",
                        visitorCount: 3,
                        remarks: "Family visiting for first time"
                    },
                    test: [statusTest(201), saveVar("siteVisitId", ".data.id")].join("\n")
                }),
                mkReq("List Site Visits", "GET", "/v1/site-visits", { test: statusTest(200) }),
                mkReq("Update Site Visit", "PATCH", "/v1/site-visits/{{siteVisitId}}", {
                    desc: "Update fields: visitDate?, visitType?, visitorCount?, checkInAt?, checkOutAt?, feedback?(interested,thinking,not_interested,price_concern,location_concern), remarks?.",
                    body: {
                        checkInAt: "2026-03-10T10:15:00.000Z",
                        checkOutAt: "2026-03-10T11:30:00.000Z",
                        feedback: "interested",
                        remarks: "Very positive feedback"
                    },
                    test: statusTest(200)
                })
            ]
        },

        // ── 09. Follow-Up Tasks ──────────────────────────────────────────
        {
            name: "09. Follow-Up Tasks",
            item: [
                mkReq("Create Follow-Up", "POST", "/v1/follow-ups", {
                    desc: "Fields: leadId(uuid), assignedTo?(uuid), taskType(enum: call,whatsapp,email,meeting,site_visit default:call), priority(high,medium,low default:medium), scheduledAt(datetime), remarks?.",
                    body: {
                        leadId: "{{leadId}}",
                        assignedTo: "{{salesPersonId}}",
                        taskType: "call",
                        priority: "high",
                        scheduledAt: "2026-03-11T09:00:00.000Z",
                        remarks: "Follow up on site visit interest"
                    },
                    test: [statusTest(201), saveVar("followUpId", ".data.id")].join("\n")
                }),
                mkReq("List Follow-Ups", "GET", "/v1/follow-ups", { test: statusTest(200) }),
                mkReq("Update Follow-Up", "PATCH", "/v1/follow-ups/{{followUpId}}", {
                    desc: "Fields: taskType?, priority?, status?(pending,completed,missed,rescheduled), scheduledAt?, completedAt?, outcome?, remarks?.",
                    body: {
                        status: "completed",
                        completedAt: "2026-03-11T09:15:00.000Z",
                        outcome: "Customer confirmed booking intent"
                    },
                    test: statusTest(200)
                })
            ]
        },

        // ── 10. Bookings ─────────────────────────────────────────────────
        {
            name: "10. Bookings (incl. KYC gate, discount gate)",
            item: [
                mkReq("Create Booking", "POST", "/v1/bookings", {
                    desc: "Fields: unitId(uuid), customerId(uuid), salesPersonId(uuid), agentId?(uuid), tokenAmount(min0 default:0), discountAmount(min0 default:0), paymentMode(cheque,neft,rtgs,upi,dd,cash default:cheque), remarks?. Validates: unit blocked/token_received, KYC complete, no existing active booking. Response: data.booking.id/bookingCode/status, data.cascadeResults.",
                    body: {
                        unitId: "{{unitId}}",
                        customerId: "{{customerId}}",
                        salesPersonId: "{{salesPersonId}}",
                        agentId: "{{agentId}}",
                        tokenAmount: 50000,
                        discountAmount: 0,
                        paymentMode: "neft",
                        remarks: "Standard booking"
                    },
                    test: [
                        statusTest(201),
                        `let j = pm.response.json();`,
                        `pm.test("Save booking vars", () => {`,
                        `  pm.collectionVariables.set("bookingId", j.data.booking.id);`,
                        `  pm.collectionVariables.set("bookingCode", j.data.booking.bookingCode);`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Create Booking — KYC incomplete → 422", "POST", "/v1/bookings", {
                    desc: "BUSINESS RULE: Customer missing required KYC fields (fullName,dateOfBirth,mobilePrimary,email,currentAddress,panNumber) → 422 with missing field list.",
                    body: {
                        unitId: "{{unitId2}}",
                        customerId: "{{customerId2}}",
                        salesPersonId: "{{salesPersonId}}",
                        tokenAmount: 20000,
                        paymentMode: "cheque"
                    },
                    test: [statusTest(422), `pm.test("KYC error", () => { let j=pm.response.json(); pm.expect(j.error.message).to.include("KYC"); });`].join("\n")
                }),
                mkReq("List Bookings", "GET", "/v1/bookings", { test: statusTest(200) }),
                mkReq("Get Booking by ID", "GET", "/v1/bookings/{{bookingId}}", {
                    desc: "Returns booking with payments, commissions, demandLetters, paymentSchedules.",
                    test: statusTest(200)
                }),
                mkReq("Register Booking", "PATCH", "/v1/bookings/{{bookingId}}/register", {
                    desc: "Registers booking with registrationDate and registrationNumber. Status must be booked or possession_handed.",
                    body: {
                        registrationDate: "2026-03-20T00:00:00.000Z",
                        registrationNumber: "REG-2026-001",
                        remarks: "Registration completed"
                    },
                    test: [statusTest(200), `pm.test("Registered", () => { pm.expect(pm.response.json().data.status).to.eql("registered"); });`].join("\n")
                }),
                mkReq("Register Already-Registered → 422", "PATCH", "/v1/bookings/{{bookingId}}/register", {
                    desc: "BUSINESS RULE: Cannot re-register booking. Status is now 'registered' not in REGISTERABLE_STATUSES.",
                    body: { registrationDate: "2026-03-21T00:00:00.000Z", registrationNumber: "REG-DUP" },
                    test: statusTest(422)
                })
            ]
        },

        // ── 11. Payments ─────────────────────────────────────────────────
        {
            name: "11. Payments (incl. NEFT auto-clear, idempotency, bounce)",
            item: [
                mkReq("Record Payment (NEFT → auto-cleared)", "POST", "/v1/payments", {
                    desc: "Fields: bookingId(uuid), customerId(uuid), unitId(uuid), demandLetterId?(uuid), amount(positive), paymentMode(cheque,neft,rtgs,upi,dd,cash), transactionRef?, paymentDate(datetime), remarks?, idempotencyKey?(uuid). BUSINESS RULE: NEFT/RTGS/UPI auto-clear; cheque/dd = under_process.",
                    body: {
                        bookingId: "{{bookingId}}",
                        customerId: "{{customerId}}",
                        unitId: "{{unitId}}",
                        amount: 500000,
                        paymentMode: "neft",
                        transactionRef: "NEFT-REF-2026030501",
                        paymentDate: "2026-03-05T10:00:00.000Z",
                        remarks: "First installment via NEFT",
                        idempotencyKey: "{{idempotencyKey}}"
                    },
                    test: [
                        statusTest(201),
                        `let j = pm.response.json();`,
                        `pm.test("NEFT auto-cleared", () => { pm.expect(j.data.status).to.eql("cleared"); });`,
                        saveVar("paymentId", ".data.id"),
                        saveVar("receiptNumber", ".data.receiptNumber")
                    ].join("\n")
                }),
                mkReq("Record Payment (cheque → under_process)", "POST", "/v1/payments", {
                    desc: "BUSINESS RULE: Cheque payments start as under_process.",
                    body: {
                        bookingId: "{{bookingId}}",
                        customerId: "{{customerId}}",
                        unitId: "{{unitId}}",
                        amount: 200000,
                        paymentMode: "cheque",
                        transactionRef: "CHQ-123456",
                        paymentDate: "2026-03-05T12:00:00.000Z",
                        remarks: "Second installment via cheque"
                    },
                    test: [
                        statusTest(201),
                        `pm.test("Cheque under_process", () => { pm.expect(pm.response.json().data.status).to.eql("under_process"); });`
                    ].join("\n")
                }),
                mkReq("Idempotent Payment Retry → isDuplicate:true", "POST", "/v1/payments", {
                    desc: "BUSINESS RULE: Same idempotencyKey → returns existing payment with isDuplicate:true.",
                    body: {
                        bookingId: "{{bookingId}}",
                        customerId: "{{customerId}}",
                        unitId: "{{unitId}}",
                        amount: 500000,
                        paymentMode: "neft",
                        paymentDate: "2026-03-05T10:00:00.000Z",
                        idempotencyKey: "{{idempotencyKey}}"
                    },
                    test: [
                        statusTest(200),
                        `pm.test("Duplicate detected", () => { pm.expect(pm.response.json().data.isDuplicate).to.eql(true); });`
                    ].join("\n")
                }),
                mkReq("List Payments", "GET", "/v1/payments", { test: statusTest(200) }),
                mkReq("Update Payment Status (bounce)", "PATCH", "/v1/payments/{{paymentId}}/status", {
                    desc: "Fields: status(cleared,bounced,under_process,refund_pending,refunded), bounceReason?, bounceDate?, remarks?. Bounce triggers cascade (auto-complaint).",
                    body: {
                        status: "bounced",
                        bounceReason: "Insufficient funds",
                        bounceDate: "2026-03-07T00:00:00.000Z",
                        remarks: "Cheque bounced — insufficient funds"
                    },
                    test: statusTest(200)
                }),
                mkReq("Get Booking Payment Summary", "GET", "/v1/payments/booking/{{bookingId}}/summary", {
                    desc: "Returns payment summary: finalValue, totalCollected, clearedAmount, pendingAmount, collectionPct.",
                    test: statusTest(200)
                })
            ]
        }
    ];
}
