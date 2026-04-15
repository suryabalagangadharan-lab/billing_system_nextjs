import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseRequestBody } from "@/lib/api";
import { createInvoice } from "@/lib/services/billing";
import { invoiceCreateSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await parseRequestBody(request, invoiceCreateSchema);
    const invoice = await createInvoice({
      ...body,
      billedById: authResult.session.userId,
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create invoice.");
  }
}
