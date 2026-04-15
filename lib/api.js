import { ZodError } from "zod";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(message, status = 400, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function jsonError(message, status = 400, details) {
  return NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status }
  );
}

export function handleRouteError(error, fallbackMessage) {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status, error.details);
  }

  if (error instanceof ZodError) {
    return jsonError("Validation failed.", 422, error.flatten());
  }

  if (error instanceof SyntaxError) {
    return jsonError("Invalid JSON request body.", 400);
  }

  console.error(fallbackMessage, error);
  return jsonError(fallbackMessage, 500);
}

export async function parseRequestBody(request, schema) {
  const body = await request.json();

  if (!schema) {
    return body;
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiError("Validation failed.", 422, result.error.flatten());
  }

  return result.data;
}

export function parseRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(`${fieldName} is required.`, 400);
  }

  return value.trim();
}

export function parseOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError("Invalid text value.", 400);
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

export function parseInteger(value, fieldName, options = {}) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    throw new ApiError(`${fieldName} must be an integer.`, 400);
  }

  if (options.min !== undefined && parsedValue < options.min) {
    throw new ApiError(`${fieldName} must be at least ${options.min}.`, 400);
  }

  return parsedValue;
}

export function parseMoney(value, fieldName, options = {}) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new ApiError(`${fieldName} must be a valid number.`, 400);
  }

  if (options.min !== undefined && parsedValue < options.min) {
    throw new ApiError(`${fieldName} must be at least ${options.min}.`, 400);
  }

  return parsedValue.toFixed(2);
}

export function optionalMoney(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parseMoney(value, fieldName, options);
}

export function createReferenceCode(prefix) {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
    2,
    "0"
  )}${String(now.getSeconds()).padStart(2, "0")}`;
  const randomPart = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `${prefix}-${datePart}-${timePart}-${randomPart}`;
}

export function getDayRange(dateValue) {
  const baseDate = dateValue ? new Date(dateValue) : new Date();

  if (Number.isNaN(baseDate.getTime())) {
    throw new ApiError("Invalid date parameter.", 400);
  }

  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export function getMonthRange(monthValue) {
  let baseDate;

  if (monthValue) {
    baseDate = new Date(`${monthValue}-01T00:00:00`);
  } else {
    const now = new Date();
    baseDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (Number.isNaN(baseDate.getTime())) {
    throw new ApiError("Invalid month parameter. Use YYYY-MM.", 400);
  }

  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);

  return { start, end };
}

export function sumMoney(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}
