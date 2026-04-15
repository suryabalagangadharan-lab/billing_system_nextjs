import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import {
  ApiError,
  createReferenceCode,
  handleRouteError,
  optionalMoney,
  parseRequestBody,
  parseOptionalString,
} from "@/lib/api";
import { productCreateSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const products = await prisma.product.findMany({
      include: {
        brand: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(
      { products },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return handleRouteError(error, "Unable to fetch products.");
  }
}

export async function POST(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await parseRequestBody(request, productCreateSchema);
    const name = body.name.trim();
    const description = parseOptionalString(body?.description);
    const unitPrice = optionalMoney(body?.unitPrice, "Unit price", { min: 0 });
    const gstRate = optionalMoney(body?.gstRate, "GST rate", { min: 0 }) || "0.00";
    const costPrice = optionalMoney(body?.costPrice, "Cost price", { min: 0 });
    const initialStock = body?.stock === undefined ? 0 : Number(body.stock);
    const providedSku = parseOptionalString(body?.sku);
    const brandId = parseOptionalString(body?.brandId);
    const brandName = parseOptionalString(body?.brandName);

    if (!unitPrice) {
      throw new ApiError("Unit price is required.", 400);
    }

    const product = await prisma.$transaction(async (tx) => {
      let resolvedBrandId = brandId;

      if (!resolvedBrandId && brandName) {
        const brand = await tx.brand.upsert({
          where: { name: brandName },
          update: {},
          create: { name: brandName },
        });

        resolvedBrandId = brand.id;
      }

      if (resolvedBrandId) {
        const brand = await tx.brand.findUnique({
          where: { id: resolvedBrandId },
          select: { id: true },
        });

        if (!brand) {
          throw new ApiError("Brand not found.", 404);
        }
      }

      return tx.product.create({
        data: {
          name,
          sku: providedSku || createReferenceCode("SKU"),
          description,
          unitPrice,
          gstRate,
          costPrice,
          stock: initialStock,
          brandId: resolvedBrandId,
        },
        include: {
          brand: true,
        },
      });
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create product.");
  }
}
