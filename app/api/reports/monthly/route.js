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

    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });

    function formatDate(d) {
      if (!d) return "";
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yyyy = dt.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }

    const invoiceRows = invoices.map((inv, idx) => {
      const discount = Number(inv.discount ?? 0) || 0;
      const rate = Number(inv.subtotal ?? 0);
      const gstAmount = Number(inv.gstAmount ?? 0);
      const gstRate = Number(inv.gstRate ?? 0);
      const cgst = gstAmount / 2;
      const sgst = gstAmount / 2;
      const igst = 0;
      const finalTotal = Number(inv.totalAmount ?? 0);
      const roundOff = Number((finalTotal - (rate + gstAmount - discount)).toFixed(2));

      return {
        serial: idx + 1,
        invoiceNumber: inv.invoiceNumber,
        createdDate: formatDate(inv.createdAt),
        createdAtRaw: inv.createdAt,
        customerName: (inv.customer && inv.customer.name) || inv.customerName || "",
        customerGst: (inv.customer && inv.customer.gstNumber) || "",
        rate: rate,
        discount: discount,
        gstLabel: `GST${Number(gstRate)}%`,
        gstRate: gstRate,
        cgst: cgst,
        sgst: sgst,
        igst: igst,
        roundOff: roundOff,
        finalTotal: finalTotal,
      };
    });

    const summary = {
      totalInvoiceAmount: sumMoney(invoices.map((i) => i.totalAmount)).toFixed(2),
      totalGst: sumMoney(invoices.map((i) => i.gstAmount)).toFixed(2),
      totalCgst: sumMoney(invoices.map((i) => Number(i.gstAmount ?? 0) / 2)).toFixed(2),
      totalSgst: sumMoney(invoices.map((i) => Number(i.gstAmount ?? 0) / 2)).toFixed(2),
      invoiceCount: invoices.length,
    };
    const reportMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

    if (format === "xlsx") {
      const rows = invoiceRows.map((r) => ({
        "#": r.serial,
        "Invoice Number": r.invoiceNumber,
        "Created Date": r.createdDate,
        "Customer Name": r.customerName,
        "Customer GST Number": r.customerGst,
        "Rate": Number(r.rate).toFixed(2),
        "Discount Amount": Number(r.discount).toFixed(2),
        "GST %": r.gstLabel,
        "CGST Amount": Number(r.cgst).toFixed(2),
        "SGST Amount": Number(r.sgst).toFixed(2),
        "IGST Amount": Number(r.igst).toFixed(2),
        "Round Off": Number(r.roundOff).toFixed(2),
        "Final Invoice Total": Number(r.finalTotal).toFixed(2),
      }));

      // add summary row
      rows.push({});
      rows.push({
        "#": "",
        "Invoice Number": "",
        "Created Date": "",
        "Customer Name": "",
        "Customer GST Number": "Totals",
        "Rate": "",
        "Discount Amount": "",
        "GST %": "",
        "CGST Amount": summary.totalCgst,
        "SGST Amount": summary.totalSgst,
        "IGST Amount": 0,
        "Round Off": "",
        "Final Invoice Total": summary.totalInvoiceAmount,
      });

      const buffer = createWorkbookBuffer("Monthly Sales Report", rows);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="monthly-sales-${reportMonth}.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      month: reportMonth,
      summary,
      invoices: invoiceRows.map((r) => ({
        serial: r.serial,
        invoiceNumber: r.invoiceNumber,
        createdDate: r.createdDate,
        customerName: r.customerName,
        customerGst: r.customerGst,
        rate: Number(r.rate).toFixed(2),
        discount: Number(r.discount).toFixed(2),
        gst: r.gstLabel,
        cgst: Number(r.cgst).toFixed(2),
        sgst: Number(r.sgst).toFixed(2),
        igst: Number(r.igst).toFixed(2),
        roundOff: Number(r.roundOff).toFixed(2),
        finalTotal: Number(r.finalTotal).toFixed(2),
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to generate monthly report.");
  }
}
