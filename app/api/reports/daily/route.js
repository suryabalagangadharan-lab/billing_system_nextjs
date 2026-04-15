import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { getDayRange, handleRouteError, sumMoney } from "@/lib/api";
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
      date: searchParams.get("date") ?? undefined,
    });
    const format = (searchParams.get("format") || "").toLowerCase();
    const date = query.date;
    const { start, end } = getDayRange(date);

    const [invoices, purchases, serviceJobs] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        select: {
          id: true,
          invoiceNumber: true,
          gstAmount: true,
          profitAmount: true,
          totalAmount: true,
          status: true,
          customerName: true,
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
          id: true,
          purchaseCode: true,
          totalCost: true,
          quantity: true,
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
          id: true,
          jobNumber: true,
          customerName: true,
          serviceCharge: true,
          totalAmount: true,
          profitAmount: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const summary = {
      invoiceCount: invoices.length,
      invoiceRevenue: sumMoney(invoices.map((invoice) => invoice.totalAmount)).toFixed(2),
      gstCollected: sumMoney(invoices.map((invoice) => invoice.gstAmount)).toFixed(2),
      profitAmount: sumMoney(invoices.map((invoice) => invoice.profitAmount)).toFixed(2),
      purchaseCount: purchases.length,
      purchaseSpend: sumMoney(purchases.map((purchase) => purchase.totalCost)).toFixed(2),
      serviceCount: serviceJobs.length,
      serviceRevenue: sumMoney(serviceJobs.map((job) => job.totalAmount)).toFixed(2),
      serviceProfit: sumMoney(serviceJobs.map((job) => job.profitAmount)).toFixed(2),
      totalProfit: (
        sumMoney(invoices.map((invoice) => invoice.profitAmount)) +
        sumMoney(serviceJobs.map((job) => job.profitAmount))
      ).toFixed(2),
    };

    if (format === "xlsx") {
      const reportDate = start.toISOString().slice(0, 10);
      const rows = invoices.map((invoice) => ({
        Date: invoice.createdAt.toISOString(),
        Type: "Invoice",
        Reference: invoice.invoiceNumber,
        Customer: invoice.customerName,
        Status: invoice.status,
        Amount: Number(invoice.totalAmount),
        GST: Number(invoice.gstAmount),
        Profit: Number(invoice.profitAmount),
      }));

      rows.push(
        ...serviceJobs.map((job) => ({
          Date: job.createdAt.toISOString(),
          Type: "Service",
          Reference: job.jobNumber,
          Customer: job.customerName,
          Status: job.status,
          Amount: Number(job.totalAmount),
          GST: 0,
          Profit: Number(job.profitAmount),
        }))
      );

      rows.push(
        ...purchases.map((purchase) => ({
          Date: purchase.createdAt.toISOString(),
          Type: "Purchase",
          Reference: purchase.purchaseCode,
          Customer: "",
          Status: "",
          Amount: Number(purchase.totalCost) * -1,
          GST: 0,
          Profit: 0,
        }))
      );

      rows.push({});
      rows.push({
        Date: "Summary",
        Type: "Daily Revenue",
        Amount: Number(summary.invoiceRevenue),
        GST: Number(summary.gstCollected),
        Profit: Number(summary.totalProfit),
      });

      const workbook = createWorkbookBuffer("Daily Report", rows);
      return new NextResponse(workbook, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=\"daily-sales-${reportDate}.xlsx\"`,
        },
      });
    }

    return NextResponse.json({
      date: start.toISOString().slice(0, 10),
      summary,
      invoices,
      purchases,
      serviceJobs,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to generate daily report.");
  }
}
