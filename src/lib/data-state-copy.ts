/**
 * Copy for honest error / empty states (no sample data fallbacks).
 * EN/UZ live in the i18n dictionary; RU is kept here (the app has no RU
 * locale yet), mirroring the Level Check and Product Tour copy pattern.
 */
import enMessages from '../messages/en.json';
import uzMessages from '../messages/uz.json';
import type { LocaleCode } from '../shared/types';

export type DataStateCopy = typeof enMessages.dataState;

export const DATA_STATE_COPY_RU: DataStateCopy = {
  catalogErrorTitle: 'Каталог курсов недоступен',
  catalogErrorBody: 'Не удалось подключиться к учебной базе данных. Ваш прогресс сохранён — попробуйте ещё раз чуть позже.',
  catalogEmptyTitle: 'Опубликованных курсов пока нет',
  catalogEmptyBody: 'Новые курсы появятся здесь сразу после публикации.',
  leaderboardErrorTitle: 'Рейтинг недоступен',
  leaderboardErrorBody: 'Сейчас не удалось загрузить рейтинг.',
  leaderboardEmptyTitle: 'На этой неделе в рейтинге пока никого нет',
  leaderboardEmptyBody: 'Пройдите урок или сдайте тест, чтобы попасть в таблицу.',
  progressErrorTitle: 'Не удалось загрузить ваш прогресс',
  progressErrorBody: 'XP, серия и сертификаты появятся, как только соединение восстановится.',
  weaknessEmptyTitle: 'Слабые места пока не выявлены',
  weaknessEmptyBody: 'Пройдите тест по курсу — и мы подскажем, что именно повторить.',
  radarEmptyTitle: 'Недостаточно данных для радара освоения',
  radarEmptyBody: 'Запишитесь на курс и пройдите оценивание, чтобы увидеть свой профиль освоения.',
  anonymousLearner: 'Анонимный учащийся',
  retry: 'Повторить',
  loadingValue: '—',
};

export function getDataStateCopy(locale: LocaleCode | 'ru' | string): DataStateCopy {
  const normalized = (locale || '').toLowerCase().trim();
  if (normalized === 'ru') return DATA_STATE_COPY_RU;
  if (normalized === 'uz') return (uzMessages as { dataState: DataStateCopy }).dataState;
  return enMessages.dataState;
}
