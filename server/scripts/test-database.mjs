// Disposable PostgreSQL cluster; never reads the development .env or connects to its DB.
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
const bin = process.env.PG_TEST_BIN ?? "/usr/lib/postgresql/18/bin";
const probe = createServer();
await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const work = await mkdtemp(join(tmpdir(), "vytor-test-postgres-"));
const data = join(work, "data");
const secret = randomBytes(24).toString("hex");
const passfile = join(work, "password");
await writeFile(passfile, secret, { mode: 0o600 });
async function run(command, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => output += chunk);
    child.stderr.on("data", (chunk) => output += chunk);
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? (console.log(output.replaceAll(secret, "[test-secret]")), resolve()) : reject(new Error(output.replaceAll(secret, "[test-secret]"))));
  });
}
let started = false;
try {
  await run(join(bin, "initdb"), ["-D", data, "-U", "vytor_test", "--auth-local=trust", "--auth-host=scram-sha-256", `--pwfile=${passfile}`]);
  await run(join(bin, "pg_ctl"), ["-D", data, "-l", join(work, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${work}`, "-w", "start"]);
  started = true;
  await run(join(bin, "createdb"), ["-h", work, "-p", String(port), "-U", "vytor_test", "vytor_security_test"]);
  const url = `postgresql://vytor_test:${secret}@127.0.0.1:${port}/vytor_security_test`;
  await run(process.execPath, ["scripts/integration.mjs"], { ...process.env, TEST_DATABASE_URL: url, DATABASE_URL: url, NODE_ENV: "test", TRUSTED_PROXY_IP: "" });
} finally {
  if (started) await run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"]);
  await rm(work, { recursive: true, force: true });
}
