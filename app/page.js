import HomeClient from "@/components/home-client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDayRange, getMonthRange, sumMoney } from "@/lib/api";

export const dynamic = "force-dynamic";

function formatDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function buildProductReport(products) {
  return products.map((product) => ({
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
}

export default async function Page() {
  await requireAuth();

  const { start: dayStart, end: dayEnd } = getDayRange();
  const { start: monthStart, end: monthEnd } = getMonthRange();

  const [
    dailyInvoices,
    dailyPurchases,
    dailyServiceJobs,
    monthlyInvoices,
    products,
    stockProducts,
    recentLogs,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        totalAmount: true,
        gstAmount: true,
        profitAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      select: {
        id: true,
        purchaseCode: true,
        totalCost: true,
        quantity: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceJob.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      select: {
        id: true,
        jobNumber: true,
        customerName: true,
        totalAmount: true,
        profitAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        totalAmount: true,
        gstAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
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
    }),
    prisma.product.findMany({
      include: {
        brand: true,
      },
      orderBy: {
        stock: "asc",
      },
    }),
    prisma.stockLog.findMany({
      take: 50,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        movementType: true,
        quantity: true,
        note: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        changedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    }),
  ]);

  const initialLive = {
    loading: false,
    error: "",
    daily: {
      summary: {
        invoiceCount: dailyInvoices.length,
        invoiceRevenue: sumMoney(dailyInvoices.map((invoice) => invoice.totalAmount)).toFixed(2),
        gstCollected: sumMoney(dailyInvoices.map((invoice) => invoice.gstAmount)).toFixed(2),
        profitAmount: sumMoney(dailyInvoices.map((invoice) => invoice.profitAmount)).toFixed(2),
        purchaseCount: dailyPurchases.length,
        purchaseSpend: sumMoney(dailyPurchases.map((purchase) => purchase.totalCost)).toFixed(2),
        serviceCount: dailyServiceJobs.length,
        serviceRevenue: sumMoney(dailyServiceJobs.map((job) => job.totalAmount)).toFixed(2),
        serviceProfit: sumMoney(dailyServiceJobs.map((job) => job.profitAmount)).toFixed(2),
        totalProfit: (
          sumMoney(dailyInvoices.map((invoice) => invoice.profitAmount)) +
          sumMoney(dailyServiceJobs.map((job) => job.profitAmount))
        ).toFixed(2),
      },
      invoices: dailyInvoices.map((invoice) => ({
        ...invoice,
        totalAmount: Number(invoice.totalAmount || 0).toFixed(2),
        gstAmount: Number(invoice.gstAmount || 0).toFixed(2),
        profitAmount: Number(invoice.profitAmount || 0).toFixed(2),
        createdAt: invoice.createdAt.toISOString(),
      })),
      purchases: dailyPurchases.map((purchase) => ({
        ...purchase,
        totalCost: Number(purchase.totalCost || 0).toFixed(2),
        createdAt: purchase.createdAt.toISOString(),
      })),
      serviceJobs: dailyServiceJobs.map((job) => ({
        ...job,
        totalAmount: Number(job.totalAmount || 0).toFixed(2),
        profitAmount: Number(job.profitAmount || 0).toFixed(2),
        createdAt: job.createdAt.toISOString(),
      })),
    },
    monthly: {
      summary: {
        invoiceCount: monthlyInvoices.length,
        totalInvoiceAmount: sumMoney(monthlyInvoices.map((invoice) => invoice.totalAmount)).toFixed(2),
        totalGst: sumMoney(monthlyInvoices.map((invoice) => invoice.gstAmount)).toFixed(2),
        totalCgst: sumMoney(monthlyInvoices.map((invoice) => Number(invoice.gstAmount || 0) / 2)).toFixed(2),
        totalSgst: sumMoney(monthlyInvoices.map((invoice) => Number(invoice.gstAmount || 0) / 2)).toFixed(2),
      },
      invoices: monthlyInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        finalTotal: Number(invoice.totalAmount || 0).toFixed(2),
        createdDate: formatDateLabel(invoice.createdAt),
        status: invoice.status,
        createdAt: invoice.createdAt.toISOString(),
      })),
    },
    product: {
      products: buildProductReport(products),
    },
    stock: {
      summary: {
        totalProducts: stockProducts.length,
        lowStockCount: stockProducts.filter((product) => product.stock <= 5).length,
        outOfStockCount: stockProducts.filter((product) => product.stock === 0).length,
      },
      products: stockProducts.map((product) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        brand: product.brand ? { name: product.brand.name } : null,
      })),
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        movementType: log.movementType,
        quantity: log.quantity,
        note: log.note,
        createdAt: log.createdAt.toISOString(),
        product: log.product,
        changedBy: log.changedBy,
      })),
    },
  };

  return <HomeClient initialLive={initialLive} />;
}
