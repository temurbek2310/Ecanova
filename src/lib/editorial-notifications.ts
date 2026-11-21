import type { EditorialSignoffType, EditorialStatus } from '../shared/types';
import type { NotificationCopy } from './notification-copy';

/**
 * Maps a successful Editorial Studio transition to the toast the staff member
 * sees, distinguishing sign-offs, Restore to Approved, publish and retire from
 * ordinary status moves.
 */
export function describeEditorialTransitionOutcome(params: {
  copy: NotificationCopy;
  statusLabel: string;
  previousStatus: EditorialStatus | null;
  nextStatus: EditorialStatus;
  signoffType: EditorialSignoffType | null;
}): { title: string; message: string | null } {
  const { copy, statusLabel, previousStatus, nextStatus, signoffType } = params;
  if (signoffType) {
    return { title: copy.editorial.signoffRecorded(statusLabel), message: null };
  }
  if (nextStatus === 'approved' && previousStatus === 'retired') {
    return { title: copy.editorial.restored, message: null };
  }
  if (nextStatus === 'published') {
    return { title: copy.editorial.published, message: null };
  }
  if (nextStatus === 'retired') {
    return { title: copy.editorial.retired, message: null };
  }
  return { title: copy.editorial.transitioned(statusLabel), message: null };
}
