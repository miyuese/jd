const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.project.findMany({
    select: {
      id: true,
      clerkUserId: true,
      name: true,
      targetRole: true,
      currentNeed: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
