import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { parseWorkbookRows } from "@/lib/excel";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getFirstValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }

  return null;
}

function toOptionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function toMoney(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const normalizedValue = String(value).replace(/,/g, "").trim();
  const parsed = Number(normalizedValue);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError(`${fieldName} must be a valid non-negative number.`, 400);
  }

  return parsed.toFixed(2);
}

function toGstRate(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const raw = String(value);
  const bracketMatch = raw.match(/\((\d+(\.\d+)?)%\)/);

  if (bracketMatch) {
    return Number(bracketMatch[1]).toFixed(2);
  }

  const directMatch = raw.match(/(\d+(\.\d+)?)/);
  if (directMatch) {
    return Number(directMatch[1]).toFixed(2);
  }

  throw new ApiError("GST rate must be a valid number.", 400);
}

function toStock(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ApiError("Stock must be a valid non-negative integer.", 400);
  }

  return parsed;
}

function buildDescription(row) {
  const parts = [
    getFirstValue(row, ["description", "details"]),
    getFirstValue(row, ["categoryitemtype", "category", "itemtype"]),
    getFirstValue(row, ["unit"]),
    getFirstValue(row, ["status"]),
  ]
    .map(toOptionalText)
    .filter(Boolean);

  return parts.length ? parts.join(" | ") : null;
}

export async function POST(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      throw new ApiError("Excel file is required.", 400);
    }

    const buffer = await file.arrayBuffer();
    const rows = parseWorkbookRows(buffer);

    if (!rows.length) {
      throw new ApiError("No rows found in uploaded file.", 400);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      try {
        const rawName = getFirstValue(row, ["name", "itemname", "productname", "product"]);
        const name = toOptionalText(rawName?.toString().replace(/HSN:.*$/i, "").replace(/SKU:.*$/i, ""));
        if (!name) {
          skipped += 1;
          continue;
        }

        const sku = toOptionalText(getFirstValue(row, ["sku", "itemcode", "code"]));
        const brandName = toOptionalText(getFirstValue(row, ["brandname", "brand", "company"]));
        const description = buildDescription(row);
        const unitPrice = toMoney(
          getFirstValue(row, ["unitprice", "salesprice", "sellingprice", "mrp", "rate"]),
          "Unit price"
        );
        const costPrice = toMoney(
          getFirstValue(row, ["costprice", "purchaseprice", "cost"]),
          "Cost price"
        );
        const gstRate = toGstRate(
          getFirstValue(row, ["gstrate", "gst", "gstpercent", "taxrate", "tax"])
        );
        const stock = toStock(getFirstValue(row, ["stock", "qty", "quantity", "openingstock"]));

        if (!unitPrice) {
          throw new ApiError("Unit price is required.", 400);
        }

        let brandId = null;
        if (brandName) {
          const brand = await prisma.brand.upsert({
            where: { name: brandName },
            update: {},
            create: { name: brandName },
            select: { id: true },
          });
          brandId = brand.id;
        }

        let existingProduct = null;
        if (sku) {
          existingProduct = await prisma.product.findUnique({
            where: { sku },
            select: { id: true, stock: true },
          });
        }

        if (!existingProduct) {
          existingProduct = await prisma.product.findFirst({
            where: {
              name,
              brandId,
            },
            select: { id: true, stock: true },
          });
        }

        const payload = {
          name,
          sku,
          description,
          unitPrice,
          gstRate: gstRate || "0.00",
          costPrice,
          brandId,
          ...(stock === null ? {} : { stock }),
        };

        if (existingProduct) {
          await prisma.product.update({
            where: { id: existingProduct.id },
            data: payload,
          });
          updated += 1;
        } else {
          await prisma.product.create({
            data: {
              ...payload,
              stock: stock ?? 0,
            },
          });
          created += 1;
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error?.message || "Unable to import row.",
        });
      }
    }

    return NextResponse.json({
      summary: {
        totalRows: rows.length,
        created,
        updated,
        skipped,
        failed: errors.length,
      },
      errors,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to import products.");
  }
}
