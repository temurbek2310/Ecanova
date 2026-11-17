import type { LocaleCode } from '../shared/types';

export interface ProgressShareInput {
  xpToday: number;
  currentStreak: number;
  locale: LocaleCode;
  url: string;
}

export interface ProgressSharePayload {
  title: string;
  text: string;
  url: string;
}

export interface ShareDispatchResult {
  ok: boolean;
  method?: 'web-share' | 'clipboard';
  cancelled?: boolean;
  reason?: string;
}

export function buildProgressShareData(input: ProgressShareInput): ProgressSharePayload {
  const safeXpToday = Number.isFinite(input.xpToday) ? Math.max(0, Math.round(input.xpToday)) : 0;
  const safeStreak = Number.isFinite(input.currentStreak)
    ? Math.max(0, Math.round(input.currentStreak))
    : 0;

  if (input.locale === 'uz') {
    const title = 'ECONOVA · O‘quv natijam';
    let text = '';
    if (safeXpToday > 0 && safeStreak > 0) {
      text = `Bugun ECONOVA platformasida +${safeXpToday} XP to‘pladim va ${safeStreak} kunlik o‘qish seriyasiga erishdim!`;
    } else if (safeXpToday > 0) {
      text = `Bugun ECONOVA platformasida +${safeXpToday} XP o‘quv natijasini qo‘lga kiritdim!`;
    } else if (safeStreak > 0) {
      text = `ECONOVA platformasida ${safeStreak} kunlik uzluksiz o‘qish seriyam davom etmoqda!`;
    } else {
      text = `ECONOVA platformasida Iqtisodiyot, Matematika va Biznes bo‘yicha kunlik o‘quv maqsadlarimni kuzatib boryapman (${safeXpToday} XP bugun, ${safeStreak} kunlik seriya).`;
    }
    return { title, text, url: input.url };
  }

  const title = 'ECONOVA · My Study Progress';
  let text = '';
  if (safeXpToday > 0 && safeStreak > 0) {
    text = `I earned +${safeXpToday} non-cash XP today and reached a ${safeStreak}-day study streak on ECONOVA!`;
  } else if (safeXpToday > 0) {
    text = `I earned +${safeXpToday} non-cash XP today studying on ECONOVA!`;
  } else if (safeStreak > 0) {
    text = `I'm on a ${safeStreak}-day study streak on ECONOVA!`;
  } else {
    text = `I'm tracking my daily Economics, Mathematics, and Business study progress on ECONOVA (${safeXpToday} XP today, ${safeStreak}-day streak).`;
  }

  return { title, text, url: input.url };
}

export interface LessonShareInput {
  courseTitle: string;
  lessonTitle: string;
  locale: LocaleCode;
  url: string;
}

export function buildLessonShareData(input: LessonShareInput): ProgressSharePayload {
  const cleanCourse = input.courseTitle.trim() || 'ECONOVA Course';
  const cleanLesson = input.lessonTitle.trim() || 'Lesson';

  if (input.locale === 'uz') {
    return {
      title: `${cleanCourse} — ${cleanLesson}`,
      text: `ECONOVA platformasida "${cleanCourse}" kursining "${cleanLesson}" darsini o‘rganmoqdaman!`,
      url: input.url,
    };
  }

  return {
    title: `${cleanCourse} — ${cleanLesson}`,
    text: `I'm studying "${cleanLesson}" in ${cleanCourse} on ECONOVA!`,
    url: input.url,
  };
}

export async function shareProgressWithWebApi(
  payload: ProgressSharePayload
): Promise<ShareDispatchResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return { ok: true, method: 'web-share' };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, cancelled: true, method: 'web-share' };
      }
      // Fall through to clipboard fallback if Web Share throws NotAllowedError/TypeError
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(`${payload.text} ${payload.url}`.trim());
      return { ok: true, method: 'clipboard' };
    } catch {
      return { ok: false, reason: 'Clipboard permission denied.' };
    }
  }

  return { ok: false, reason: 'Web Share API and clipboard are unavailable.' };
}
