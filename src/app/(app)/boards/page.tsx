import { BoardsHome } from "@/components/board/boards-home";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeBoard } from "@/lib/serializers";

export default async function BoardsPage() {
  const user = await requirePageUser();

  const boards = await prisma.board.findMany({
    where: {
      ownerId: user.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return <BoardsHome initialBoards={boards.map(serializeBoard)} userEmail={user.email} />;
}
