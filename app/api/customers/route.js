import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") || "").trim();

    const customers = await prisma.customer.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query } },
              { phone: { contains: query } },
              { email: { contains: query } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            invoices: true,
            serviceJobs: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: 25,
    });

    return NextResponse.json({ customers });
  } catch (error) {
    return handleRouteError(error, "Unable to load customers.");
  }
}
