import { NextResponse } from "next/server";
import { getTalkIndex } from "@/lib/data";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(getTalkIndex());
}
