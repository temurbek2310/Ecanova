import type {
  CourseEditionSummary,
  EditorialSignoffType,
  EditorialStatus,
  SegmentReviewRequest,
  UserRole,
} from '../../shared/types';
import { apiFetch } from '../../lib/auth-client';

/** Shapes returned by the `/api/admin/*` endpoints in server.ts. */

export type ModerationStatus = 'open' | 'investigating' | 'resolved';

export interface AdminKpis {
  editions: {
    draft: number;
    inReview: number;
    approved: number;
    published: number;
    retired: number;
    total: number;
  };
  moderation: {
    openReports: number;
    investigatingReports: number;
    openReviewRequests: number;
    investigatingReviewRequests: number;
  };
  users: { total: number; admins: number; learners: number };
  certificates: { valid: number; revoked: number };
  xp: { totalNonCashXpIssued: number; validEntriesCount: number };
}

export interface AdminAuditEvent {
  id: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface AdminOverviewResponse {
  kpis: AdminKpis;
  recentAuditEvents: AdminAuditEvent[];
}

export type AdminEdition = CourseEditionSummary & { subject: string; level: string };

export interface AdminIssueReport {
  id: string;
  courseId: string | null;
  lessonId: string | null;
  segmentHeading: string | null;
  category: string;
  description: string;
  status: ModerationStatus;
  resolutionNote: string | null;
  createdAt: string;
}

export interface AdminModerationResponse {
  status: ModerationStatus | 'all';
  reports: AdminIssueReport[];
  reviewRequests: SegmentReviewRequest[];
}

export interface AdminCertificate {
  id: string;
  userId: string | null;
  recipientDisplayName: string;
  courseTitle: string;
  locale: string;
  publicToken: string;
  status: 'valid' | 'revoked';
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface AdminAuditResponse {
  events: AdminAuditEvent[];
  actions: string[];
  targetTypes: string[];
}

/** Fetches an admin endpoint and throws an Error carrying the server's message. */
export async function adminRequest<T>(
  url: string,
  init?: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown }
): Promise<T> {
  const res = await apiFetch(url, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status}).`);
  }
  return json;
}

export function buildQuery(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export interface EditionTransitionRequest {
  nextStatus: EditorialStatus;
  signoffType?: EditorialSignoffType;
  signoffs?: EditorialSignoffType[];
}

export function formatAdminDate(iso: string, locale: 'en' | 'uz'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === 'uz' ? 'uz-UZ' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
