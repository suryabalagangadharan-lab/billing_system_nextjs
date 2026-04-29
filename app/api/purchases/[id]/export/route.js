import { requireApiAuth } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { createWorkbookBuffer } from "@/lib/excel";
import { getPurchaseGroupById } from "@/lib/services/purchases";
import { NextResponse } from "next/server";

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

export async function GET(request, { params }) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { id } = await params;
    const purchaseGroup = await getPurchaseGroupById(id);

    const rows = purchaseGroup.purchases.map((purchase) => ({
      Date: purchaseGroup.purchaseDate.toISOString(),
      "Purchase Code": purchaseGroup.groupCode,
      Supplier: purchaseGroup.supplierName,
      Warehouse: purchaseGroup.warehouse,
      Reference: purchaseGroup.referenceNo || "",
      Item: purchase.product?.name || "",
      Quantity: Number(purchase.quantity),
      "Purchase Price": formatMoney(purchase.purchasePrice),
      Discount: formatMoney(purchase.discountAmount),
      "Tax Amount": formatMoney(purchase.taxAmount),
      "Unit Cost": formatMoney(purchase.unitCost),
      "Line Total": formatMoney(purchase.totalCost),
      "Grand Total": formatMoney(purchaseGroup.grandTotal),
      Paid: formatMoney(purchaseGroup.paidAmount),
      Due: formatMoney(purchaseGroup.dueAmount),
      Status: purchaseGroup.status,
    }));

    rows.push({});
    rows.push({
      Date: "Summary",
      "Purchase Code": purchaseGroup.groupCode,
      Supplier: purchaseGroup.supplierName,
      Warehouse: purchaseGroup.warehouse,
      Reference: purchaseGroup.referenceNo || "",
      Item: `Items: ${purchaseGroup.purchases.length}`,
      Quantity: purchaseGroup.purchases.reduce((sum, purchase) => sum + Number(purchase.quantity || 0), 0),
      "Purchase Price": "",
      Discount: "",
      "Tax Amount": "",
      "Unit Cost": "",
      "Line Total": "",
      "Grand Total": formatMoney(purchaseGroup.grandTotal),
      Paid: formatMoney(purchaseGroup.paidAmount),
      Due: formatMoney(purchaseGroup.dueAmount),
      Status: purchaseGroup.status,
    });

    const workbook = createWorkbookBuffer(`Purchase ${purchaseGroup.groupCode}`, rows);

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${purchaseGroup.groupCode}.xlsx"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to export purchase bill.");
  }
}
