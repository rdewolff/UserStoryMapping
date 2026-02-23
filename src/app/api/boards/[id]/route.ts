import { NextRequest, NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth";
import { assertBoardOwnership } from "@/lib/api";
import { jsonError, normalizeNullableText } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { boardUpdateSchema } from "@/lib/schemas";
import { serializeBoard, serializeCard, serializeModule } from "@/lib/serializers";
import { isAllowedOrigin } from "@/lib/security";

type BoardRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: BoardRouteContext,
): Promise<NextResponse> {
  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const board = await prisma.board.findFirst({
    where: {
      id,
      ownerId: user.id,
    },
    include: {
      modules: {
        orderBy: {
          position: "asc",
        },
      },
      cards: {
        orderBy: [{ moduleId: "asc" }, { priorityLane: "asc" }, { position: "asc" }],
      },
    },
  });

  if (!board) {
    return jsonError("NOT_FOUND", 404);
  }

  return NextResponse.json({
    board: serializeBoard(board),
    modules: board.modules.map(serializeModule),
    cards: board.cards.map(serializeCard),
  });
}

export async function PATCH(
  request: NextRequest,
  context: BoardRouteContext,
): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const isOwner = await assertBoardOwnership(id, user.id);
  if (!isOwner) {
    return jsonError("NOT_FOUND", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = boardUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const current = await prisma.board.findUnique({
    where: { id },
    select: {
      version: true,
    },
  });

  if (!current) {
    return jsonError("NOT_FOUND", 404);
  }

  if (current.version !== parsed.data.version) {
    return jsonError("VERSION_CONFLICT", 409);
  }

  const board = await prisma.board.update({
    where: {
      id,
    },
    data: {
      name: parsed.data.name,
      description:
        parsed.data.description === undefined
          ? undefined
          : normalizeNullableText(parsed.data.description),
      version: {
        increment: 1,
      },
    },
  });

  return NextResponse.json({
    board: serializeBoard(board),
  });
}

export async function DELETE(
  request: NextRequest,
  context: BoardRouteContext,
): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;
  const isOwner = await assertBoardOwnership(id, user.id);
  if (!isOwner) {
    return jsonError("NOT_FOUND", 404);
  }

  await prisma.board.delete({
    where: {
      id,
    },
  });

  return new NextResponse(null, {
    status: 204,
  });
}
