import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export async function assertBoardOwnership(
  boardId: string,
  userId: string,
): Promise<boolean> {
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      ownerId: userId,
    },
    select: {
      id: true,
    },
  });

  return Boolean(board);
}

export function getRequestJson<T>(request: NextRequest): Promise<T> {
  return request.json() as Promise<T>;
}
