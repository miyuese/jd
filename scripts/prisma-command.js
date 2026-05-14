const { spawnSync } = require("node:child_process");
const path = require("node:path");

function sanitizeConnectionUrl(value) {
  if (!value) {
    return value;
  }

  return value.replace(/([?&])channel_binding=require(&?)/g, (match, prefix, suffix) => {
    if (prefix === "?" && suffix) {
      return "?";
    }

    if (!suffix) {
      return "";
    }

    return prefix;
  }).replace(/[?&]$/, "");
}

const rawArgs = process.argv.slice(2);
const usePooledDirectUrl = rawArgs[0] === "--use-pooled-direct-url";
const prismaArgs = usePooledDirectUrl ? rawArgs.slice(1) : rawArgs;

const env = { ...process.env };
env.DATABASE_URL = sanitizeConnectionUrl(env.DATABASE_URL);
env.DIRECT_URL = sanitizeConnectionUrl(usePooledDirectUrl ? env.DATABASE_URL : env.DIRECT_URL || env.DATABASE_URL);

const prismaBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);

const result = spawnSync(prismaBin, prismaArgs, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
