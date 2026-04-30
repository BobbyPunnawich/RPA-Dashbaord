import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const devId = parseInt(id, 10);
  if (isNaN(devId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: { fullName?: string; email?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const fullName = body.fullName?.trim();
  const email    = body.email?.trim().toLowerCase();
  if (!fullName) return NextResponse.json({ error: "fullName is required" }, { status: 422 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Valid email is required" }, { status: 422 });

  try {
    const dev = await prisma.developer.update({ where: { id: devId }, data: { fullName, email } });
    return NextResponse.json(dev);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002")
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    console.error("[PUT /api/developers]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const devId = parseInt(id, 10);
  if (isNaN(devId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await prisma.developer.delete({ where: { id: devId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/developers]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
