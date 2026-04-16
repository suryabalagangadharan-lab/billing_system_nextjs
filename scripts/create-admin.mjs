import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/passwords.js";

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Administrator";

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    console.log(`User '${username}' already exists (id=${existing.id}).`);
    if (existing.role !== "admin") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
      console.log(`User role updated to 'admin'.`);
    }
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash,
      role: "admin",
    },
  });

  console.log(`Admin user created: ${user.username} (id=${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
