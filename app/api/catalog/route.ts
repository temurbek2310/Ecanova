import { NextResponse } from 'next/server';
import { buildCatalogPayload } from '../../../src/lib/mvp-api-stubs';

export async function GET() {
  return NextResponse.json(buildCatalogPayload());
}
