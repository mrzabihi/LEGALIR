import { NextResponse } from 'next/server';
import { fixtureProfileComplete } from '@legalir/testing';

let profile = { ...fixtureProfileComplete };

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  profile = { ...profile, ...body };
  return NextResponse.json({ data: profile });
}
