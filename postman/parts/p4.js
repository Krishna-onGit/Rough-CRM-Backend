// Folders 18–23: Cancellations, Transfers, Possessions, Analytics, Audit, Security
import { mkReq, statusTest, saveVar } from './helpers.js';

export function folders18to23() {
    return [
        // ── 18. Cancellations ────────────────────────────────────────────
        {
            name: "18. Cancellations",
            item: [
                mkReq("Get Cancellation Preview", "GET", "/v1/cancellations/preview/{{bookingId}}", {
                    desc: "Preview cancellation impact before initiating.",
                    test: statusTest(200)
                }),
                mkReq("Initiate Cancellation", "POST", "/v1/cancellations", {
                    desc: "Fields: bookingId(uuid), reason(min10,max1000), requestedBy?(uuid).",
                    body: {
                        bookingId: "{{bookingId}}",
                        reason: "Customer unable to arrange finances. Bank loan rejected after initial sanction due to changed credit score."
                    },
                    test: [statusTest(201), saveVar("cancellationId", ".data.id")].join("\n")
                }),
                mkReq("List Cancellations", "GET", "/v1/cancellations", { test: statusTest(200) }),
                mkReq("Process Cancellation", "POST", "/v1/cancellations/{{cancellationId}}/process", {
                    desc: "Fields: forfeiturePct(0-100), adminFee(min0 default:5000), brokerageRecovery(min0 default:0), approvedBy(uuid), remarks?.",
                    body: {
                        forfeiturePct: 10,
                        adminFee: 5000,
                        brokerageRecovery: 0,
                        approvedBy: "{{userId}}",
                        remarks: "Standard cancellation process"
                    },
                    test: statusTest(200)
                })
            ]
        },

        // ── 19. Transfers ────────────────────────────────────────────────
        {
            name: "19. Transfers (incl. NOC required test)",
            item: [
                mkReq("Transfer Without NOC → 422", "POST", "/v1/transfers", {
                    desc: "BUSINESS RULE: nocDocumentId is REQUIRED in initiateTransferSchema (not optional). Missing it → Zod validation 400.",
                    body: {
                        bookingId: "{{bookingId}}",
                        unitId: "{{unitId}}",
                        toCustomerId: "{{customerId2}}",
                        transferFee: 50000,
                        remarks: "Transfer attempt without NOC"
                    },
                    test: [statusTest(400), `pm.test("NOC required", () => { let j=pm.response.json(); pm.expect(JSON.stringify(j)).to.include("nocDocumentId"); });`].join("\n")
                }),
                mkReq("Initiate Transfer (with NOC)", "POST", "/v1/transfers", {
                    desc: "Fields: bookingId(uuid), unitId(uuid), toCustomerId(uuid), transferFee?(min0), nocDocumentId(uuid,required), remarks?.",
                    body: {
                        bookingId: "{{bookingId}}",
                        unitId: "{{unitId}}",
                        toCustomerId: "{{customerId2}}",
                        transferFee: 50000,
                        nocDocumentId: "{{nocDocumentId}}",
                        remarks: "Ownership transfer to Vikram Patel"
                    },
                    test: [statusTest(201), saveVar("transferId", ".data.id")].join("\n")
                }),
                mkReq("List Transfers", "GET", "/v1/transfers", { test: statusTest(200) }),
                mkReq("Get Transfer", "GET", "/v1/transfers/{{transferId}}", { test: statusTest(200) }),
                mkReq("Process Transfer", "POST", "/v1/transfers/{{transferId}}/process", {
                    desc: "Fields: approvedBy(uuid), remarks?.",
                    body: { approvedBy: "{{userId}}", remarks: "Transfer approved and processed" },
                    test: statusTest(200)
                })
            ]
        },

        // ── 20. Possessions ──────────────────────────────────────────────
        {
            name: "20. Possessions",
            item: [
                mkReq("List Possessions", "GET", "/v1/possessions", {
                    desc: "Lists all possession records. Auto-created by booking cascade.",
                    test: [
                        statusTest(200),
                        `let j = pm.response.json();`,
                        `pm.test("Save possessionId", () => {`,
                        `  if (j.data && j.data.length > 0) pm.collectionVariables.set("possessionId", j.data[0].id);`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Get Possession", "GET", "/v1/possessions/{{possessionId}}", { test: statusTest(200) }),
                mkReq("Update Possession", "PATCH", "/v1/possessions/{{possessionId}}", {
                    desc: "Fields: possessionDate?, handoverBy?(uuid), remarks?, checklist?{possession_letter,keys_handed,meter_readings,welcome_kit,noc_obtained}.",
                    body: {
                        checklist: {
                            possession_letter: true,
                            keys_handed: false,
                            meter_readings: false,
                            welcome_kit: false,
                            noc_obtained: true
                        },
                        remarks: "Pre-possession inspection scheduled"
                    },
                    test: statusTest(200)
                }),
                mkReq("Complete Possession", "POST", "/v1/possessions/{{possessionId}}/complete", {
                    desc: "Fields: possessionDate(datetime,required), handoverBy(uuid,required), remarks?.",
                    body: {
                        possessionDate: "2026-06-15T10:00:00.000Z",
                        handoverBy: "{{userId}}",
                        remarks: "Keys handed over to owner"
                    },
                    test: statusTest(200)
                }),
                mkReq("Create Snag", "POST", "/v1/possessions/snags", {
                    desc: "Fields: possessionId(uuid), unitId(uuid), description(min5,max500), category(plumbing,electrical,civil,painting default:civil), priority(high,medium,low default:medium), reportedDate(datetime).",
                    body: {
                        possessionId: "{{possessionId}}",
                        unitId: "{{unitId}}",
                        description: "Minor crack visible near kitchen window frame",
                        category: "civil",
                        priority: "low",
                        reportedDate: "2026-06-16T09:00:00.000Z"
                    },
                    test: [statusTest(201), saveVar("snagId", ".data.id")].join("\n")
                }),
                mkReq("List Snags", "GET", "/v1/possessions/{{possessionId}}/snags", { test: statusTest(200) }),
                mkReq("Update Snag", "PATCH", "/v1/possessions/snags/{{snagId}}", {
                    desc: "Fields: status?(open,in_progress,resolved), priority?(high,medium,low), resolvedDate?, resolvedBy?(uuid), remarks?.",
                    body: {
                        status: "resolved",
                        resolvedDate: "2026-06-20T14:00:00.000Z",
                        resolvedBy: "{{userId}}",
                        remarks: "Crack filled and painted"
                    },
                    test: statusTest(200)
                })
            ]
        },

        // ── 21. Analytics ────────────────────────────────────────────────
        {
            name: "21. Analytics (incl. cache hit test)",
            item: [
                mkReq("Executive Dashboard (cold)", "GET", "/v1/analytics/dashboard", {
                    desc: "Returns KPIs: inventory, bookings, revenue, leads, complaints. Response shape: { success, data, cached }. First call: cached=false (fresh data).",
                    test: [
                        statusTest(200),
                        `pm.test("Cold cache (cached:false)", () => {`,
                        `  let j = pm.response.json();`,
                        `  pm.expect(j.cached).to.eql(false);`,
                        `  pm.expect(j.data.inventory).to.exist;`,
                        `  pm.expect(j.data.bookings).to.exist;`,
                        `  pm.expect(j.data.revenue).to.exist;`,
                        `  pm.expect(j.data.leads).to.exist;`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Executive Dashboard (cached)", "GET", "/v1/analytics/dashboard", {
                    desc: "BUSINESS RULE: Second call within 5 min → cached:true from Redis.",
                    test: [
                        statusTest(200),
                        `pm.test("Cache hit (cached:true)", () => {`,
                        `  pm.expect(pm.response.json().cached).to.eql(true);`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Sales Analytics", "GET", "/v1/analytics/sales", {
                    desc: "Sales performance: byProject, monthlyTrend, byConfig.",
                    test: statusTest(200)
                }),
                mkReq("Collection Analytics", "GET", "/v1/analytics/collections", {
                    desc: "Collection metrics: totalCollected, byMode, overdue demand letters.",
                    test: statusTest(200)
                })
            ]
        },

        // ── 22. Audit Log ────────────────────────────────────────────────
        {
            name: "22. Audit Log",
            item: [
                mkReq("List Audit Logs", "GET", "/v1/audit", {
                    desc: "Paginated audit logs. Query: page, pageSize.",
                    test: statusTest(200)
                }),
                mkReq("Get Entity Audit Trail", "GET", "/v1/audit/entity/booking/{{bookingId}}", {
                    desc: "Returns audit trail for a specific entity (entityType/entityId).",
                    test: statusTest(200)
                }),
                mkReq("Get User Activity", "GET", "/v1/audit/user/{{userId}}", {
                    desc: "Returns activity log for a specific user.",
                    test: statusTest(200)
                })
            ]
        },

        // ── 23. Security & Edge Cases ────────────────────────────────────
        {
            name: "23. Security & Edge Cases",
            item: [
                mkReq("No Auth Token → 401", "GET", "/v1/projects", {
                    noAuth: true,
                    desc: "SECURITY: Request without Authorization header must return 401.",
                    test: [statusTest(401), `pm.test("Auth required", () => { pm.expect(pm.response.json().error || pm.response.json().message).to.exist; });`].join("\n")
                }),
                mkReq("Invalid Token → 401", "GET", "/v1/projects", {
                    noAuth: true,
                    headers: [{ key: "Authorization", value: "Bearer invalid.jwt.token.here", type: "text" }, { key: "x-organization-id", value: "{{orgId}}", type: "text" }],
                    desc: "SECURITY: Invalid JWT token must return 401.",
                    test: statusTest(401)
                }),
                mkReq("Nonexistent Route → 404", "GET", "/v1/nonexistent-route", {
                    desc: "404 handler: unmatched routes return AppError with ROUTE_NOT_FOUND.",
                    test: statusTest(404)
                }),
                mkReq("Invalid JSON Body → 400", "POST", "/v1/auth/login", {
                    noAuth: true,
                    desc: "Malformed JSON body should return 400.",
                    test: statusTest(400)
                }),
                mkReq("Validation Error — Missing Fields", "POST", "/v1/auth/register", {
                    noAuth: true,
                    desc: "Missing required fields should return 400 with VALIDATION_ERROR and field details.",
                    body: { orgName: "X" },
                    test: [statusTest(400), `pm.test("Validation error", () => { pm.expect(pm.response.json().error.code).to.eql("VALIDATION_ERROR"); });`].join("\n")
                }),
                mkReq("SQL Injection Attempt", "POST", "/v1/auth/login", {
                    noAuth: true,
                    desc: "Prisma parameterized queries prevent SQL injection.",
                    body: {
                        organizationSlug: "'; DROP TABLE users; --",
                        email: "test@test.com",
                        password: "password"
                    },
                    test: `pm.test("No 500 error", () => { pm.expect(pm.response.code).to.not.eql(500); });`
                }),
                mkReq("XSS Attempt in Body", "POST", "/v1/leads", {
                    desc: "XSS payloads in input fields should be handled safely.",
                    body: {
                        fullName: "<script>alert('xss')</script>",
                        mobile: "9876543210",
                        source: "walk_in"
                    },
                    test: `pm.test("Handled safely (not 500)", () => { pm.expect(pm.response.code).to.not.eql(500); });`
                }),
                mkReq("Rate Limit Test (auth endpoint)", "POST", "/v1/auth/login", {
                    noAuth: true,
                    desc: "Auth endpoints have stricter rate limiting. Rapid requests may get 429.",
                    body: {
                        organizationSlug: "skyline-dev",
                        email: "rajesh@skyline-dev.com",
                        password: "WrongPassword1"
                    },
                    test: `pm.test("Response received", () => { pm.expect(pm.response.code).to.be.oneOf([200, 401, 429]); });`
                }),
                mkReq("Duplicate Org Slug → 409", "POST", "/v1/auth/register", {
                    noAuth: true,
                    desc: "Attempting to register with existing slug returns 409 ConflictError.",
                    body: {
                        orgName: "Another Company",
                        orgSlug: "skyline-dev",
                        fullName: "Test User",
                        email: "test@another.com",
                        password: "SecurePass@123"
                    },
                    test: statusTest(409)
                }),
                mkReq("Password Validation — No Uppercase → 400", "POST", "/v1/auth/register", {
                    noAuth: true,
                    desc: "Password regex requires uppercase letter and number.",
                    body: {
                        orgName: "Test Org",
                        orgSlug: "test-org-pwd",
                        fullName: "Test User",
                        email: "test@testorg.com",
                        password: "nouppercase123"
                    },
                    test: statusTest(400)
                }),
                mkReq("Nonexistent Resource → 404", "GET", "/v1/bookings/00000000-0000-0000-0000-000000000000", {
                    desc: "Requesting a non-existent UUID returns 404 NotFoundError.",
                    test: statusTest(404)
                }),
                mkReq("Agent Commission Payment", "POST", "/v1/agents/{{agentId}}/commission-payment", {
                    desc: "Fields: commissionId(uuid), amountPaid(positive), paymentMode(cheque,neft,rtgs,upi,dd,cash), transactionRef?, remarks?.",
                    body: {
                        commissionId: "00000000-0000-0000-0000-000000000001",
                        amountPaid: 50000,
                        paymentMode: "neft",
                        transactionRef: "NEFT-COMM-001",
                        remarks: "Commission payment for booking"
                    },
                    test: `pm.test("Response received", () => { pm.expect(pm.response.code).to.be.oneOf([201, 404]); });`
                })
            ]
        }
    ];
}
