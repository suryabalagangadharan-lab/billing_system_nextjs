import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const products = await prisma.product.findMany({
    where: { itemCode: null }
  });

  for (let i = 0; i < products.length; i++) {
    const code = `ITEM-${String(i + 1).padStart(4, "0")}`;

    await prisma.product.update({
      where: { id: products[i].id },
      data: { itemCode: code },
    });
  }

  console.log("✅ Item codes added");
}

run().finally(() => prisma.$disconnect());