import { NextRequest, NextResponse } from "next/server";

import { Effort, PriorityLane } from "@/generated/prisma/enums";
import { getRequestUser } from "@/lib/auth";
import { assertBoardOwnership } from "@/lib/api";
import { EFFORT_TO_DB, LANE_TO_DB } from "@/lib/constants";
import { jsonError, normalizeNullableText } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { cardCreateSchema } from "@/lib/schemas";
import { serializeCard } from "@/lib/serializers";
import { isAllowedOrigin } from "@/lib/security";

type BoardRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
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

  const { id: boardId } = await context.params;

  const isOwner = await assertBoardOwnership(boardId, user.id);
  if (!isOwner) {
    return jsonError("NOT_FOUND", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = cardCreateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const moduleRecord = await prisma.module.findFirst({
    where: {
      id: parsed.data.moduleId,
      boardId,
    },
  });

  if (!moduleRecord) {
    return jsonError("INVALID_MODULE", 400);
  }

  const priorityLane = LANE_TO_DB[parsed.data.priorityLane] as PriorityLane;

  const lastCard = await prisma.card.findFirst({
    where: {
      moduleId: parsed.data.moduleId,
      priorityLane,
    },
    orderBy: {
      position: "desc",
    },
    select: {
      position: true,
    },
  });

  const card = await prisma.card.create({
    data: {
      boardId,
      moduleId: parsed.data.moduleId,
      title: parsed.data.title,
      description: normalizeNullableText(parsed.data.description),
      priorityLane,
      effort: EFFORT_TO_DB[parsed.data.effort] as Effort,
      weekTarget: normalizeNullableText(parsed.data.weekTarget),
      position: (lastCard?.position ?? -1) + 1,
    },
  });

  return NextResponse.json(
    {
      card: serializeCard(card),
    },
    {
      status: 201,
    },
  );
}
