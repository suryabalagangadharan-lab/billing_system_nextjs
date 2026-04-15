import { prisma } from "@/lib/prisma";
import {
  AUTH_COOKIE_NAME,
  generateAuthToken,
} from "@/lib/auth";
import { handleRouteError, parseRequestBody } from "@/lib/api";
import { verifyPassword } from "@/lib/passwords";
import { loginSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await parseRequestBody(request, loginSchema);
    const username = body.username.trim();
    const password = body.password;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const token = await generateAuthToken(user);
    const response = NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return handleRouteError(error, "Unable to complete login request.");
  }
}
