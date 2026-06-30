import { NextResponse } from "next/server";
import { getMatchById } from "@/lib/queries";

// GET /api/matches/:id — матч с играми, статистикой и стримами.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  return NextResponse.json({ match });
}
