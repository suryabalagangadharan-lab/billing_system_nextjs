import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function PATCH(request) {
  const auth = await requireApiAuth(request, { roles: ["admin"] });
  if (auth.error) return auth.error;

  try {
    const { category, gstRate } = await request.json();

    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    if (gstRate === undefined || gstRate === null) {
      return NextResponse.json({ error: "GST rate is required" }, { status: 400 });
    }

    const updated = await prisma.product.updateMany({
      where: { category },
      data: { gstRate: Number(gstRate) },
    });

    return NextResponse.json({
      message: "GST updated successfully",
      updatedCount: updated.count,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update GST" }, { status: 500 });
  }
}