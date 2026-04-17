import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { ApiError, handleRouteError } from "@/lib/api";
import { parseWorkbookRows } from "@/lib/excel";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- HELPERS ---------------- */

function getFirstValue(row, keys) {
  const normalizedRow = {};

  for (const key in row) {
    normalizedRow[key.toLowerCase().trim()] = row[key];
  }

  for (const key of keys) {
    const k = key.toLowerCase().trim();

    if (
      normalizedRow[k] !== undefined &&
      normalizedRow[k] !== null &&
      String(normalizedRow[k]).trim() !== ""
    ) {
      return normalizedRow[k];
    }
  }

  return null;
}

function toOptionalText(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  return v || null;
}

function toMoney(value, field) {
  if (!value) return null;
  const num = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num) || num < 0) {
    throw new ApiError(`${field} must be valid`, 400);
  }
  return num.toFixed(2);
}

function toGstRate(value) {
  if (!value) return "0.00";
  const match = String(value).match(/(\d+(\.\d+)?)/);
  if (!match) throw new ApiError("Invalid GST", 400);
  return Number(match[1]).toFixed(2);
}

function toStock(value) {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw new ApiError("Invalid stock", 400);
  }
  return num;
}

function buildDescription(row) {
  const parts = [
    getFirstValue(row, ["description"]),
    getFirstValue(row, ["category"]),
    getFirstValue(row, ["unit"]),
  ]
    .map(toOptionalText)
    .filter(Boolean);

  return parts.length ? parts.join(" | ") : null;
}

/* ---------------- API ---------------- */

export async function POST(request) {
  const auth = await requireApiAuth(request, { roles: ["admin", "employee"] });
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      throw new ApiError("Excel file required", 400);
    }

    const buffer = await file.arrayBuffer();
    const rows = parseWorkbookRows(buffer);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        /* ---------- REQUIRED FIELDS ---------- */

        const itemCode = toOptionalText(
          getFirstValue(row, ["itemcode", "item code", "code"])
        )?.toUpperCase();

        let finalItemCode = itemCode;

if (!finalItemCode) {
  finalItemCode = `AUTO-${Date.now()}-${i}`;
}

        function cleanProductName(raw) {
  if (!raw) return null;

  let name = String(raw);

  // remove HSN part
  name = name.replace(/HSN\s*:?[\w.]+/gi, "");

  // remove SKU part
  name = name.replace(/SKU\s*:?[\w-]*/gi, "");

  return name.trim();
}

const rawName = getFirstValue(row, ["itemname", "name", "product"]);
const name = toOptionalText(cleanProductName(rawName));

        if (!name) {
          skipped++;
          continue;
        }

        /* ---------- OPTIONAL ---------- */

        const sku = toOptionalText(getFirstValue(row, ["sku"]));
        const brandName = toOptionalText(getFirstValue(row, ["brand"]));
        const category = toOptionalText(getFirstValue(row, ["category"]));
        const unit = toOptionalText(getFirstValue(row, ["unit"]));
        const alertQty = Number(getFirstValue(row, ["alertqty"]) || 0);

        const unitPrice = toMoney(
          getFirstValue(row, ["salesprice", "unitprice"]),
          "Unit Price"
        );

        if (!unitPrice) {
          throw new ApiError("Unit price required", 400);
        }

        const costPrice = toMoney(getFirstValue(row, ["costprice"]), "Cost");
        const gstRate = toGstRate(getFirstValue(row, ["gst", "tax"]));
        const stock = toStock(getFirstValue(row, ["stock"]));

        const description = buildDescription(row);

        /* ---------- BRAND ---------- */

        let brandId = null;
        if (brandName) {
          const brand = await prisma.brand.upsert({
            where: { name: brandName },
            update: {},
            create: { name: brandName },
          });
          brandId = brand.id;
        }

        /* ---------- CHECK EXISTING ---------- */

        const existing = await prisma.product.findUnique({
          where: { itemCode: finalItemCode },
        });

        const data = {
          itemCode: finalItemCode,
          name,
          sku,
          description,
          category,
          unit,
          alertQty,
          unitPrice,
          gstRate,
          costPrice,
          brandId,
          stock: stock ?? 0,
        };

        /* ---------- CREATE / UPDATE ---------- */

        if (existing) {
          await prisma.product.update({
            where: { itemCode },
            data,
          });
          updated++;
        } else {
          await prisma.product.create({ data });
          created++;
        }
      } catch (err) {
        errors.push({
          row: rowNumber,
          message: err.message,
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
  } catch (err) {
    return handleRouteError(err, "Import failed");
  }
}