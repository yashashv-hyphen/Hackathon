import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("[gemini/rewrite] POST start");
  const { code, instruction } = await req.json();
  console.log("[gemini/rewrite] payload", {
    codeLength: typeof code === "string" ? code.length : 0,
    hasInstruction: Boolean(instruction),
  });
  return NextResponse.json({
    rewritten: "# AI rewrite not yet configured. Set GOOGLE_GEMINI_API_KEY.",
  });
}
