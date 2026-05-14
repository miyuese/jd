const { spawnSync } = require("node:child_process");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

process.env.DIRECT_URL = process.env.DATABASE_URL;

const args = process.argv.slice(2);
const migrateArgs = ["prisma", "migrate", "dev", ...args];

const result = spawnSync("npx.cmd", migrateArgs, {
  stdio: "inherit",
  env: process.env,
  shell: false
});

process.exit(result.status ?? 1);
