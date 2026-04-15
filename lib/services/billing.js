import { prisma } from "@/lib/prisma";
import {
  ApiError,
  createReferenceCode,
  parseInteger,
  parseMoney,
  parseOptionalString,
  parseRequiredString,
} from "@/lib/api";
import { findOrCreateCustomer } from "@/lib/services/customers";

function calculateLineTotal(unitPrice, quantity) {
  return (Number(unitPrice) * quantity).toFixed(2);
}

function resolveItemGstRate(itemRate, defaultRate) {
  if (itemRate !== undefined && itemRate !== null && itemRate !== "") {
    return parseMoney(itemRate, "Item GST rate", { min: 0 });
  }

  return defaultRate;
}

async function normalizeInvoiceItems(tx, items, defaultGstRate) {
  if (!Array.isArray(items) || !items.length) {
    throw new ApiError("At least one invoice item is required.", 400);
  }

  const normalizedItems = [];

  for (const item of items) {
    const quantity = parseInteger(item?.quantity, "Item quantity", { min: 1 });
    const productId = parseOptionalString(item?.productId);

    if (productId) {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          unitPrice: true,
          gstRate: true,
          costPrice: true,
          stock: true,
        },
      });

      if (!product) {
        throw new ApiError(`Product not found for item ${productId}.`, 404);
      }

      if (product.stock < quantity) {
        throw new ApiError(`Insufficient stock for product ${product.name}.`, 409);
      }

      const unitPrice = item?.unitPrice
        ? parseMoney(item.unitPrice, "Item unit price", { min: 0 })
        : Number(product.unitPrice).toFixed(2);
      const unitCost = Number(product.costPrice || 0).toFixed(2);
      const baseTotal = calculateLineTotal(unitPrice, quantity);
      const gstRate = resolveItemGstRate(item?.gstRate, Number(product.gstRate || 0).toFixed(2));

      normalizedItems.push({
        productId,
        description: parseOptionalString(item?.description) || product.name,
        quantity,
        unitCost,
        unitPrice,
        gstRate,
        baseTotal,
      });

      continue;
    }

    const description = parseRequiredString(item?.description, "Item description");
    const unitPrice = parseMoney(item?.unitPrice, "Item unit price", { min: 0 });
    const baseTotal = calculateLineTotal(unitPrice, quantity);
    const gstRate = resolveItemGstRate(item?.gstRate, defaultGstRate);

    normalizedItems.push({
      productId: null,
      description,
      quantity,
      unitCost: "0.00",
      unitPrice,
      gstRate,
      baseTotal,
    });
  }

  return normalizedItems;
}

export async function createInvoice(input) {
  const customerName = parseRequiredString(input?.customerName, "Customer name");
  const customerPhone = parseOptionalString(input?.customerPhone);
  const customerEmail = parseOptionalString(input?.customerEmail);
  const status = parseOptionalString(input?.status) || "issued";
  const billedById = parseRequiredString(input?.billedById, "Billed by ID");
  const defaultGstRate =
    input?.gstRate !== undefined && input?.gstRate !== null && input?.gstRate !== ""
      ? parseMoney(input.gstRate, "GST rate", { min: 0 })
      : "0.00";

  return prisma.$transaction(async (tx) => {
    const customer = await findOrCreateCustomer(tx, {
      customerName,
      customerPhone,
      customerEmail,
    });
    const normalizedItems = await normalizeInvoiceItems(tx, input?.items, defaultGstRate);
    const preparedItems = normalizedItems.map((item) => {
      const gstAmount = ((Number(item.baseTotal) * Number(item.gstRate)) / 100).toFixed(2);
      const total = (Number(item.baseTotal) + Number(gstAmount)).toFixed(2);
      const totalCost = (Number(item.unitCost) * item.quantity).toFixed(2);
      const profit = (Number(item.baseTotal) - Number(totalCost)).toFixed(2);

      return {
        ...item,
        gstAmount,
        totalCost,
        profit,
        total,
      };
    });
    const gstRates = new Set(preparedItems.map((item) => item.gstRate));
    const invoiceGstRate = gstRates.size === 1 ? preparedItems[0]?.gstRate || "0.00" : "0.00";
    const subtotal = preparedItems
      .reduce((sum, item) => sum + Number(item.baseTotal), 0)
      .toFixed(2);
    const gstAmount = preparedItems
      .reduce((sum, item) => sum + Number(item.gstAmount), 0)
      .toFixed(2);
    const taxAmount = gstAmount;
    const totalCost = preparedItems
      .reduce((sum, item) => sum + Number(item.totalCost), 0)
      .toFixed(2);
    const profitAmount = preparedItems
      .reduce((sum, item) => sum + Number(item.profit), 0)
      .toFixed(2);
    const totalAmount = (Number(subtotal) + Number(gstAmount)).toFixed(2);

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: createReferenceCode("INV"),
        customerId: customer.id,
        customerName,
        customerPhone,
        customerEmail,
        subtotal,
        gstRate: invoiceGstRate,
        gstAmount,
        taxAmount,
        totalCost,
        profitAmount,
        totalAmount,
        status,
        billedById,
        items: {
          create: preparedItems.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitCost: item.unitCost,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            gstAmount: item.gstAmount,
            profit: item.profit,
            total: item.total,
          })),
        },
      },
      include: {
        customer: true,
        billedBy: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
        items: true,
      },
    });

    for (const invoiceItem of invoice.items) {
      if (!invoiceItem.productId) {
        continue;
      }

      const updatedProduct = await tx.product.update({
        where: { id: invoiceItem.productId },
        data: {
          stock: {
            decrement: invoiceItem.quantity,
          },
        },
        select: {
          stock: true,
        },
      });

      await tx.stockLog.create({
        data: {
          productId: invoiceItem.productId,
          changedById: billedById,
          movementType: "sale",
          quantity: -invoiceItem.quantity,
          balanceAfter: updatedProduct.stock,
          note: `OUT: Stock reduced for invoice ${invoice.invoiceNumber}.`,
          invoiceItemId: invoiceItem.id,
        },
      });
    }

    return invoice;
  });
}
