import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    id: 'guest_1',
    name: 'Guest Explorer',
    role: 'student',
  });
}
