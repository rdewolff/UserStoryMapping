import { NextRequest, NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth";
import { assertBoardOwnership } from "@/lib/api";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { moduleCreateSchema } from "@/lib/schemas";
import { serializeModule } from "@/lib/serializers";
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
  const parsed = moduleCreateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  const lastModule = await prisma.module.findFirst({
    where: {
      boardId,
    },
    orderBy: {
      position: "desc",
    },
    select: {
      position: true,
    },
  });

  const moduleRecord = await prisma.module.create({
    data: {
      boardId,
      name: parsed.data.name,
      position: (lastModule?.position ?? -1) + 1,
    },
  });

  return NextResponse.json(
    {
      module: serializeModule(moduleRecord),
    },
    {
      status: 201,
    },
  );
}
