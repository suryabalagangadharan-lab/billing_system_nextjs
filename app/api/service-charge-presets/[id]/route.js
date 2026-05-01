import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseRequestBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serviceChargePresetCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json({ error: "Preset id is required." }, { status: 400 });
    }

    const preset = await prisma.serviceChargePreset.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!preset) {
      return NextResponse.json({ error: "Preset not found." }, { status: 404 });
    }

    await prisma.serviceChargePreset.delete({ where: { id } });

    return NextResponse.json({ deletedId: id, name: preset.name });
  } catch (error) {
    return handleRouteError(error, "Unable to delete service charge preset.");
  }
}

export async function PATCH(request, { params }) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json({ error: "Preset id is required." }, { status: 400 });
    }

    const preset = await prisma.serviceChargePreset.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!preset) {
      return NextResponse.json({ error: "Preset not found." }, { status: 404 });
    }

    const body = await parseRequestBody(request, serviceChargePresetCreateSchema);
    const updated = await prisma.serviceChargePreset.update({
      where: { id },
      data: {
        name: body.name,
        amount: body.amount,
      },
    });

    return NextResponse.json({
      preset: {
        ...updated,
        amount: Number(updated.amount).toFixed(2),
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to update service charge preset.");
  }
}
