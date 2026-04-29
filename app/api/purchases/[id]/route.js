import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseRequestBody } from "@/lib/api";
import { getPurchaseGroupById, updatePurchaseGroup } from "@/lib/services/purchases";
import { purchaseGroupUpdateSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { id } = await params;
    const purchaseGroup = await getPurchaseGroupById(id);
    return NextResponse.json({ purchaseGroup });
  } catch (error) {
    return handleRouteError(error, "Unable to load purchase.");
  }
}

export async function PUT(request, { params }) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { id } = await params;
    const body = await parseRequestBody(request, purchaseGroupUpdateSchema);
    const purchaseGroup = await updatePurchaseGroup(id, body);
    return NextResponse.json({ purchaseGroup });
  } catch (error) {
    return handleRouteError(error, "Unable to update purchase.");
  }
}
