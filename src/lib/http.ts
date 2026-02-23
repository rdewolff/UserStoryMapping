import { NextResponse } from "next/server";

export function jsonError(
  message: string,
  status = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      details,
    },
    { status },
  );
}

export function normalizeNullableText(input?: string | null): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}
