import { NextRequest, NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getRequestUser(request);

  if (!user) {
    return jsonError("UNAUTHORIZED", 401);
  }

  return NextResponse.json({
    user,
  });
}
