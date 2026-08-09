import { NextResponse } from 'next/server';
import { fixtureDashboard } from '@legalir/testing';

export async function GET() {
  const data = {
    items: fixtureDashboard.recentActivity,
    pagination: { page: 1, pageSize: 10, total: fixtureDashboard.recentActivity.length, totalPages: 1 },
  };
  return NextResponse.json({ data });
}
