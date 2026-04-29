import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseOptionalString, parseRequestBody } from "@/lib/api";
import { createServiceJob } from "@/lib/services/service";
import { serviceCreateSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseTake(searchParams) {
  const value = Number(searchParams.get("take"));

  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return Math.min(value, 500);
}

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const take = parseTake(request.nextUrl.searchParams);
    const serviceJobs = await prisma.serviceJob.findMany({
      ...(take ? { take } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        brand: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                itemCode: true,
                stock: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ serviceJobs });
  } catch (error) {
    return handleRouteError(error, "Unable to load service jobs.");
  }
}

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
