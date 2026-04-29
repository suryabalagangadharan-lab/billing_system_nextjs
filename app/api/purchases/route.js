import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseRequestBody } from "@/lib/api";
import { createPurchaseGroup, listPurchaseGroups } from "@/lib/services/purchases";
import { purchaseGroupCreateSchema } from "@/lib/validation";
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
    const take = searchParams.get("take") || "10";
    const skip = searchParams.get("skip") || "0";
    const purchaseGroups = await listPurchaseGroups({ search, supplier, from, to, take, skip });

    return NextResponse.json({ purchaseGroups });
  } catch (error) {
    return handleRouteError(error, "Unable to fetch purchases.");
  }
}

export async function POST(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await parseRequestBody(request, purchaseGroupCreateSchema);
    const purchaseGroup = await createPurchaseGroup({
      ...body,
      createdById: authResult.session.userId,
    });

    return NextResponse.json({ purchaseGroup }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create purchase.");
  }
}
