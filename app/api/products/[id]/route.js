import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import {
  ApiError,
  handleRouteError,
  optionalMoney,
  parseRequestBody,
  parseOptionalString,
} from "@/lib/api";
import { productCreateSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });
  const params = await context.params;

  if (authResult.error) return authResult.error;

  try {
    const body = await parseRequestBody(request, productCreateSchema.partial());

    const name = body.name ? body.name.trim() : undefined;
    const description = parseOptionalString(body?.description);
    const unitPrice = optionalMoney(body?.unitPrice, "Unit price", { min: 0 });
    const gstRate = optionalMoney(body?.gstRate, "GST rate", { min: 0 });
    const costPrice = optionalMoney(body?.costPrice, "Cost price", { min: 0 });
    const stock = body?.stock === undefined ? undefined : Number(body.stock);
    const providedSku = parseOptionalString(body?.sku);
    const brandId = parseOptionalString(body?.brandId);
    const brandName = parseOptionalString(body?.brandName);

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
        const brand = await tx.brand.findUnique({ where: { id: resolvedBrandId }, select: { id: true } });
        if (!brand) throw new ApiError("Brand not found.", 404);
      }

      const data = {};
      if (name !== undefined) data.name = name;
      if (providedSku !== null) data.sku = providedSku;
      if (description !== null) data.description = description;
      if (unitPrice !== null) data.unitPrice = unitPrice;
      if (gstRate !== null) data.gstRate = gstRate;
      if (costPrice !== null) data.costPrice = costPrice;
      if (stock !== undefined) data.stock = stock;
      if (resolvedBrandId) data.brandId = resolvedBrandId;

      const updated = await tx.product.update({
        where: { id: params.id },
        data,
        include: { brand: true },
      });

      return updated;
    });

    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Unable to update product.");
  }
}

export async function DELETE(request, context) {
  const authResult = await requireApiAuth(request, { roles: ["admin"] });
  const params = await context.params;

  if (authResult.error) return authResult.error;

  try {
    const deleted = await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ deletedId: deleted.id });
  } catch (error) {
    return handleRouteError(error, "Unable to delete product.");
  }
}

export async function GET(request, context) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });
  const params = await context.params;

  if (authResult.error) return authResult.error;

  try {
    const product = await prisma.product.findUnique({ where: { id: params.id }, include: { brand: true } });

    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ product });
  } catch (error) {
    return handleRouteError(error, "Unable to fetch product.");
  }
}
