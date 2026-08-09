// GET /api/v1/profile/usage
import { NextResponse } from "next/server";
import { fixtureProfileUsage } from "@legalir/testing";

export async function GET() {
  return NextResponse.json({ data: fixtureProfileUsage });
}
