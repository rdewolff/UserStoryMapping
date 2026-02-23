import { NextRequest, NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth";
import { jsonError, normalizeNullableText } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { boardCreateSchema } from "@/lib/schemas";
import { serializeBoard } from "@/lib/serializers";
import { isAllowedOrigin } from "@/lib/security";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const boards = await prisma.board.findMany({
    where: {
      ownerId: user.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return NextResponse.json({
    boards: boards.map(serializeBoard),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = boardCreateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const board = await prisma.board.create({
    data: {
      ownerId: user.id,
      name: parsed.data.name,
      description: normalizeNullableText(parsed.data.description),
    },
  });

  return NextResponse.json(
    {
      board: serializeBoard(board),
    },
    {
      status: 201,
    },
  );
}
