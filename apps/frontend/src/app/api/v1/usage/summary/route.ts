import { NextResponse } from 'next/server';
import { fixtureEntitlements } from '@legalir/testing';

export async function GET() {
  const data = {
    entitlements: fixtureEntitlements,
    periodEnd: new Date(Date.now() + 23 * 86400000).toISOString(),
    daysRemaining: 23,
  };
  return NextResponse.json({ data });
}
