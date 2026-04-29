import { requireApiAuth } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { createWorkbookBuffer } from "@/lib/excel";
import { listPurchaseGroups } from "@/lib/services/purchases";
import { NextResponse } from "next/server";

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const supplier = searchParams.get("supplier") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const purchases = await listPurchaseGroups({ search, supplier, from, to, take: 500 });

    const rows = [];

    for (const purchaseGroup of purchases) {
      for (const purchase of purchaseGroup.purchases) {
        rows.push({
          Date: purchaseGroup.purchaseDate.toISOString(),
          "Purchase Code": purchaseGroup.groupCode,
          Supplier: purchaseGroup.supplierName,
          Warehouse: purchaseGroup.warehouse,
          Reference: purchaseGroup.referenceNo || "",
          Item: purchase.product?.name || "",
          Quantity: Number(purchase.quantity),
          "Purchase Price": Number(purchase.purchasePrice || 0).toFixed(2),
          Discount: Number(purchase.discountAmount || 0).toFixed(2),
          "Tax Amount": Number(purchase.taxAmount || 0).toFixed(2),
          "Unit Cost": Number(purchase.unitCost || 0).toFixed(2),
          "Line Total": Number(purchase.totalCost || 0).toFixed(2),
          "Grand Total": Number(purchaseGroup.grandTotal || 0).toFixed(2),
          Paid: Number(purchaseGroup.paidAmount || 0).toFixed(2),
          Due: Number(purchaseGroup.dueAmount || 0).toFixed(2),
          Status: purchaseGroup.status,
        });
      }
    }

    const workbook = createWorkbookBuffer("Purchase History", rows);
    const exportDate = new Date().toISOString().slice(0, 10);

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="purchase-history-${exportDate}.xlsx"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to export purchase history.");
  }
}
