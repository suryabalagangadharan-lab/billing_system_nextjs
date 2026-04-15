import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { handleRouteError } from "@/lib/api";
import { reportQuerySchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = reportQuerySchema.parse({
      lowStockThreshold: searchParams.get("lowStockThreshold") ?? undefined,
    });
    const lowStockThreshold =
      query.lowStockThreshold === undefined ? 5 : Number(query.lowStockThreshold);

    const [products, recentLogs] = await Promise.all([
      prisma.product.findMany({
        include: {
          brand: true,
        },
        orderBy: {
          stock: "asc",
        },
      }),
      prisma.stockLog.findMany({
        take: 50,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          changedBy: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      summary: {
        totalProducts: products.length,
        lowStockCount: products.filter((product) => product.stock <= lowStockThreshold).length,
        outOfStockCount: products.filter((product) => product.stock === 0).length,
      },
      products,
      recentLogs,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to generate stock report.");
  }
}
