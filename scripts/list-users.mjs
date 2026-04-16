import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true, name: true, role: true } });
  console.log("Users:");
  for (const u of users) {
    console.log(u);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
