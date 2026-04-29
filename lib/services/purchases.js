import { prisma } from "@/lib/prisma";
import { ApiError, createReferenceCode, parseInteger, parseMoney, parseOptionalString, parseRequiredString } from "@/lib/api";

function toDate(value, fieldName) {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(`${fieldName} must be a valid date.`, 400);
  }

  return date;
}

function toDateStart(value, fieldName) {
  const date = toDate(value, fieldName);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateEnd(value, fieldName) {
  const date = toDate(value, fieldName);
  date.setHours(23, 59, 59, 999);
  return date;
}

function toNumber(value) {
  return Number(value || 0);
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function calculateLine(item) {
  const purchasePrice = toNumber(parseMoney(item.purchasePrice, "Purchase price", { min: 0 }));
  const discountAmount = toNumber(parseMoney(item.discountAmount ?? 0, "Discount amount", { min: 0 }));
  const gstRate = toNumber(parseMoney(item.gstRate ?? 0, "GST rate", { min: 0 }));
  const quantity = parseInteger(item.quantity, "Quantity", { min: 1 });

  if (discountAmount > purchasePrice) {
    throw new ApiError("Discount amount cannot exceed purchase price.", 400);
  }

  const taxableAmount = Math.max(purchasePrice - discountAmount, 0);
  const taxAmount = roundMoney(taxableAmount * (gstRate / 100));
  const lineBaseTotal = roundMoney((taxableAmount + taxAmount) * quantity);

  return {
    purchasePrice: roundMoney(purchasePrice),
    discountAmount: roundMoney(discountAmount),
    gstRate: roundMoney(gstRate),
    taxAmount: roundMoney(taxAmount),
    quantity,
    lineBaseTotal,
  };
}

function parsePurchaseItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new ApiError("At least one purchase item is required.", 400);
  }

  return items.map((item, index) => {
    const normalized = calculateLine(item);

    return {
      index,
      id: parseOptionalString(item?.id),
      productId: parseRequiredString(item?.productId, "Product ID"),
      note: parseOptionalString(item?.note),
      ...normalized,
    };
  });
}

function buildWhere({ search, supplier, from, to }) {
  const q = parseOptionalString(search);
  const supplierName = parseOptionalString(supplier);
  const where = {};
  const clauses = [];

  if (q) {
    clauses.push({
      OR: [
        { supplierName: { contains: q } },
        { referenceNo: { contains: q } },
        { warehouse: { contains: q } },
        { groupCode: { contains: q } },
      ],
    });
  }

  if (supplierName) {
    clauses.push({ supplierName: { contains: supplierName } });
  }

  if (from || to) {
    const range = {};

    if (from) {
      range.gte = toDateStart(from, "From date");
    }

    if (to) {
      range.lte = toDateEnd(to, "To date");
    }

    clauses.push({ purchaseDate: range });
  }

  if (clauses.length) {
    where.AND = clauses;
  }

  return where;
}

async function adjustProductStock(tx, { productId, delta, changedById, note, purchaseId }) {
  if (!delta) {
    return tx.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
  }

  const updatedProduct = await tx.product.update({
    where: { id: productId },
    data: {
      stock: delta > 0 ? { increment: delta } : { decrement: Math.abs(delta) },
    },
    select: {
      stock: true,
    },
  });

  await tx.stockLog.create({
    data: {
      productId,
      changedById,
      movementType: delta > 0 ? "purchase" : "adjustment",
      quantity: delta,
      balanceAfter: updatedProduct.stock,
      note,
      purchaseId,
    },
  });

  return updatedProduct;
}

async function loadPurchaseGroup(prismaClient, id) {
  return prismaClient.purchaseGroup.findUnique({
    where: { id },
    include: {
      purchases: {
        include: {
          product: {
            include: {
              brand: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      payments: {
        include: {
          paidBy: {
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
        },
      },
    },
  });
}

export async function listPurchaseGroups({ search, supplier, from, to, take = 10, skip = 0 } = {}) {
  return prisma.purchaseGroup.findMany({
    where: buildWhere({ search, supplier, from, to }),
    include: {
      purchases: {
        include: {
          product: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      payments: true,
    },
    orderBy: {
      purchaseDate: "desc",
    },
    take: Math.min(Math.max(Number(take) || 10, 1), 500),
    skip: Math.max(Number(skip) || 0, 0),
  });
}

export async function getPurchaseGroupById(id) {
  const purchaseGroupId = parseRequiredString(id, "Purchase group ID");
  const purchaseGroup = await loadPurchaseGroup(prisma, purchaseGroupId);

  if (!purchaseGroup) {
    throw new ApiError("Purchase not found.", 404);
  }

  return purchaseGroup;
}

export async function createPurchaseGroup(input) {
  const warehouse = parseRequiredString(input?.warehouse, "Warehouse");
  const supplierName = parseRequiredString(input?.supplierName, "Supplier name");
  const referenceNo = parseOptionalString(input?.referenceNo);
  const note = parseOptionalString(input?.note);
  const createdById = parseRequiredString(input?.createdById, "Created by ID");
  const purchaseDate = toDate(input?.purchaseDate, "Purchase date");
  const otherCharges = toNumber(parseMoney(input?.otherCharges ?? 0, "Other charges", { min: 0 }));
  const discountOnAll = toNumber(parseMoney(input?.discountOnAll ?? 0, "Discount on all", { min: 0 }));
  const roundOff = toNumber(parseMoney(input?.roundOff ?? 0, "Round off", { min: 0 }));
  const lineItems = parsePurchaseItems(input?.items);

  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + item.lineBaseTotal, 0));
  const adjustmentTotal = roundMoney(otherCharges - discountOnAll + roundOff);
  const grandTotal = roundMoney(subtotal + adjustmentTotal);
  const purchaseGroupCode = createReferenceCode("PRG");

  return prisma.$transaction(async (tx) => {
    const purchaseGroup = await tx.purchaseGroup.create({
      data: {
        groupCode: purchaseGroupCode,
        warehouse,
        supplierName,
        referenceNo,
        purchaseDate,
        subtotal,
        otherCharges,
        discountOnAll,
        roundOff,
        grandTotal,
        paidAmount: 0,
        dueAmount: grandTotal,
        note,
        status: "pending",
        createdById,
      },
    });

    for (const line of lineItems) {
      const product = await tx.product.findUnique({
        where: { id: line.productId },
        select: {
          id: true,
          name: true,
          stock: true,
        },
      });

      if (!product) {
        throw new ApiError(`Product not found for purchase item ${line.index + 1}.`, 404);
      }

      const adjustmentShare = subtotal > 0 ? roundMoney((adjustmentTotal * line.lineBaseTotal) / subtotal) : 0;
      const lineTotal = roundMoney(line.lineBaseTotal + adjustmentShare);
      const unitCost = roundMoney(lineTotal / line.quantity);

      const updatedProduct = await tx.product.update({
        where: { id: line.productId },
        data: {
          stock: {
            increment: line.quantity,
          },
        },
        select: {
          stock: true,
        },
      });

      const purchaseCode = `${purchaseGroupCode}-${String(line.index + 1).padStart(2, "0")}`;

      const purchase = await tx.purchase.create({
        data: {
          purchaseCode,
          productId: line.productId,
          quantity: line.quantity,
          purchasePrice: line.purchasePrice.toFixed(2),
          discountAmount: line.discountAmount.toFixed(2),
          taxAmount: line.taxAmount.toFixed(2),
          unitCost: unitCost.toFixed(2),
          totalCost: lineTotal.toFixed(2),
          supplierName,
          notes: line.note || note,
          purchasedById: createdById,
          purchaseGroupId: purchaseGroup.id,
        },
        include: {
          product: true,
        },
      });

      await tx.stockLog.create({
        data: {
          productId: line.productId,
          changedById: createdById,
          movementType: "purchase",
          quantity: line.quantity,
          balanceAfter: updatedProduct.stock,
          note: line.note || note || `IN: Stock increased from purchase ${purchaseGroupCode}.`,
          purchaseId: purchase.id,
        },
      });
    }

    return loadPurchaseGroup(tx, purchaseGroup.id);
  });
}

export async function updatePurchaseGroup(id, input) {
  const purchaseGroupId = parseRequiredString(id, "Purchase group ID");
  const warehouse = parseRequiredString(input?.warehouse, "Warehouse");
  const supplierName = parseRequiredString(input?.supplierName, "Supplier name");
  const referenceNo = parseOptionalString(input?.referenceNo);
  const note = parseOptionalString(input?.note);
  const purchaseDate = toDate(input?.purchaseDate, "Purchase date");
  const otherCharges = toNumber(parseMoney(input?.otherCharges ?? 0, "Other charges", { min: 0 }));
  const discountOnAll = toNumber(parseMoney(input?.discountOnAll ?? 0, "Discount on all", { min: 0 }));
  const roundOff = toNumber(parseMoney(input?.roundOff ?? 0, "Round off", { min: 0 }));
  const lineItems = parsePurchaseItems(input?.items);

  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + item.lineBaseTotal, 0));
  const adjustmentTotal = roundMoney(otherCharges - discountOnAll + roundOff);
  const grandTotal = roundMoney(subtotal + adjustmentTotal);

  return prisma.$transaction(async (tx) => {
    const existingPurchaseGroup = await tx.purchaseGroup.findUnique({
      where: { id: purchaseGroupId },
      include: {
        purchases: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!existingPurchaseGroup) {
      throw new ApiError("Purchase not found.", 404);
    }

    const paidAmount = Number(existingPurchaseGroup.paidAmount || 0);

    if (paidAmount > grandTotal) {
      throw new ApiError("Purchase total cannot be less than the amount already paid.", 400);
    }

    const existingPurchasesById = new Map(
      existingPurchaseGroup.purchases.map((purchase) => [purchase.id, purchase])
    );
    const desiredIds = new Set(lineItems.map((item) => item.id).filter(Boolean));

    for (const existingPurchase of existingPurchaseGroup.purchases) {
      if (desiredIds.has(existingPurchase.id)) {
        continue;
      }

      await adjustProductStock(tx, {
        productId: existingPurchase.productId,
        delta: -Number(existingPurchase.quantity),
        changedById: existingPurchaseGroup.createdById,
        note: `Purchase line removed from ${existingPurchaseGroup.groupCode}.`,
        purchaseId: existingPurchase.id,
      });

      await tx.purchase.delete({
        where: { id: existingPurchase.id },
      });
    }

    let nextLineNumber = existingPurchaseGroup.purchases.length;

    for (const line of lineItems) {
      const product = await tx.product.findUnique({
        where: { id: line.productId },
        select: {
          id: true,
          name: true,
          stock: true,
        },
      });

      if (!product) {
        throw new ApiError(`Product not found for purchase item ${line.index + 1}.`, 404);
      }

      const adjustmentShare = subtotal > 0 ? roundMoney((adjustmentTotal * line.lineBaseTotal) / subtotal) : 0;
      const lineTotal = roundMoney(line.lineBaseTotal + adjustmentShare);
      const unitCost = roundMoney(lineTotal / line.quantity);
      const existingPurchase = line.id ? existingPurchasesById.get(line.id) : null;

      if (existingPurchase) {
        if (existingPurchase.productId !== line.productId) {
          throw new ApiError("Editing a purchase line with a different product is not supported. Remove it and add a new line instead.", 400);
        }

        const deltaQty = line.quantity - Number(existingPurchase.quantity);

        if (deltaQty) {
          await adjustProductStock(tx, {
            productId: line.productId,
            delta: deltaQty,
            changedById: existingPurchaseGroup.createdById,
            note: `Purchase line updated in ${existingPurchaseGroup.groupCode}.`,
            purchaseId: existingPurchase.id,
          });
        }

        await tx.purchase.update({
          where: { id: existingPurchase.id },
          data: {
            quantity: line.quantity,
            purchasePrice: line.purchasePrice.toFixed(2),
            discountAmount: line.discountAmount.toFixed(2),
            taxAmount: line.taxAmount.toFixed(2),
            unitCost: unitCost.toFixed(2),
            totalCost: lineTotal.toFixed(2),
            supplierName,
            notes: line.note || note,
            purchasedById: existingPurchaseGroup.createdById,
            purchaseGroupId: existingPurchaseGroup.id,
          },
        });

        continue;
      }

      nextLineNumber += 1;
      const purchaseCode = `${existingPurchaseGroup.groupCode}-${String(nextLineNumber).padStart(2, "0")}`;
      const createdPurchase = await tx.purchase.create({
        data: {
          purchaseCode,
          productId: line.productId,
          quantity: line.quantity,
          purchasePrice: line.purchasePrice.toFixed(2),
          discountAmount: line.discountAmount.toFixed(2),
          taxAmount: line.taxAmount.toFixed(2),
          unitCost: unitCost.toFixed(2),
          totalCost: lineTotal.toFixed(2),
          supplierName,
          notes: line.note || note,
          purchasedById: existingPurchaseGroup.createdById,
          purchaseGroupId: existingPurchaseGroup.id,
        },
      });

      await adjustProductStock(tx, {
        productId: line.productId,
        delta: line.quantity,
        changedById: existingPurchaseGroup.createdById,
        note: line.note || note || `IN: Stock increased from purchase ${existingPurchaseGroup.groupCode}.`,
        purchaseId: createdPurchase.id,
      });
    }

    await tx.purchaseGroup.update({
      where: { id: existingPurchaseGroup.id },
      data: {
        warehouse,
        supplierName,
        referenceNo,
        purchaseDate,
        subtotal,
        otherCharges,
        discountOnAll,
        roundOff,
        grandTotal,
        paidAmount: paidAmount.toFixed(2),
        dueAmount: roundMoney(grandTotal - paidAmount).toFixed(2),
        note,
        status: grandTotal <= paidAmount ? "paid" : paidAmount > 0 ? "partial" : "pending",
      },
    });

    return loadPurchaseGroup(tx, existingPurchaseGroup.id);
  });
}

export async function addPurchasePayment(input) {
  const purchaseGroupId = parseRequiredString(input?.purchaseGroupId, "Purchase group ID");
  const amount = toNumber(parseMoney(input?.amount, "Amount", { min: 0.01 }));
  const paymentType = parseRequiredString(input?.paymentType, "Payment type");
  const account = parseOptionalString(input?.account);
  const note = parseOptionalString(input?.note);
  const paidById = parseRequiredString(input?.paidById, "Paid by ID");

  return prisma.$transaction(async (tx) => {
    const purchaseGroup = await tx.purchaseGroup.findUnique({
      where: { id: purchaseGroupId },
      select: {
        id: true,
        grandTotal: true,
        paidAmount: true,
        dueAmount: true,
        status: true,
      },
    });

    if (!purchaseGroup) {
      throw new ApiError("Purchase not found.", 404);
    }

    if (amount > Number(purchaseGroup.dueAmount)) {
      throw new ApiError("Payment amount cannot exceed the remaining due.", 400);
    }

    const nextPaidAmount = roundMoney(Number(purchaseGroup.paidAmount) + amount);
    const nextDueAmount = roundMoney(Number(purchaseGroup.grandTotal) - nextPaidAmount);
    const nextStatus = nextDueAmount <= 0 ? "paid" : nextPaidAmount > 0 ? "partial" : "pending";

    await tx.purchaseGroupPayment.create({
      data: {
        purchaseGroupId,
        amount: amount.toFixed(2),
        paymentType,
        account,
        note,
        paidById,
      },
    });

    await tx.purchaseGroup.update({
      where: { id: purchaseGroupId },
      data: {
        paidAmount: nextPaidAmount.toFixed(2),
        dueAmount: nextDueAmount.toFixed(2),
        status: nextStatus,
      },
    });

    return loadPurchaseGroup(tx, purchaseGroupId);
  });
}
