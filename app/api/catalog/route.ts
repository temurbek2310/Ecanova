import { NextResponse } from 'next/server';
import { MVP_CATALOG_COURSES } from '../../../src/lib/mvp-api-stubs';

export async function GET() {
  return NextResponse.json(MVP_CATALOG_COURSES);
}
