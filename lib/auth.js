import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export const AUTH_COOKIE_NAME = "billing_token";
const TOKEN_EXPIRATION = "7d";
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function generateAuthToken(user) {
  return new SignJWT({
    sub: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export function hasRequiredRole(session, allowedRoles = []) {
  if (!allowedRoles.length) {
    return true;
  }

  return allowedRoles.includes(session.role);
}

export function createUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function createForbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function getRequestSession(request) {
  const token = extractTokenFromRequest(request);

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

export async function requireAuth(options = {}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!hasRequiredRole(session, options.roles)) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireApiAuth(request, options = {}) {
  const session = await getRequestSession(request);

  if (!session) {
    return {
      error: createUnauthorizedResponse(),
    };
  }

  if (!hasRequiredRole(session, options.roles)) {
    return {
      error: createForbiddenResponse(),
    };
  }

  return { session };
}

export async function isAuthenticated() {
  const session = await getSession();
  return Boolean(session);
}
