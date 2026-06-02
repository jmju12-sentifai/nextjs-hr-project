import { NextRequest, NextResponse } from "next/server";
import { run } from "app-renderer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { schema } = await req.json();
    if (!schema) return NextResponse.json({ error: "schema 누락" }, { status: 400 });
    const result = run(schema);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "logic error" }, { status: 500 });
  }
}
