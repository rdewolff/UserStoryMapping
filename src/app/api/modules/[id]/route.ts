import { NextRequest, NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { moduleUpdateSchema } from "@/lib/schemas";
import { serializeModule } from "@/lib/serializers";
import { isAllowedOrigin } from "@/lib/security";

type ModuleRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: ModuleRouteContext,
): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const moduleRecord = await prisma.module.findUnique({
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

  if (!moduleRecord || moduleRecord.board.ownerId !== user.id) {
    return jsonError("NOT_FOUND", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = moduleUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", 400, parsed.error.flatten());
  }

  if (moduleRecord.version !== parsed.data.version) {
    return jsonError("VERSION_CONFLICT", 409);
  }

  const updatedModule = await prisma.module.update({
    where: {
      id,
    },
    data: {
      name: parsed.data.name,
      version: {
        increment: 1,
      },
    },
  });

  return NextResponse.json({
    module: serializeModule(updatedModule),
  });
}

export async function DELETE(
  request: NextRequest,
  context: ModuleRouteContext,
): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return jsonError("FORBIDDEN_ORIGIN", 403);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const { id } = await context.params;

  const moduleRecord = await prisma.module.findUnique({
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

  if (!moduleRecord || moduleRecord.board.ownerId !== user.id) {
    return jsonError("NOT_FOUND", 404);
  }

  await prisma.module.delete({
    where: {
      id,
    },
  });

  return new NextResponse(null, {
    status: 204,
  });
}
