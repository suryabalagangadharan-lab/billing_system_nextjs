import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/passwords.js";
import crypto from "crypto";

function generatePassword(len = 14) {
  return crypto.randomBytes(len).toString("base64").replace(/[^a-zA-Z0-9]/g, "A").slice(0, len);
}

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  let password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Administrator";

  if (!password) {
    password = generatePassword();
  }

  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, role: "admin", name } });
    console.log(`Updated password for existing user '${username}' (id=${existing.id}).`);
  } else {
    const user = await prisma.user.create({ data: { username, name, passwordHash, role: "admin" } });
    console.log(`Created admin user '${username}' (id=${user.id}).`);
  }

  console.log("CREDENTIALS:\nUsername: " + username + "\nPassword: " + password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
