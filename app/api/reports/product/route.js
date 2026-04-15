import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, sumMoney } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const products = await prisma.product.findMany({
      include: {
        brand: true,
        purchases: {
          select: {
            quantity: true,
            totalCost: true,
          },
        },
        invoiceItems: {
          select: {
            quantity: true,
            total: true,
            profit: true,
          },
        },
        serviceItems: {
          select: {
            quantity: true,
            total: true,
            profit: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const report = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand?.name || null,
      currentStock: product.stock,
      purchasedQuantity: product.purchases.reduce((sum, entry) => sum + entry.quantity, 0),
      purchasedCost: sumMoney(product.purchases.map((entry) => entry.totalCost)).toFixed(2),
      soldQuantity: product.invoiceItems.reduce((sum, entry) => sum + entry.quantity, 0),
      salesRevenue: sumMoney(product.invoiceItems.map((entry) => entry.total)).toFixed(2),
      salesProfit: sumMoney(product.invoiceItems.map((entry) => entry.profit)).toFixed(2),
      serviceQuantity: product.serviceItems.reduce((sum, entry) => sum + entry.quantity, 0),
      serviceRevenue: sumMoney(product.serviceItems.map((entry) => entry.total)).toFixed(2),
      serviceProfit: sumMoney(product.serviceItems.map((entry) => entry.profit)).toFixed(2),
      totalProfit: (
        sumMoney(product.invoiceItems.map((entry) => entry.profit)) +
        sumMoney(product.serviceItems.map((entry) => entry.profit))
      ).toFixed(2),
    }));

    return NextResponse.json({ products: report });
  } catch (error) {
    return handleRouteError(error, "Unable to generate product report.");
  }
}
