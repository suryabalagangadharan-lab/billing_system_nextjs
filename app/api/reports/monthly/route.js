import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { getMonthRange, handleRouteError, sumMoney } from "@/lib/api";
import { createWorkbookBuffer } from "@/lib/excel";
import { reportQuerySchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = reportQuerySchema.parse({
      month: searchParams.get("month") ?? undefined,
    });
    const format = (searchParams.get("format") || "").toLowerCase();
    const month = query.month;
    const { start, end } = getMonthRange(month);

    const [invoices, purchases, serviceJobs] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        select: {
          gstAmount: true,
          profitAmount: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      prisma.purchase.findMany({
        where: {
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        select: {
          totalCost: true,
          createdAt: true,
        },
      }),
      prisma.serviceJob.findMany({
        where: {
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        select: {
          totalAmount: true,
          profitAmount: true,
          createdAt: true,
        },
      }),
    ]);

    const breakdownMap = new Map();

    for (const invoice of invoices) {
      const key = invoice.createdAt.toISOString().slice(0, 10);
      const row = breakdownMap.get(key) || {
        date: key,
        invoiceRevenue: 0,
        gstCollected: 0,
        invoiceProfit: 0,
        purchaseSpend: 0,
        serviceRevenue: 0,
        serviceProfit: 0,
        totalProfit: 0,
      };

      row.invoiceRevenue += Number(invoice.totalAmount);
      row.gstCollected += Number(invoice.gstAmount);
      row.invoiceProfit += Number(invoice.profitAmount);
      row.totalProfit += Number(invoice.profitAmount);
      breakdownMap.set(key, row);
    }

    for (const purchase of purchases) {
      const key = purchase.createdAt.toISOString().slice(0, 10);
      const row = breakdownMap.get(key) || {
        date: key,
        invoiceRevenue: 0,
        gstCollected: 0,
        invoiceProfit: 0,
        purchaseSpend: 0,
        serviceRevenue: 0,
        serviceProfit: 0,
        totalProfit: 0,
      };

      row.purchaseSpend += Number(purchase.totalCost);
      breakdownMap.set(key, row);
    }

    for (const serviceJob of serviceJobs) {
      const key = serviceJob.createdAt.toISOString().slice(0, 10);
      const row = breakdownMap.get(key) || {
        date: key,
        invoiceRevenue: 0,
        gstCollected: 0,
        invoiceProfit: 0,
        purchaseSpend: 0,
        serviceRevenue: 0,
        serviceProfit: 0,
        totalProfit: 0,
      };

      row.serviceRevenue += Number(serviceJob.totalAmount);
      row.serviceProfit += Number(serviceJob.profitAmount);
      row.totalProfit += Number(serviceJob.profitAmount);
      breakdownMap.set(key, row);
    }

    const breakdown = Array.from(breakdownMap.values())
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((entry) => ({
        ...entry,
        invoiceRevenue: entry.invoiceRevenue.toFixed(2),
        gstCollected: entry.gstCollected.toFixed(2),
        invoiceProfit: entry.invoiceProfit.toFixed(2),
        purchaseSpend: entry.purchaseSpend.toFixed(2),
        serviceRevenue: entry.serviceRevenue.toFixed(2),
        serviceProfit: entry.serviceProfit.toFixed(2),
        totalProfit: entry.totalProfit.toFixed(2),
      }));

    const summary = {
      invoiceRevenue: sumMoney(invoices.map((invoice) => invoice.totalAmount)).toFixed(2),
      gstCollected: sumMoney(invoices.map((invoice) => invoice.gstAmount)).toFixed(2),
      profitAmount: sumMoney(invoices.map((invoice) => invoice.profitAmount)).toFixed(2),
      invoiceProfit: sumMoney(invoices.map((invoice) => invoice.profitAmount)).toFixed(2),
      purchaseSpend: sumMoney(purchases.map((purchase) => purchase.totalCost)).toFixed(2),
      serviceRevenue: sumMoney(serviceJobs.map((job) => job.totalAmount)).toFixed(2),
      serviceProfit: sumMoney(serviceJobs.map((job) => job.profitAmount)).toFixed(2),
      totalProfit: (
        sumMoney(invoices.map((invoice) => invoice.profitAmount)) +
        sumMoney(serviceJobs.map((job) => job.profitAmount))
      ).toFixed(2),
      invoiceCount: invoices.length,
      purchaseCount: purchases.length,
      serviceCount: serviceJobs.length,
    };
    const reportMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

    if (format === "xlsx") {
      const rows = breakdown.map((entry) => ({
        Date: entry.date,
        "Invoice Revenue": Number(entry.invoiceRevenue),
        "GST Collected": Number(entry.gstCollected),
        "Purchase Spend": Number(entry.purchaseSpend),
        "Service Revenue": Number(entry.serviceRevenue),
        "Service Profit": Number(entry.serviceProfit),
        "Total Profit": Number(entry.totalProfit),
      }));

      rows.push({});
      rows.push({
        Date: "Summary",
        "Invoice Revenue": Number(summary.invoiceRevenue),
        "GST Collected": Number(summary.gstCollected),
        "Purchase Spend": Number(summary.purchaseSpend),
        "Service Revenue": Number(summary.serviceRevenue),
        "Service Profit": Number(summary.serviceProfit),
        "Total Profit": Number(summary.totalProfit),
      });

      const workbook = createWorkbookBuffer("Monthly Report", rows);
      return new NextResponse(workbook, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=\"monthly-sales-${reportMonth}.xlsx\"`,
        },
      });
    }

    return NextResponse.json({
      month: reportMonth,
      summary,
      breakdown,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to generate monthly report.");
  }
}
