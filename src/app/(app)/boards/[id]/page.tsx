import { notFound } from "next/navigation";

import { BoardClient } from "@/components/board/board-client";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeBoard, serializeCard, serializeModule } from "@/lib/serializers";

type BoardPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const user = await requirePageUser();
  const { id } = await params;

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
    notFound();
  }

  return (
    <BoardClient
      initialBoard={serializeBoard(board)}
      initialCards={board.cards.map(serializeCard)}
      initialModules={board.modules.map(serializeModule)}
      userEmail={user.email}
    />
  );
}
