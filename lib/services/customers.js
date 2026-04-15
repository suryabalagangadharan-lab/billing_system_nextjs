import { parseOptionalString, parseRequiredString } from "@/lib/api";

export async function findOrCreateCustomer(tx, input) {
  const name = parseRequiredString(input?.customerName, "Customer name");
  const phone = parseOptionalString(input?.customerPhone);
  const email = parseOptionalString(input?.customerEmail);

  let customer = null;

  if (phone) {
    customer = await tx.customer.findUnique({
      where: { phone },
    });
  }

  if (!customer && email) {
    customer = await tx.customer.findUnique({
      where: { email },
    });
  }

  if (customer) {
    return tx.customer.update({
      where: { id: customer.id },
      data: {
        name,
        phone,
        email,
      },
    });
  }

  return tx.customer.create({
    data: {
      name,
      phone,
      email,
    },
  });
}
