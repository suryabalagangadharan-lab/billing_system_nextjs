import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseRequestBody } from "@/lib/api";
import { createPurchase } from "@/lib/services/purchase";
import { purchaseCreateSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function POST(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await parseRequestBody(request, purchaseCreateSchema);
    const purchase = await createPurchase({
      ...body,
      purchasedById: authResult.session.userId,
    });

    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create purchase.");
  }
}
