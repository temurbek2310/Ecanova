import { NextResponse } from 'next/server';
import { buildHealthPayload } from '../../../src/lib/mvp-api-stubs';

export async function GET() {
  return NextResponse.json({
    ...buildHealthPayload(new Date()),
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
