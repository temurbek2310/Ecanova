import { NextResponse } from 'next/server';
import { buildAuthMePayload } from '../../../../src/lib/mvp-api-stubs';

export async function GET() {
  return NextResponse.json(buildAuthMePayload());
}
