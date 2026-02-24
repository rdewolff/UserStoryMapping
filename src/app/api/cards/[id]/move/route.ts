import { NextRequest, NextResponse } from "next/server";

import { PriorityLane } from "@/generated/prisma/enums";
import { getRequestUser } from "@/lib/auth";
import { applyMoveByIds, positionUpdates } from "@/lib/board-move";
import { LANE_TO_DB } from "@/lib/constants";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { moveCardSchema } from "@/lib/schemas";
import { serializeCard } from "@/lib/serializers";
import { isAllowedOrigin } from "@/lib/security";

type CardRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function containerKey(moduleId: string, lane: string): string {
  return `${moduleId}::${lane}`;
}

export async function POST(
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

  const body = await request.json().catch(() => null);
  const parsed = moveCardSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const card = await prisma.card.findUnique({
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

  if (!card || card.board.ownerId !== user.id) {
    return jsonError("NOT_FOUND", 404);
  }

  if (card.version !== parsed.data.version) {
    return jsonError("VERSION_CONFLICT", 409);
  }

  const targetModule = await prisma.module.findFirst({
    where: {
      id: parsed.data.targetModuleId,
      boardId: card.boardId,
    },
    select: {
      id: true,
    },
  });

  if (!targetModule) {
    return jsonError("INVALID_MODULE", 400);
  }

  const sourceLane = card.priorityLane;
  const targetLane = LANE_TO_DB[parsed.data.targetLane] as PriorityLane;

  const sourceCards = await prisma.card.findMany({
    where: {
      moduleId: card.moduleId,
      priorityLane: sourceLane,
    },
    orderBy: {
      position: "asc",
    },
    select: {
      id: true,
    },
  });

  const sameContainer =
    card.moduleId === targetModule.id &&
    sourceLane === targetLane;

  const targetCards = sameContainer
    ? sourceCards
    : await prisma.card.findMany({
        where: {
          moduleId: targetModule.id,
          priorityLane: targetLane,
        },
        orderBy: {
          position: "asc",
        },
        select: {
          id: true,
        },
      });

  const moveResult = applyMoveByIds({
    sourceIds: sourceCards.map((entry) => entry.id),
    targetIds: targetCards.map((entry) => entry.id),
    cardId: card.id,
    targetIndex: parsed.data.targetPosition,
    sourceContainer: containerKey(card.moduleId, sourceLane),
    targetContainer: containerKey(targetModule.id, targetLane),
  });

  const sourceUpdates = positionUpdates(moveResult.sourceIds);
  const targetUpdates = positionUpdates(moveResult.targetIds);

  const affectedIds = Array.from(
    new Set([
      card.id,
      ...moveResult.sourceIds,
      ...moveResult.targetIds,
    ]),
  );

  await prisma.$transaction(async (tx) => {
    if (affectedIds.length > 0) {
      await tx.card.updateMany({
        where: {
          id: {
            in: affectedIds,
          },
        },
        data: {
          position: {
            increment: 10_000,
          },
        },
      });
    }

    if (sameContainer) {
      for (const update of targetUpdates) {
        await tx.card.update({
          where: {
            id: update.id,
          },
          data: {
            moduleId: targetModule.id,
            priorityLane: targetLane,
            position: update.position,
            version: {
              increment: 1,
            },
          },
        });
      }
      return;
    }

    for (const update of sourceUpdates) {
      await tx.card.update({
        where: {
          id: update.id,
        },
        data: {
          moduleId: card.moduleId,
          priorityLane: sourceLane,
          position: update.position,
          version: {
            increment: 1,
          },
        },
      });
    }

    for (const update of targetUpdates) {
      await tx.card.update({
        where: {
          id: update.id,
        },
        data: {
          moduleId: targetModule.id,
          priorityLane: targetLane,
          position: update.position,
          version: {
            increment: 1,
          },
        },
      });
    }
  });

  const updatedCards = await prisma.card.findMany({
    where: {
      id: {
        in: affectedIds,
      },
    },
  });

  return NextResponse.json({
    cards: updatedCards.map(serializeCard),
  });
}
