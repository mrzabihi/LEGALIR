import { NextResponse } from 'next/server';
import { fixtureUserPro, fixtureProfileComplete } from '@legalir/testing';

export async function GET() {
  const data = {
    user: fixtureUserPro,
    profile: fixtureProfileComplete,
    preferences: { theme: 'light', locale: 'fa-IR', notifications: { appointments: true, contractExpiry: true, lawyerResponse: false, paymentStatus: true, caseUpdate: true, marketing: false } },
    role: 'user',
  };
  return NextResponse.json({ data });
}
