import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseOptionalString, parseRequestBody } from "@/lib/api";
import { createServiceJob } from "@/lib/services/service";
import { serviceCreateSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function POST(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await parseRequestBody(request, serviceCreateSchema);
    const serviceJob = await createServiceJob({
      ...body,
      assignedToId: parseOptionalString(body?.assignedToId) || authResult.session.userId,
      createdById: authResult.session.userId,
    });

    return NextResponse.json({ serviceJob }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create service job.");
  }
}
