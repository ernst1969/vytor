import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request, Response, NextFunction } from "express";

// Canonical IPv4 / IPv6; mapped IPv4 must share the IPv4 bucket.
export function canonicalIp(raw: string): string {
  const ip = raw.split("%")[0] ?? "";
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return "unknown";
  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = normalized.split("::");
  const a = left ? left.split(":") : [];
  const b = right ? right.split(":") : [];
  const words = right === undefined ? a : [...a, ...Array<string>(8 - a.length - b.length).fill("0"), ...b];
  const values = words.map((word) => parseInt(word, 16));
  if (values.slice(0, 5).every((n) => n === 0) && values[5] === 65535) {
    return [values[6]! >> 8, values[6]! & 255, values[7]! >> 8, values[7]! & 255].join(".");
  }
  return values.map((n) => n.toString(16).padStart(4, "0")).join(":");
}
export function ipBucket(ip: string): string {
  const canonical = canonicalIp(ip);
  // Group IPv6 privacy addresses within a /64 to prevent trivial rotation.
  return canonical.includes(":") ? canonical.split(":").slice(0, 4).join(":") + "::/64" : canonical;
}
export function proxyTrust(address?: string) {
  if (address && canonicalIp(address) === "unknown") throw new Error("TRUSTED_PROXY_IP must be one literal Caddy IP address");
  return (ip: string, hop: number) => Boolean(address) && hop === 0 && canonicalIp(ip) === canonicalIp(address!);
}

export function registrationAllowed(nodeEnv: string | undefined, expectedHash: string | undefined, suppliedCode: unknown) {
  if (nodeEnv !== "production") return true;
  if (!expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash) || typeof suppliedCode !== "string" || suppliedCode.length > 256) return false;
  const actual = createHash("sha256").update(suppliedCode).digest();
  return timingSafeEqual(actual, Buffer.from(expectedHash, "hex"));
}

export const RATE_LIMITS = {
  loginIp: { max: 60, windowMs: 15 * 60_000 },
  loginAccount: { max: 10, windowMs: 15 * 60_000 },
  register: { max: 20, windowMs: 60 * 60_000 },
  password: { max: 10, windowMs: 15 * 60_000 },
};
export class MemoryLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  private nextSweep = 0;
  constructor(private readonly capacity = 10_000, private readonly now = Date.now) {}
  take(key: string, max: number, windowMs: number): number {
    const now = this.now();
    if (now >= this.nextSweep) {
      for (const [id, entry] of this.entries) if (entry.until <= now) this.entries.delete(id);
      this.nextSweep = now + 30_000;
    }
    let entry = this.entries.get(key);
    if (!entry || entry.until <= now) {
      // Fail closed; never evict an active attack bucket to admit new identities.
      if (!entry && this.entries.size >= this.capacity) return 30;
      entry = { count: 0, until: now + windowMs };
      this.entries.set(key, entry);
    }
    if (entry.count >= max) return Math.max(1, Math.ceil((entry.until - now) / 1000));
    entry.count++;
    return 0;
  }
}
export function tooMany(res: Response, seconds: number) {
  res.set("Retry-After", String(Math.max(1, Math.ceil(seconds))));
  return res.status(429).json({ error: "Too many attempts. Please try again later.", code: "RATE_LIMITED" });
}
export const canonicalPath = (path: string) => path.toLowerCase().replace(/\/+$/, "");

export function authLimits(limiter = new MemoryLimiter()) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = canonicalPath(req.path);
    let policy: { max: number; windowMs: number } | undefined;
    let scope = "";
    if (req.method === "POST" && path === "/api/login") { policy = RATE_LIMITS.loginIp; scope = "login"; }
    if (req.method === "POST" && path === "/api/users") { policy = RATE_LIMITS.register; scope = "register"; }
    if ((req.method === "PUT" && path === "/api/account/password") || (req.method === "DELETE" && path === "/api/account")) { policy = RATE_LIMITS.password; scope = "password"; }
    if (!policy) return next();
    let retry = limiter.take(`${scope}:ip:${ipBucket(req.ip ?? req.socket.remoteAddress ?? "")}`, policy.max, policy.windowMs);
    if (scope === "login") {
      const name = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase().slice(0, 256) : "";
      const key = createHash("sha256").update(name).digest("hex");
      retry = Math.max(retry, limiter.take(`login:account:${key}`, RATE_LIMITS.loginAccount.max, RATE_LIMITS.loginAccount.windowMs));
    }
    if (retry) return tooMany(res, retry);
    next();
  };
}
export function accountPasswordLimits(limiter = new MemoryLimiter()) {
  return (req: Request & { userId?: number }, res: Response, next: NextFunction) => {
    const path = canonicalPath(req.path);
    if ((req.method === "PUT" && path === "/account/password") || (req.method === "DELETE" && path === "/account")) {
      const retry = limiter.take(`password:user:${req.userId}`, RATE_LIMITS.password.max, RATE_LIMITS.password.windowMs);
      if (retry) return tooMany(res, retry);
    }
    next();
  };
}

// Allowlisted metadata only: never serialize error.message, stack, meta, inputs or URL.
export function safeErrorRecord(event: string, error: unknown, requestId?: string) {
  const raw = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
  const code = typeof raw === "string" && /^(P\d{4}|[0-9A-Z]{5}|ECONNREFUSED|ETIMEDOUT)$/.test(raw) ? raw : "INTERNAL_ERROR";
  return { event, code, ...(requestId ? { requestId } : {}) };
}
export function logError(event: string, error: unknown, requestId?: string) {
  console.error(JSON.stringify(safeErrorRecord(event, error, requestId)));
}
export function requestIdentity(_req: Request, res: Response, next: NextFunction) {
  res.locals.requestId = randomUUID();
  res.set("X-Request-ID", res.locals.requestId);
  next();
}
