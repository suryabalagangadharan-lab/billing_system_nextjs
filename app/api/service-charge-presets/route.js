import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { handleRouteError, parseRequestBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serviceChargePresetCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const presets = await prisma.serviceChargePreset.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      presets: presets.map((preset) => ({
        ...preset,
        amount: Number(preset.amount).toFixed(2),
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load service charge presets.");
  }
}

export async function POST(request) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await parseRequestBody(request, serviceChargePresetCreateSchema);
    const preset = await prisma.serviceChargePreset.create({
      data: {
        name: body.name,
        amount: body.amount,
      },
    });

    return NextResponse.json({
      preset: {
        ...preset,
        amount: Number(preset.amount).toFixed(2),
      },
    }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Unable to create service charge preset.");
  }
}
