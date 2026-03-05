// Shared helpers for building Postman request objects
export const AUTH_HEADER = { key: "Authorization", value: "Bearer {{token}}", type: "text" };
export const JSON_HEADER = { key: "Content-Type", value: "application/json", type: "text" };
export const ORG_HEADER = { key: "x-organization-id", value: "{{orgId}}", type: "text" };

export function mkReq(name, method, path, opts = {}) {
    const { body, test, desc, noAuth, headers: extraHeaders } = opts;
    const h = [JSON_HEADER];
    if (!noAuth) { h.push(AUTH_HEADER); h.push(ORG_HEADER); }
    if (extraHeaders) h.push(...extraHeaders);
    const req = {
        name,
        request: {
            method,
            header: h,
            url: { raw: `{{baseUrl}}${path}`, host: ["{{baseUrl}}"], path: path.split("/").filter(Boolean) }
        },
        response: []
    };
    if (desc) req.request.description = desc;
    if (body) {
        req.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2), options: { raw: { language: "json" } } };
    }
    if (test) {
        req.event = [{ listen: "test", script: { type: "text/javascript", exec: Array.isArray(test) ? test : test.split("\n") } }];
    }
    return req;
}

export function statusTest(code) {
    return `pm.test("Status ${code}", () => pm.response.to.have.status(${code}));`;
}

export function saveVar(varName, jsonPath) {
    return `let j = pm.response.json();\npm.test("Save ${varName}", () => {\n  pm.expect(j${jsonPath}).to.exist;\n  pm.collectionVariables.set("${varName}", j${jsonPath});\n});`;
}
