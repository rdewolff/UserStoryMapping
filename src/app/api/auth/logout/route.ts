import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookie, deleteSessionByToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";
import { jsonError } from "@/lib/http";
import { isAllowedOrigin } from "@/lib/security";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await deleteSessionByToken(token);
  }

  const response = new NextResponse(null, {
    status: 204,
  });

  clearSessionCookie(response);
  return response;
}
