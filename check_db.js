const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const task = await prisma.task.findUnique({
    where: { id: "1769e1ee-ae42-4098-9b1f-74f2d79248a2" },
    select: { id: true, title: true, dueDate: true, startDate: true }
  });
  console.log("Task in DB:", task);
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
