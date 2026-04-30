import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const devs = await prisma.developer.findMany({ orderBy: { fullName: "asc" } });
    return NextResponse.json(devs);
  } catch (error) {
    console.error("[GET /api/developers]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const dev = await prisma.developer.create({ data: { fullName, email } });
    return NextResponse.json(dev, { status: 201 });
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002")
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    console.error("[POST /api/developers]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
