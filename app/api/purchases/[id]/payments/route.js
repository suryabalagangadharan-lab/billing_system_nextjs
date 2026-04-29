import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseRequestBody } from "@/lib/api";
import { addPurchasePayment } from "@/lib/services/purchases";
import { purchasePaymentSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await parseRequestBody(request, purchasePaymentSchema);
    const { id } = await params;
    const purchaseGroup = await addPurchasePayment({
      ...body,
      purchaseGroupId: id,
      paidById: authResult.session.userId,
    });

    return NextResponse.json({ purchaseGroup });
  } catch (error) {
    return handleRouteError(error, "Unable to add purchase payment.");
  }
}
