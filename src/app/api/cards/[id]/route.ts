import { NextRequest, NextResponse } from "next/server";

import { Effort } from "@/generated/prisma/enums";
import { getRequestUser } from "@/lib/auth";
import { EFFORT_TO_DB } from "@/lib/constants";
import { jsonError, normalizeNullableText } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { cardUpdateSchema } from "@/lib/schemas";
import { serializeCard } from "@/lib/serializers";
import { isAllowedOrigin } from "@/lib/security";

type CardRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: CardRouteContext,
): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const existing = await prisma.card.findUnique({
    where: {
      id,
    },
    include: {
      board: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!existing || existing.board.ownerId !== user.id) {
    return jsonError("NOT_FOUND", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = cardUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  if (existing.version !== parsed.data.version) {
    return jsonError("VERSION_CONFLICT", 409);
  }

  const card = await prisma.card.update({
    where: {
      id,
    },
    data: {
      title: parsed.data.title,
      description:
        parsed.data.description === undefined
          ? undefined
          : normalizeNullableText(parsed.data.description),
      effort:
        parsed.data.effort === undefined
          ? undefined
          : (EFFORT_TO_DB[parsed.data.effort] as Effort),
      weekTarget:
        parsed.data.weekTarget === undefined
          ? undefined
          : normalizeNullableText(parsed.data.weekTarget),
      version: {
        increment: 1,
      },
    },
  });

  return NextResponse.json({
    card: serializeCard(card),
  });
}

export async function DELETE(
  request: NextRequest,
  context: CardRouteContext,
): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const existing = await prisma.card.findUnique({
    where: {
      id,
    },
    include: {
      board: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!existing || existing.board.ownerId !== user.id) {
    return jsonError("NOT_FOUND", 404);
  }

  await prisma.card.delete({
    where: {
      id,
    },
  });

  return new NextResponse(null, {
    status: 204,
  });
}
