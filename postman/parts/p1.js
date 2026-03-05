// Folders 00–05: Health, Auth, Projects, Units, Sales Team, Agents
import { mkReq, statusTest, saveVar } from './helpers.js';

export function folders00to05() {
    return [
        // ── 00. Health Check ──────────────────────────────────────────────
        {
            name: "00. Health Check",
            item: [
                mkReq("GET /health", "GET", "/health", {
                    noAuth: true,
                    desc: "Checks API, database, and Redis health. No auth required.",
                    test: [
                        statusTest(200),
                        `pm.test("Services reported", () => {`,
                        `  let j = pm.response.json();`,
                        `  pm.expect(j.status).to.be.oneOf(["ok","degraded"]);`,
                        `  pm.expect(j.services.database).to.exist;`,
                        `  pm.expect(j.services.redis).to.exist;`,
                        `});`
                    ].join("\n")
                }),
                mkReq("GET /v1 — API info", "GET", "/v1", {
                    noAuth: true,
                    desc: "Base API info endpoint.",
                    test: statusTest(200)
                })
            ]
        },

        // ── 01. Auth ──────────────────────────────────────────────────────
        {
            name: "01. Auth",
            item: [
                mkReq("Register Organization", "POST", "/v1/auth/register", {
                    noAuth: true,
                    desc: "Creates org + admin user. Fields: orgName, orgSlug, fullName, email, password. Response: data.organization, data.user, data.tokens.accessToken/refreshToken.",
                    body: {
                        orgName: "Skyline Developers Pvt Ltd",
                        orgSlug: "skyline-dev",
                        fullName: "Rajesh Kumar",
                        email: "rajesh@skyline-dev.com",
                        password: "SecurePass@123"
                    },
                    test: [
                        statusTest(201),
                        `let j = pm.response.json();`,
                        `pm.test("Save auth vars", () => {`,
                        `  pm.expect(j.data.tokens.accessToken).to.exist;`,
                        `  pm.collectionVariables.set("token", j.data.tokens.accessToken);`,
                        `  pm.collectionVariables.set("refreshToken", j.data.tokens.refreshToken);`,
                        `  pm.collectionVariables.set("orgId", j.data.organization.id);`,
                        `  pm.collectionVariables.set("userId", j.data.user.id);`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Login", "POST", "/v1/auth/login", {
                    noAuth: true,
                    desc: "Authenticates user. Fields: organizationSlug, email, password. Response: data.user, data.tokens.accessToken/refreshToken.",
                    body: {
                        organizationSlug: "skyline-dev",
                        email: "rajesh@skyline-dev.com",
                        password: "SecurePass@123"
                    },
                    test: [
                        statusTest(200),
                        `let j = pm.response.json();`,
                        `pm.test("Save tokens", () => {`,
                        `  pm.collectionVariables.set("token", j.data.tokens.accessToken);`,
                        `  pm.collectionVariables.set("refreshToken", j.data.tokens.refreshToken);`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Refresh Token", "POST", "/v1/auth/refresh", {
                    noAuth: true,
                    desc: "Exchanges refreshToken for new token pair. Response: data.tokens.accessToken/refreshToken.",
                    body: { refreshToken: "{{refreshToken}}" },
                    test: [
                        statusTest(200),
                        `let j = pm.response.json();`,
                        `pm.test("Save new tokens", () => {`,
                        `  pm.collectionVariables.set("token", j.data.tokens.accessToken);`,
                        `  pm.collectionVariables.set("refreshToken", j.data.tokens.refreshToken);`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Get Me (Profile)", "GET", "/v1/auth/me", {
                    desc: "Returns authenticated user profile with permissions.",
                    test: [
                        statusTest(200),
                        `pm.test("Has profile fields", () => {`,
                        `  let j = pm.response.json();`,
                        `  pm.expect(j.data.id).to.exist;`,
                        `  pm.expect(j.data.role).to.eql("admin");`,
                        `  pm.expect(j.data.permissions).to.be.an("array");`,
                        `  pm.expect(j.data.organization.id).to.exist;`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Logout", "POST", "/v1/auth/logout", {
                    desc: "Blacklists current access token. Response: data.message.",
                    test: statusTest(200)
                }),
                mkReq("Re-Login (after logout)", "POST", "/v1/auth/login", {
                    noAuth: true,
                    desc: "Re-login to get fresh tokens after logout test.",
                    body: {
                        organizationSlug: "skyline-dev",
                        email: "rajesh@skyline-dev.com",
                        password: "SecurePass@123"
                    },
                    test: [
                        statusTest(200),
                        `let j = pm.response.json();`,
                        `pm.collectionVariables.set("token", j.data.tokens.accessToken);`,
                        `pm.collectionVariables.set("refreshToken", j.data.tokens.refreshToken);`
                    ].join("\n")
                })
            ]
        },

        // ── 02. Projects ─────────────────────────────────────────────────
        {
            name: "02. Projects",
            item: [
                mkReq("Create Project", "POST", "/v1/projects", {
                    desc: "Creates project with towers. Fields: projectCode, name, city, location?, projectType(enum), baseRate, reraNumber?, settings{}, towers[{name,floors,unitsPerFloor}].",
                    body: {
                        projectCode: "SKY-001",
                        name: "Skyline Heights",
                        city: "Pune",
                        location: "Hinjewadi Phase 3",
                        projectType: "Residential",
                        baseRate: 7500,
                        reraNumber: "RERA-MH-2024-001",
                        settings: {
                            floorRise: { startFloor: 5, risePerFloor: 50 },
                            plc: { park_facing: 200, corner: 150 },
                            stampDutyRate: 6
                        },
                        towers: [
                            { name: "Tower A", floors: 15, unitsPerFloor: 4 },
                            { name: "Tower B", floors: 12, unitsPerFloor: 6 }
                        ]
                    },
                    test: [
                        statusTest(201),
                        saveVar("projectId", ".data.id")
                    ].join("\n")
                }),
                mkReq("List Projects", "GET", "/v1/projects", {
                    desc: "Paginated list of projects.",
                    test: [
                        statusTest(200),
                        `pm.test("Has pagination", () => {`,
                        `  let j = pm.response.json();`,
                        `  pm.expect(j.meta.total).to.be.a("number");`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Get Project by ID", "GET", "/v1/projects/{{projectId}}", {
                    desc: "Single project detail.",
                    test: statusTest(200)
                }),
                mkReq("Update Project", "PATCH", "/v1/projects/{{projectId}}", {
                    desc: "Updates project. All fields optional: name, city, location, baseRate, reraNumber, completionPct, settings.",
                    body: { completionPct: 25, baseRate: 7800 },
                    test: statusTest(200)
                }),
                mkReq("Update Project Status", "PATCH", "/v1/projects/{{projectId}}/status", {
                    desc: "Update project status. Enum: active, pre_launch, completed.",
                    body: { status: "active" },
                    test: statusTest(200)
                }),
                mkReq("List Towers", "GET", "/v1/projects/{{projectId}}/towers", {
                    desc: "Lists towers for a project.",
                    test: [
                        statusTest(200),
                        `let j = pm.response.json();`,
                        `pm.test("Save towerId", () => {`,
                        `  if (j.data && j.data.length > 0) pm.collectionVariables.set("towerId", j.data[0].id);`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Add Towers", "POST", "/v1/projects/{{projectId}}/towers", {
                    desc: "Adds towers to existing project. Fields: towers[{name, floors, unitsPerFloor}].",
                    body: {
                        towers: [{ name: "Tower C", floors: 10, unitsPerFloor: 4 }]
                    },
                    test: statusTest(201)
                }),
                mkReq("Get Project Unit Stats", "GET", "/v1/projects/{{projectId}}/units/stats", {
                    desc: "Unit statistics for a project (available/blocked/booked counts).",
                    test: statusTest(200)
                })
            ]
        },

        // ── 03. Units ────────────────────────────────────────────────────
        {
            name: "03. Units (incl. 3-block limit test)",
            item: [
                mkReq("List Units", "GET", "/v1/units?projectId={{projectId}}", {
                    desc: "Paginated unit list with optional filters: projectId, towerId, status, config, floor, search.",
                    test: [
                        statusTest(200),
                        `let j = pm.response.json();`,
                        `pm.test("Save unit IDs", () => {`,
                        `  if (j.data && j.data.length >= 4) {`,
                        `    pm.collectionVariables.set("unitId", j.data[0].id);`,
                        `    pm.collectionVariables.set("unitId2", j.data[1].id);`,
                        `    pm.collectionVariables.set("unitId3", j.data[2].id);`,
                        `    pm.collectionVariables.set("unitId4", j.data[3].id);`,
                        `  } else if (j.data && j.data.length >= 1) {`,
                        `    pm.collectionVariables.set("unitId", j.data[0].id);`,
                        `  }`,
                        `});`
                    ].join("\n")
                }),
                mkReq("Get Unit by ID", "GET", "/v1/units/{{unitId}}", {
                    desc: "Single unit detail with cost sheet. Includes lazy expiry check.",
                    test: statusTest(200)
                }),
                mkReq("Get Cost Sheet", "GET", "/v1/units/{{unitId}}/cost-sheet", {
                    desc: "Returns detailed cost breakdown for a unit.",
                    test: statusTest(200)
                }),
                mkReq("Block Unit 1 (SP block)", "POST", "/v1/units/{{unitId}}/block", {
                    desc: "Blocks a unit for a sales person. Fields: salesPersonId(uuid,required), agentId?(uuid), remarks?(max500).",
                    body: { salesPersonId: "{{salesPersonId}}", remarks: "Client showed interest during site visit" },
                    test: [statusTest(200), `pm.test("Status blocked", () => { pm.expect(pm.response.json().data.status).to.eql("blocked"); });`].join("\n")
                }),
                mkReq("Block Unit 2", "POST", "/v1/units/{{unitId2}}/block", {
                    desc: "Block second unit — same SP.",
                    body: { salesPersonId: "{{salesPersonId}}" },
                    test: statusTest(200)
                }),
                mkReq("Block Unit 3", "POST", "/v1/units/{{unitId3}}/block", {
                    desc: "Block third unit — same SP (3-block limit).",
                    body: { salesPersonId: "{{salesPersonId}}" },
                    test: statusTest(200)
                }),
                mkReq("Block Unit 4 → 422 (3-block limit)", "POST", "/v1/units/{{unitId4}}/block", {
                    desc: "BUSINESS RULE: 4th block by same SP must return 422. Max 3 active blocks per SP enforced via Redis atomic counter.",
                    body: { salesPersonId: "{{salesPersonId}}" },
                    test: [statusTest(422), `pm.test("Block limit error", () => { pm.expect(pm.response.json().error.message).to.include("maximum"); });`].join("\n")
                }),
                mkReq("Release Unit 2", "POST", "/v1/units/{{unitId2}}/release", {
                    desc: "Releases a blocked unit back to available.",
                    test: statusTest(200)
                }),
                mkReq("Release Unit 3", "POST", "/v1/units/{{unitId3}}/release", {
                    desc: "Releases a blocked unit back to available.",
                    test: statusTest(200)
                }),
                mkReq("Record Token on Unit 1", "POST", "/v1/units/{{unitId}}/token", {
                    desc: "Records token payment. Fields: tokenAmount(positive), paymentMode(enum: cheque,neft,rtgs,upi,dd,cash), transactionRef?, remarks?.",
                    body: { tokenAmount: 50000, paymentMode: "upi", transactionRef: "UPI-TXN-98765", remarks: "Token via UPI" },
                    test: [statusTest(200), `pm.test("Token received", () => { pm.expect(pm.response.json().data.status).to.eql("token_received"); });`].join("\n")
                })
            ]
        },

        // ── 04. Sales Team ───────────────────────────────────────────────
        {
            name: "04. Sales Team",
            item: [
                mkReq("Create Sales Person", "POST", "/v1/sales-team", {
                    desc: "Creates sales person. Fields: spCode(uppercase), fullName, mobile(Indian), email?, team?, designation(enum: VP_Sales,Manager,Executive,Trainee, default:Executive), reportingTo?(uuid), monthlyTarget(default:0).",
                    body: {
                        spCode: "SP-001",
                        fullName: "Amit Sharma",
                        mobile: "9876543210",
                        email: "amit@skyline-dev.com",
                        team: "South Pune",
                        designation: "Manager",
                        monthlyTarget: 5000000
                    },
                    test: [
                        statusTest(201),
                        saveVar("salesPersonId", ".data.id")
                    ].join("\n")
                }),
                mkReq("List Sales Team", "GET", "/v1/sales-team", {
                    desc: "Lists all sales persons with pagination.",
                    test: statusTest(200)
                }),
                mkReq("Get Sales Person", "GET", "/v1/sales-team/{{salesPersonId}}", {
                    desc: "Single sales person detail.",
                    test: statusTest(200)
                }),
                mkReq("Update Sales Person", "PATCH", "/v1/sales-team/{{salesPersonId}}", {
                    desc: "Updates sales person. All fields optional: fullName, mobile, email, team, designation, reportingTo, monthlyTarget, isActive.",
                    body: { monthlyTarget: 7500000, designation: "VP_Sales" },
                    test: statusTest(200)
                }),
                mkReq("Get Team Performance", "GET", "/v1/sales-team/performance", {
                    desc: "Sales team performance metrics.",
                    test: statusTest(200)
                })
            ]
        },

        // ── 05. Agents ───────────────────────────────────────────────────
        {
            name: "05. Agents",
            item: [
                mkReq("Create Agent", "POST", "/v1/agents", {
                    desc: "Creates channel partner (agent). Fields: agentCode(uppercase), firmName?, contactPerson, mobile(Indian), email?, reraNumber(min5), pan?(ABCDE1234F), gstNumber?, commissionPct(0-10, default:2).",
                    body: {
                        agentCode: "AGT-001",
                        firmName: "Prime Realty Advisors",
                        contactPerson: "Suresh Mehta",
                        mobile: "8765432109",
                        email: "suresh@primerealty.in",
                        reraNumber: "RERA-MH-AGT-2024-100",
                        pan: "BMPPS1234K",
                        commissionPct: 2.5
                    },
                    test: [
                        statusTest(201),
                        saveVar("agentId", ".data.id")
                    ].join("\n")
                }),
                mkReq("List Agents", "GET", "/v1/agents", { test: statusTest(200) }),
                mkReq("Get Agent", "GET", "/v1/agents/{{agentId}}", { test: statusTest(200) }),
                mkReq("Update Agent", "PATCH", "/v1/agents/{{agentId}}", {
                    body: { commissionPct: 3, firmName: "Prime Realty Advisors LLP" },
                    test: statusTest(200)
                }),
                mkReq("Rate Agent", "PATCH", "/v1/agents/{{agentId}}/rating", {
                    desc: "Rate an agent (1-5 stars).",
                    body: { rating: 4 },
                    test: statusTest(200)
                })
            ]
        }
    ];
}
