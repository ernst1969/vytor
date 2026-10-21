import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { accountPasswordLimits, authLimits, canonicalIp, ipBucket, MemoryLimiter, proxyTrust, registrationAllowed, safeErrorRecord, RATE_LIMITS } from "./security.js";
import { createHash } from "node:crypto";

test("IP normalization groups mapped IPv4 and IPv6 privacy addresses", () => {
  assert.equal(canonicalIp("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(canonicalIp("::ffff:c000:201"), "192.0.2.1");
  assert.equal(ipBucket("2001:db8:abcd:12::1"), ipBucket("2001:0db8:abcd:0012:ffff::2"));
  assert.notEqual(ipBucket("2001:db8:abcd:13::1"), ipBucket("2001:db8:abcd:12::1"));
  assert.equal(canonicalIp("garbage"), "unknown");
  assert.throws(() => proxyTrust("172.30.50.0/24"));
  assert.equal(proxyTrust("172.30.50.2")("::ffff:172.30.50.2", 0), true);
  assert.equal(proxyTrust("172.30.50.2")("172.30.50.2", 1), false);
});
test("limiter expires, reports Retry-After, and never evicts active buckets", () => {
  let now = 0;
  const store = new MemoryLimiter(1, () => now);
  assert.equal(store.take("a", 1, 1000), 0);
  assert.equal(store.take("a", 1, 1000), 1);
  assert.equal(store.take("b", 1, 1000), 30);
  now = 1001;
  assert.equal(store.take("a", 1, 1000), 0);
});
test("logging drops messages, stack, database URL, passwords and tokens", () => {
  const result = JSON.stringify(safeErrorRecord("test", { code: "P2002", message: "postgresql://secret password token", stack: "secret", meta: { token: "secret" } }, "request-123"));
  assert.equal(result.includes("secret"), false);
  assert.deepEqual(JSON.parse(result), { event: "test", code: "P2002", requestId: "request-123" });
});
test("production registration is closed unless the configured invitation matches", () => {
  const hash = createHash("sha256").update("private-beta-code").digest("hex");
  assert.equal(registrationAllowed("production", undefined, "private-beta-code"), false);
  assert.equal(registrationAllowed("production", hash, "wrong"), false);
  assert.equal(registrationAllowed("production", hash, "private-beta-code"), true);
  assert.equal(registrationAllowed("test", undefined, undefined), true);
});
async function harness(trusted?: string) {
  const app = express();
  app.set("trust proxy", proxyTrust(trusted));
  app.use(express.json());
  app.use(authLimits());
  app.get("/ip", (req, res) => res.json({ ip: req.ip }));
  app.post("/api/login", (_req, res) => res.status(401).json({ error: "Invalid username or password" }));
  app.post("/api/users", (_req, res) => res.status(201).json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { base: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
test("untrusted peers cannot spoof client IP or evade login/registration limits", async () => {
  const h = await harness();
  try {
    const response: globalThis.Response = await fetch(h.base + "/ip", { headers: { "X-Forwarded-For": "203.0.113.8", Forwarded: "for=203.0.113.8" } });
    assert.equal((await response.json()).ip, "127.0.0.1");
    for (let i = 0; i < RATE_LIMITS.loginAccount.max; i++) {
      const response: globalThis.Response = await fetch(h.base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": `203.0.113.${i}` }, body: JSON.stringify({ username: i % 2 ? " TESTER " : "tester", password: "wrong" }) });
      assert.equal(response.status, 401);
    }
    const limited = await fetch(h.base + "/API/LOGIN/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "tester", password: "wrong" }) });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    for (let i = 0; i < RATE_LIMITS.register.max; i++) assert.equal((await fetch(h.base + "/api/users", { method: "POST", headers: { "X-Forwarded-For": `203.0.113.${i}` } })).status, 201);
    const registration = await fetch(h.base + "/api/users", { method: "POST" });
    assert.equal(registration.status, 429);
    assert.ok(Number(registration.headers.get("retry-after")) > 0);
    assert.deepEqual(await registration.json(), await limited.json());
  } finally { await h.close(); }
});
test("only configured proxy supplies IP; nearest untrusted hop wins", async () => {
  const h = await harness("127.0.0.1");
  try {
    const result = await fetch(h.base + "/ip", { headers: { "X-Forwarded-For": "198.51.100.9, 203.0.113.4" } });
    assert.equal((await result.json()).ip, "203.0.113.4");
    // Different client IPs still share the normalized account limit.
    for (let i = 0; i <= RATE_LIMITS.loginAccount.max; i++) {
      const response: globalThis.Response = await fetch(h.base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": `203.0.113.${i}` }, body: JSON.stringify({ username: "victim", password: "wrong" }) });
      assert.equal(response.status, i < RATE_LIMITS.loginAccount.max ? 401 : 429);
    }
  } finally { await h.close(); }
});

test("password checks share an account budget even across different client IPs", async () => {
  const app = express();
  app.set("trust proxy", proxyTrust("127.0.0.1"));
  app.use(express.json());
  app.use(authLimits());
  app.use("/api", (req, _res, next) => { Object.assign(req, { userId: 123 }); next(); }, accountPasswordLimits());
  app.put("/api/account/password", (_req, res) => res.status(403).json({ error: "Password is incorrect" }));
  app.delete("/api/account", (_req, res) => res.status(403).json({ error: "Password is incorrect" }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    for (let i = 0; i <= 10; i++) {
      const response: globalThis.Response = await fetch(`http://127.0.0.1:${address.port}/api/account${i % 2 ? "" : "/password"}`, { method: i % 2 ? "DELETE" : "PUT", headers: { "X-Forwarded-For": `203.0.113.${i}` } });
      assert.equal(response.status, i < 10 ? 403 : 429);
      if (i === 10) assert.ok(Number(response.headers.get("retry-after")) > 0);
    }
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
