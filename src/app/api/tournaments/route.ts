import { NextResponse } from "next/server";
import { getTournaments } from "@/lib/queries";

// GET /api/tournaments — список турниров.
export async function GET() {
  const tournaments = await getTournaments();
  return NextResponse.json({ tournaments });
}
