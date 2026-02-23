import { NextRequest, NextResponse } from "next/server";

import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { authPayloadSchema } from "@/lib/schemas";
import {
  clearFailedLogins,
  getLoginRateLimitKey,
  isAllowedOrigin,
  isLoginRateLimited,
  registerFailedLogin,
} from "@/lib/security";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = authPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const email = parsed.data.email.toLowerCase();
  const rateLimitKey = getLoginRateLimitKey(email, request);
  const rateLimitStatus = isLoginRateLimited(rateLimitKey);

  if (rateLimitStatus.limited) {
    return NextResponse.json(
      {
        error: "TOO_MANY_ATTEMPTS",
        retryAfterMs: rateLimitStatus.retryAfterMs,
      },
      {
        status: 429,
      },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    registerFailedLogin(rateLimitKey);
    return jsonError("INVALID_CREDENTIALS", 401);
  }

  const isValidPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!isValidPassword) {
    registerFailedLogin(rateLimitKey);
    return jsonError("INVALID_CREDENTIALS", 401);
  }

  clearFailedLogins(rateLimitKey);

  const session = await createSession(user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
  });

  setSessionCookie(response, session.token, session.expiresAt);

  return response;
}
