import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/health — connection diagnostic */
export async function GET() {
  const rawUrl = process.env.DATABASE_URL ?? "(not set)";
  const maskedUrl = rawUrl.replace(/:([^@]+)@/, ":***@");

  try {
    const count = await prisma.processDefinition.count();
    return NextResponse.json({
      status: "ok",
      databaseUrl: maskedUrl,
      processDefinitionCount: count,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "error",
        databaseUrl: maskedUrl,
        error: message,
      },
      { status: 500 }
    );
  }
}
