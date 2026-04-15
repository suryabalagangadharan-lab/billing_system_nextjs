import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { ApiError, handleRouteError, sumMoney } from "@/lib/api";
import { createWorkbookBuffer } from "@/lib/excel";
import { NextResponse } from "next/server";

function getYearRange(yearValue) {
  const now = new Date();
  const parsedYear = yearValue ? Number(yearValue) : now.getFullYear();

  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
    throw new ApiError("Invalid year parameter. Use YYYY.", 400);
  }

  return {
    year: parsedYear,
    start: new Date(parsedYear, 0, 1),
    end: new Date(parsedYear + 1, 0, 1),
  };
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthEntry(key) {
  return {
    month: key,
    invoiceRevenue: 0,
    gstCollected: 0,
    purchaseSpend: 0,
    serviceRevenue: 0,
    totalProfit: 0,
  };
}

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") ?? undefined;
    const format = (searchParams.get("format") || "").toLowerCase();
    const { start, end, year: reportYear } = getYearRange(year);

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

    const monthlyMap = new Map();

    for (const invoice of invoices) {
      const key = monthKey(invoice.createdAt);
      const row = monthlyMap.get(key) || buildMonthEntry(key);
      row.invoiceRevenue += Number(invoice.totalAmount);
      row.gstCollected += Number(invoice.gstAmount);
      row.totalProfit += Number(invoice.profitAmount);
      monthlyMap.set(key, row);
    }

    for (const purchase of purchases) {
      const key = monthKey(purchase.createdAt);
      const row = monthlyMap.get(key) || buildMonthEntry(key);
      row.purchaseSpend += Number(purchase.totalCost);
      monthlyMap.set(key, row);
    }

    for (const service of serviceJobs) {
      const key = monthKey(service.createdAt);
      const row = monthlyMap.get(key) || buildMonthEntry(key);
      row.serviceRevenue += Number(service.totalAmount);
      row.totalProfit += Number(service.profitAmount);
      monthlyMap.set(key, row);
    }

    const breakdown = Array.from(monthlyMap.values())
      .sort((left, right) => left.month.localeCompare(right.month))
      .map((entry) => ({
        ...entry,
        invoiceRevenue: entry.invoiceRevenue.toFixed(2),
        gstCollected: entry.gstCollected.toFixed(2),
        purchaseSpend: entry.purchaseSpend.toFixed(2),
        serviceRevenue: entry.serviceRevenue.toFixed(2),
        totalProfit: entry.totalProfit.toFixed(2),
      }));

    const summary = {
      invoiceRevenue: sumMoney(invoices.map((invoice) => invoice.totalAmount)).toFixed(2),
      gstCollected: sumMoney(invoices.map((invoice) => invoice.gstAmount)).toFixed(2),
      purchaseSpend: sumMoney(purchases.map((purchase) => purchase.totalCost)).toFixed(2),
      serviceRevenue: sumMoney(serviceJobs.map((job) => job.totalAmount)).toFixed(2),
      totalProfit: (
        sumMoney(invoices.map((invoice) => invoice.profitAmount)) +
        sumMoney(serviceJobs.map((job) => job.profitAmount))
      ).toFixed(2),
      invoiceCount: invoices.length,
      purchaseCount: purchases.length,
      serviceCount: serviceJobs.length,
    };

    if (format === "xlsx") {
      const rows = breakdown.map((entry) => ({
        Month: entry.month,
        "Invoice Revenue": Number(entry.invoiceRevenue),
        "GST Collected": Number(entry.gstCollected),
        "Purchase Spend": Number(entry.purchaseSpend),
        "Service Revenue": Number(entry.serviceRevenue),
        "Total Profit": Number(entry.totalProfit),
      }));

      rows.push({});
      rows.push({
        Month: "Summary",
        "Invoice Revenue": Number(summary.invoiceRevenue),
        "GST Collected": Number(summary.gstCollected),
        "Purchase Spend": Number(summary.purchaseSpend),
        "Service Revenue": Number(summary.serviceRevenue),
        "Total Profit": Number(summary.totalProfit),
      });

      const workbook = createWorkbookBuffer("Yearly Report", rows);
      return new NextResponse(workbook, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=\"yearly-sales-${reportYear}.xlsx\"`,
        },
      });
    }

    return NextResponse.json({
      year: String(reportYear),
      summary,
      breakdown,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to generate yearly report.");
  }
}
