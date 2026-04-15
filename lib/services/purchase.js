import { prisma } from "@/lib/prisma";
import {
  ApiError,
  createReferenceCode,
  parseInteger,
  parseMoney,
  parseOptionalString,
  parseRequiredString,
} from "@/lib/api";

export async function createPurchase(input) {
  const productId = parseRequiredString(input?.productId, "Product ID");
  const quantity = parseInteger(input?.quantity, "Quantity", { min: 1 });
  const unitCost = parseMoney(input?.unitCost, "Unit cost", { min: 0 });
  const supplierName = parseOptionalString(input?.supplierName);
  const notes = parseOptionalString(input?.notes);
  const purchasedById = parseRequiredString(input?.purchasedById, "Purchased by ID");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new ApiError("Product not found.", 404);
    }

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        stock: {
          increment: quantity,
        },
      },
      select: {
        stock: true,
      },
    });

    const purchase = await tx.purchase.create({
      data: {
        purchaseCode: createReferenceCode("PUR"),
        productId,
        quantity,
        unitCost,
        totalCost: (Number(unitCost) * quantity).toFixed(2),
        supplierName,
        notes,
        purchasedById,
      },
      include: {
        product: true,
        purchasedBy: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
      },
    });

    await tx.stockLog.create({
      data: {
        productId,
        changedById: purchasedById,
        movementType: "purchase",
        quantity,
        balanceAfter: updatedProduct.stock,
        note: notes || `IN: Stock increased from purchase ${purchase.purchaseCode}.`,
        purchaseId: purchase.id,
      },
    });

    return purchase;
  });
}
