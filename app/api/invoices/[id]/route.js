import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseRequiredString } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET(request, context) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const params = await context.params;
    const id = parseRequiredString(params?.id, "Invoice ID");

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        billedBy: {
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
              },
            },
            stockLogs: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    return handleRouteError(error, "Unable to fetch invoice.");
  }
}
