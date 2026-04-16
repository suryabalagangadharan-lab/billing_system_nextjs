import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { createInvoice } from "../lib/services/billing.js";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) {
    console.error("No admin user found. Run scripts/create-admin.mjs first.");
    process.exit(1);
  }

  try {
    const invoice = await createInvoice({
      customerName: "Test Customer",
      customerPhone: "0000000000",
      customerEmail: null,
      billedById: admin.id,
      items: [
        {
          description: "Test service",
          quantity: 1,
          unitPrice: "100.00",
          gstRate: "18.00",
        },
      ],
    });

    console.log("Invoice created:", invoice.id, invoice.invoiceNumber);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
