export const DEFAULT_DAILY_GOAL_MINUTES = 30;
export const MIN_DAILY_GOAL_MINUTES = 5;
export const MAX_DAILY_GOAL_MINUTES = 480;
export const DAILY_GOAL_PRESETS = [15, 30, 45, 60] as const;

export const DAILY_GOAL_STORAGE_KEY = 'econova_daily_goal_minutes';

export interface DailyGoalParseResult {
  valid: boolean;
  value: number;
  error?: string;
}

export function parseDailyGoalMinutes(raw: unknown): DailyGoalParseResult {
  if (typeof raw === 'string' && raw.trim().length === 0) {
    return {
      valid: false,
      value: DEFAULT_DAILY_GOAL_MINUTES,
      error: `Enter a goal between ${MIN_DAILY_GOAL_MINUTES} and ${MAX_DAILY_GOAL_MINUTES} minutes.`,
    };
  }

  const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return {
      valid: false,
      value: DEFAULT_DAILY_GOAL_MINUTES,
      error: 'Daily study goal must be a whole number of minutes.',
    };
  }

  if (num < MIN_DAILY_GOAL_MINUTES || num > MAX_DAILY_GOAL_MINUTES) {
    return {
      valid: false,
      value: DEFAULT_DAILY_GOAL_MINUTES,
      error: `Daily study goal must be between ${MIN_DAILY_GOAL_MINUTES} and ${MAX_DAILY_GOAL_MINUTES} minutes.`,
    };
  }

  return { valid: true, value: num };
}

export function sanitizeDailyGoalMinutes(raw: unknown): number {
  const parsed = parseDailyGoalMinutes(raw);
  return parsed.valid ? parsed.value : DEFAULT_DAILY_GOAL_MINUTES;
}

export interface DailyGoalProgressInput {
  completedMinutes: number;
  targetMinutes: number;
  radius: number;
}

export interface DailyGoalProgress {
  completedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  rawPercent: number;
  percent: number;
  goalMet: boolean;
  circumference: number;
  strokeDashoffset: number;
}

export function evaluateDailyGoalProgress(
  input: DailyGoalProgressInput
): DailyGoalProgress {
  const safeTarget = sanitizeDailyGoalMinutes(input.targetMinutes);
  const safeCompleted = Number.isFinite(input.completedMinutes)
    ? Math.max(0, Math.round(input.completedMinutes))
    : 0;
  const safeRadius = Number.isFinite(input.radius) && input.radius > 0 ? input.radius : 56;

  const rawPercent = Math.round((safeCompleted / safeTarget) * 100);
  const percent = Math.min(100, Math.max(0, rawPercent));
  const remainingMinutes = Math.max(0, safeTarget - safeCompleted);
  const goalMet = safeCompleted >= safeTarget;

  const circumference = Number((2 * Math.PI * safeRadius).toFixed(4));
  const progressRatio = Math.min(1, Math.max(0, safeCompleted / safeTarget));
  const strokeDashoffset = Number((circumference * (1 - progressRatio)).toFixed(4));

  return {
    completedMinutes: safeCompleted,
    targetMinutes: safeTarget,
    remainingMinutes,
    rawPercent,
    percent,
    goalMet,
    circumference,
    strokeDashoffset,
  };
}

export function loadSavedDailyGoalMinutes(): number {
  if (typeof window === 'undefined') return DEFAULT_DAILY_GOAL_MINUTES;
  try {
    const raw = window.localStorage.getItem(DAILY_GOAL_STORAGE_KEY);
    if (!raw) return DEFAULT_DAILY_GOAL_MINUTES;
    return sanitizeDailyGoalMinutes(raw);
  } catch {
    return DEFAULT_DAILY_GOAL_MINUTES;
  }
}

export function saveDailyGoalMinutes(minutes: number): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = sanitizeDailyGoalMinutes(minutes);
    window.localStorage.setItem(DAILY_GOAL_STORAGE_KEY, String(clean));
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}
