import { NextResponse } from 'next/server';
import { fixtureDashboard } from '@legalir/testing';

export async function GET() {
  return NextResponse.json({ data: fixtureDashboard });
}
