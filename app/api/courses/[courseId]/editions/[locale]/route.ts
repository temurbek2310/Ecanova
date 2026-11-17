import { NextResponse } from 'next/server';
import { buildCourseDetailPayload } from '@/src/lib/mvp-api-stubs';
import type { LocaleCode } from '@/src/shared/types';

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string; locale: string }> | { courseId: string; locale: string } }
) {
  const resolvedParams = await Promise.resolve(context.params);
  const { courseId, locale } = resolvedParams;

  const targetLocale = (locale === 'uz' ? 'uz' : 'en') as LocaleCode;
  const payload = buildCourseDetailPayload(courseId, targetLocale);

  if (!payload) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  return NextResponse.json(payload);
}
