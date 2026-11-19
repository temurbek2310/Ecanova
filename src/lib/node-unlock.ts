import type { MilestoneCelebrationEvent } from './celebrations';
import type { LocaleCode } from '../shared/types';

export type NodeUnlockSubject = 'Economics' | 'Mathematics' | 'Business' | 'System';

export interface CompetencyNodeUnlock {
  id: string;
  nodeCode: string;
  subject: NodeUnlockSubject;
  title: string;
  subtitle: string;
  metricBadge?: string;
}

export interface NodeArtifactStyleSpec {
  subject: NodeUnlockSubject;
  primaryHex: string;
  secondaryHex: string;
  shadowHex: string;
  accentLabel: string;
}

export const SYNC_HUD_DURATION_MS = 2000;
export const SYNC_HUD_COMPLETE_HOLD_MS = 1400;
export const SYNC_HUD_CONFLICT_RETRY_MS = 1300;

export const SYNC_HUD_MESSAGES = {
  offline: '[ UPLINK OFFLINE :: LOCAL BUFFER ACTIVE ]',
  syncing: '[ UPLINK REESTABLISHED :: RECONCILING DATA... ]',
  synced: '[ RECONCILIATION: COMPLETE ]',
  complete: '[ RECONCILIATION: COMPLETE ]',
  conflict: '[ SYNC CONFLICT :: RETRYING ]',
} as const;

export type SyncStatusPhase =
  | 'idle'
  | 'offline'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'exiting';

/**
 * Determines how the SyncStatusHUD transitions on network online/offline events.
 */
export function resolveNetworkTransition(params: {
  wasOffline: boolean;
  isNowOnline: boolean;
}): 'enter_offline' | 'start_sync' | 'none' {
  if (!params.isNowOnline) {
    return 'enter_offline';
  }
  if (params.wasOffline && params.isNowOnline) {
    return 'start_sync';
  }
  return 'none';
}

const SCRAMBLE_CHARSET = '0123456789ABCDEFΣΔΛΨΩ#%&/+=*';

/**
 * Generates a deterministic cryptographic scramble string for a given reveal progress [0, 1].
 * Characters up to `floor(progress * length)` lock to the real characters while remaining
 * non-space characters cycle rapidly through academic/cryptographic glyphs.
 */
export function computeCryptographicScrambleFrame(
  targetText: string,
  progress: number,
  tickSeed: number = 0
): string {
  const cleanTarget = targetText.toUpperCase();
  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (clampedProgress >= 1) {
    return cleanTarget;
  }

  const lockedCount = Math.floor(cleanTarget.length * clampedProgress);
  const seedBase = Math.abs(Math.round(tickSeed));

  let out = '';
  for (let i = 0; i < cleanTarget.length; i += 1) {
    const ch = cleanTarget[i]!;
    if (ch === ' ' || ch === ':' || ch === '-' || ch === '·') {
      out += ch;
      continue;
    }
    if (i < lockedCount) {
      out += ch;
      continue;
    }
    const glyphIdx = (seedBase + i * 7 + (ch.charCodeAt(0) % 13)) % SCRAMBLE_CHARSET.length;
    out += SCRAMBLE_CHARSET[glyphIdx]!;
  }
  return out;
}

export function resolveNodeArtifactSpec(subject: NodeUnlockSubject): NodeArtifactStyleSpec {
  switch (subject) {
    case 'Economics':
      return {
        subject: 'Economics',
        primaryHex: '#5DE1D2',
        secondaryHex: '#9274FF',
        shadowHex: '#9274FF',
        accentLabel: 'MACRO // EQUILIBRIUM NODE',
      };
    case 'Mathematics':
      return {
        subject: 'Mathematics',
        primaryHex: '#9274FF',
        secondaryHex: '#5DE1D2',
        shadowHex: '#9274FF',
        accentLabel: 'QUANT // ANALYTIC NODE',
      };
    case 'Business':
      return {
        subject: 'Business',
        primaryHex: '#6FE0A1',
        secondaryHex: '#5DE1D2',
        shadowHex: '#9274FF',
        accentLabel: 'CAPITAL // STRATEGY NODE',
      };
    case 'System':
    default:
      return {
        subject: 'System',
        primaryHex: '#5DE1D2',
        secondaryHex: '#6FE0A1',
        shadowHex: '#9274FF',
        accentLabel: 'SYSTEM // MILESTONE NODE',
      };
  }
}

export function inferSubjectFromMilestoneId(id: string): NodeUnlockSubject {
  const lower = id.toLowerCase();
  if (lower.includes('math') || lower.includes('calc') || lower.includes('linalg')) {
    return 'Mathematics';
  }
  if (lower.includes('biz') || lower.includes('venture') || lower.includes('val')) {
    return 'Business';
  }
  if (lower.includes('econ') || lower.includes('macro') || lower.includes('metric')) {
    return 'Economics';
  }
  return 'System';
}

export function mapMilestoneToNodeUnlock(
  event: MilestoneCelebrationEvent,
  locale: LocaleCode = 'en'
): CompetencyNodeUnlock {
  const isUz = locale === 'uz';
  const subject = inferSubjectFromMilestoneId(event.id);

  if (event.kind === 'course_completed') {
    const titleBySubject: Record<NodeUnlockSubject, string> = {
      Economics: isUz ? 'BOZOR MUVOZANATI O‘ZLASHTIRILDI' : 'MARKET EQUILIBRIUM MASTERED',
      Mathematics: isUz ? 'ANALITIK OPTIMALLASHTIRISH TASDIQLANDI' : 'CONSTRAINED OPTIMA MASTERED',
      Business: isUz ? 'KAPITAL TAQSIMOTI TUGALLANDI' : 'UNIT ECONOMICS MASTERED',
      System: isUz ? 'KURSIYA MODULI TASDIQLANDI' : 'CURRICULUM NODE VERIFIED',
    };
    return {
      id: event.id,
      nodeCode: `NODE-${subject.slice(0, 4).toUpperCase()}-100`,
      subject,
      title: titleBySubject[subject],
      subtitle: event.subtitle,
      metricBadge: isUz ? 'YAKUNIY IMTIHON · TASDIQLANDI' : 'ASSESSMENT // CRYPTO-VERIFIED',
    };
  }

  if (event.kind === 'streak_reached') {
    return {
      id: event.id,
      nodeCode: 'NODE-CADENCE-STRK',
      subject: 'System',
      title: isUz ? 'UZLUKSIZ O‘QUV RITMI FAOLLASHDI' : 'STUDY CADENCE PROTOCOL LOCKED',
      subtitle: event.subtitle,
      metricBadge: event.title.toUpperCase(),
    };
  }

  if (event.kind === 'daily_goal_reached') {
    return {
      id: event.id,
      nodeCode: 'NODE-QUOTA-24H',
      subject: 'Mathematics',
      title: isUz ? 'KUNLIK KVOTA BAJARILDI' : 'DAILY QUANTUM QUOTA VERIFIED',
      subtitle: event.subtitle,
      metricBadge: isUz ? 'KUNLIK MAQSAD · 100%' : 'DAILY TARGET // 100%',
    };
  }

  return {
    id: event.id,
    nodeCode: 'NODE-COMPETENCY-01',
    subject,
    title: isUz ? 'YANGI KOMPETENSIYA TUGUNI OCHILDI' : 'COMPETENCY NODE INITIALIZED',
    subtitle: event.subtitle,
    metricBadge: event.title.toUpperCase(),
  };
}
