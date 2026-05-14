const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const { neonConfig } = require("@neondatabase/serverless");
const ws = require("ws");

function sanitizeConnectionUrl(value) {
  if (!value) {
    return value;
  }

  return value.replace(/([?&])channel_binding=require(&?)/g, (_match, prefix, suffix) => {
    if (prefix === "?" && suffix) {
      return "?";
    }

    if (!suffix) {
      return "";
    }

    return prefix;
  }).replace(/[?&]$/, "");
}

async function main() {
  neonConfig.webSocketConstructor = ws;

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({
      connectionString: sanitizeConnectionUrl(process.env.DIRECT_URL)
    })
  });

  try {
    const rows = await prisma.$queryRawUnsafe("select 1 as ok");
    console.log(JSON.stringify(rows));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
