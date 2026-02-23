import { NextRequest, NextResponse } from "next/server";

import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { authPayloadSchema } from "@/lib/schemas";
import { isAllowedOrigin } from "@/lib/security";

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

  const existing = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return jsonError("EMAIL_TAKEN", 409);
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(parsed.data.password),
    },
    select: {
      id: true,
      email: true,
    },
  });

  const session = await createSession(user.id);

  const response = NextResponse.json({
    user,
  });

  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
