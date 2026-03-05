import { registerOrganization, refreshTokens } from './src/modules/auth/auth.service.js';

async function run() {
    console.log("== REGISTER ==");
    const orgSuffix = Math.random().toString(36).substring(7);
    const { tokens } = await registerOrganization({
        orgName: 'Test Org ' + orgSuffix,
        orgSlug: `test-org-${orgSuffix}`,
        fullName: 'Test User',
        email: `admin-${orgSuffix}@example.com`,
        password: 'Password123!',
    });

    console.log("Registered. RT:", tokens.refreshToken);

    console.log("\n== CONCURRENT REFRESH ==");
    const [resTabA, resTabB] = await Promise.all([
        refreshTokens(tokens.refreshToken).catch(e => { console.error("A failed:", e); return null; }),
        refreshTokens(tokens.refreshToken).catch(e => { console.error("B failed:", e); return null; })
    ]);

    if (resTabA && resTabB) {
        console.log("Tab A accessToken:", resTabA.tokens.accessToken.substring(0, 20) + "...");
        console.log("Tab B accessToken:", resTabB.tokens.accessToken.substring(0, 20) + "...");
        console.log("Same token? ", resTabA.tokens.accessToken === resTabB.tokens.accessToken ? "YES ✅" : "NO ❌");
    }

    process.exit(0);
}

run();
