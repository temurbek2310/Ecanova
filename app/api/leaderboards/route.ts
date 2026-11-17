import { NextResponse } from 'next/server';
import { buildLeaderboardsPayload } from '../../../src/lib/mvp-api-stubs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url, 'http://localhost:3000');
  const courseId = searchParams.get('courseId') ?? 'all';
  return NextResponse.json(buildLeaderboardsPayload(courseId));
}
