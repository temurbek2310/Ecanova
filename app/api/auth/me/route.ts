import { NextResponse } from 'next/server';

// Not served today: the Express server (server.ts) owns /api/auth/me.
// Kept signed-out so a future Next.js deployment can never hand out a mock identity.
export async function GET() {
  return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } });
}
