import { prisma } from "@/lib/prisma";
import {
  ApiError,
  createReferenceCode,
  optionalMoney,
  parseInteger,
  parseOptionalString,
  parseRequiredString,
} from "@/lib/api";
import { findOrCreateCustomer } from "@/lib/services/customers";

function calculateLineTotal(unitPrice, quantity) {
  return (Number(unitPrice) * quantity).toFixed(2);
}

async function normalizeServiceItems(tx, items) {
  const normalizedItems = [];

  for (const item of Array.isArray(items) ? items : []) {
    const quantity = parseInteger(item?.quantity, "Service item quantity", { min: 1 });
    const productId = parseOptionalString(item?.productId);

    if (productId) {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          unitPrice: true,
          costPrice: true,
          stock: true,
        },
      });

      if (!product) {
        throw new ApiError(`Product not found for service item ${productId}.`, 404);
      }

      if (product.stock < quantity) {
        throw new ApiError(`Insufficient stock for product ${product.name}.`, 409);
      }

      const unitPrice = item?.unitPrice
        ? optionalMoney(item.unitPrice, "Service item unit price", { min: 0 })
        : Number(product.unitPrice).toFixed(2);
      const unitCost = Number(product.costPrice || 0).toFixed(2);
      const total = calculateLineTotal(unitPrice, quantity);
      const profit = (Number(total) - Number(unitCost) * quantity).toFixed(2);

      normalizedItems.push({
        productId,
        description: parseOptionalString(item?.description) || product.name,
        quantity,
        unitCost,
        unitPrice,
        profit,
        total,
      });

      continue;
    }

    const description = parseRequiredString(item?.description, "Service item description");
    const unitPrice =
      optionalMoney(item?.unitPrice, "Service item unit price", { min: 0 }) || "0.00";
    const total = calculateLineTotal(unitPrice, quantity);

    normalizedItems.push({
      productId: null,
      description,
      quantity,
      unitCost: "0.00",
      unitPrice,
      profit: total,
      total,
    });
  }

  return normalizedItems;
}

export async function createServiceJob(input) {
  const customerName = parseRequiredString(input?.customerName, "Customer name");
  const customerPhone = parseOptionalString(input?.customerPhone);
  const deviceName = parseRequiredString(input?.deviceName, "Device name");
  const deviceModel = parseOptionalString(input?.deviceModel);
  const serialNumber = parseOptionalString(input?.serialNumber);
  const complaint = parseOptionalString(input?.complaint);
  const diagnosis = parseOptionalString(input?.diagnosis);
  const serviceCharge =
    optionalMoney(input?.serviceCharge, "Service charge", { min: 0 }) || "0.00";
  const status = parseOptionalString(input?.status) || "pending";
  const brandId = parseOptionalString(input?.brandId);
  const assignedToId = parseRequiredString(input?.assignedToId, "Assigned user ID");
  const createdById = parseRequiredString(input?.createdById, "Created by ID");

  return prisma.$transaction(async (tx) => {
    const customer = await findOrCreateCustomer(tx, {
      customerName,
      customerPhone,
      customerEmail: null,
    });

    if (brandId) {
      const brand = await tx.brand.findUnique({
        where: { id: brandId },
        select: { id: true },
      });

      if (!brand) {
        throw new ApiError("Brand not found.", 404);
      }
    }

    const assignee = await tx.user.findUnique({
      where: { id: assignedToId },
      select: { id: true },
    });

    if (!assignee) {
      throw new ApiError("Assigned user not found.", 404);
    }

    const normalizedItems = await normalizeServiceItems(tx, input?.items);
    const partsTotal = normalizedItems
      .reduce((sum, item) => sum + Number(item.total), 0)
      .toFixed(2);
    const partsCost = normalizedItems
      .reduce((sum, item) => sum + Number(item.unitCost) * item.quantity, 0)
      .toFixed(2);
    const partsProfit = normalizedItems
      .reduce((sum, item) => sum + Number(item.profit), 0)
      .toFixed(2);
    const totalCharge = (Number(partsTotal) + Number(serviceCharge)).toFixed(2);
    const profitAmount = (Number(partsProfit) + Number(serviceCharge)).toFixed(2);

    const serviceJob = await tx.serviceJob.create({
      data: {
        jobNumber: createReferenceCode("SRV"),
        customerId: customer.id,
        customerName,
        customerPhone,
        deviceName,
        deviceModel,
        serialNumber,
        complaint,
        diagnosis,
        serviceCharge,
        partsCost,
        profitAmount,
        totalAmount: totalCharge,
        status,
        brandId,
        assignedToId,
        items: {
          create: normalizedItems.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitCost: item.unitCost,
            unitPrice: item.unitPrice,
            profit: item.profit,
            total: item.total,
          })),
        },
      },
      include: {
        customer: true,
        brand: true,
        assignedTo: {
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

    for (const serviceItem of serviceJob.items) {
      if (!serviceItem.productId) {
        continue;
      }

      const updatedProduct = await tx.product.update({
        where: { id: serviceItem.productId },
        data: {
          stock: {
            decrement: serviceItem.quantity,
          },
        },
        select: {
          stock: true,
        },
      });

      await tx.stockLog.create({
        data: {
          productId: serviceItem.productId,
          changedById: createdById,
          movementType: "service_use",
          quantity: -serviceItem.quantity,
          balanceAfter: updatedProduct.stock,
          note: `OUT: Stock used for service job ${serviceJob.jobNumber}.`,
          serviceItemId: serviceItem.id,
        },
      });
    }

    return {
      ...serviceJob,
      summary: {
        partsTotal,
        partsCost,
        labourCharge: serviceCharge,
        profitAmount,
        totalCharge,
      },
    };
  });
}
