import type { LocaleCode } from '../../shared/types';
import type { ModerationStatus } from './admin-api';

/**
 * Bilingual (en / uz Latin) copy for the admin console pages. The interface
 * keeps both locales structurally identical at compile time. Toast titles live
 * in notification-copy.ts; editorial status names come from messages/*.json.
 */
export interface AdminCopy {
  consoleTitle: string;
  consoleSubtitle: string;
  sectionNavLabel: string;
  signedInAs: string;
  loading: string;
  refresh: string;
  empty: string;
  cancel: string;
  save: string;
  search: string;
  all: string;
  overview: {
    title: string;
    subtitle: string;
    editions: string;
    published: string;
    drafts: string;
    inReview: string;
    approved: string;
    retired: string;
    moderation: string;
    openReports: string;
    openReviewRequests: string;
    users: string;
    admins: string;
    learners: string;
    certificates: string;
    valid: string;
    revoked: string;
    xp: string;
    xpIssued: string;
    xpEntries: (count: number) => string;
    quickLinks: string;
    recentActivity: string;
    viewAll: string;
  };
  curriculum: {
    title: string;
    subtitle: string;
    filterStatus: string;
    noEditions: string;
    provenance: string;
    subjectReview: string;
    languageReview: string;
    rightsReview: string;
    signed: string;
    pending: string;
    verified: string;
    missing: string;
    editDraft: string;
    editDraftTitle: string;
    titleLabel: string;
    subtitleLabel: string;
    descriptionLabel: string;
    sendToReview: string;
    signSubject: string;
    signLanguage: string;
    signRights: string;
    approveAll: string;
    approveAllHint: string;
    publish: string;
    retire: string;
    restoreApproved: string;
    backToDraft: string;
    createTitle: string;
    targetCourse: string;
    editionLocale: string;
    sourceLicense: string;
    sourceLicensePlaceholder: string;
    initialLesson: string;
    lessonTitlePlaceholder: string;
    lessonBodyPlaceholder: string;
    aiAssisted: string;
    createDraft: string;
    editionTitlePlaceholder: string;
  };
  moderation: {
    title: string;
    subtitle: string;
    statusFilter: string;
    statuses: Record<ModerationStatus, string>;
    reviewRequests: string;
    issueReports: string;
    noReviewRequests: string;
    noReports: string;
    noteLabel: string;
    notePlaceholder: string;
    markInvestigating: string;
    markResolved: string;
    reopen: string;
    existingNote: string;
  };
  users: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    usersHeading: string;
    columns: { name: string; email: string; role: string; joined: string; actions: string };
    makeAdmin: string;
    makeLearner: string;
    you: string;
    selfDemotionHint: string;
    noUsers: string;
    certificatesHeading: string;
    certificateSearchPlaceholder: string;
    noCertificates: string;
    revoke: string;
    revokeTitle: string;
    revokeBody: (recipient: string, course: string) => string;
    revokeReasonLabel: string;
    revokeReasonPlaceholder: string;
    confirmRevoke: string;
    revokedOn: string;
    certificateStatus: Record<'valid' | 'revoked', string>;
  };
  audit: {
    title: string;
    subtitle: string;
    actionFilter: string;
    targetFilter: string;
    searchPlaceholder: string;
    columns: { when: string; actor: string; action: string; target: string; reason: string };
    noEvents: string;
    system: string;
  };
}

const EN: AdminCopy = {
  consoleTitle: 'Admin Console',
  consoleSubtitle:
    'Manage curriculum, moderation, users and certificates. Every action is recorded in the audit log.',
  sectionNavLabel: 'Admin pages',
  signedInAs: 'Signed in as',
  loading: 'Loading…',
  refresh: 'Refresh',
  empty: 'Nothing here yet.',
  cancel: 'Cancel',
  save: 'Save',
  search: 'Search',
  all: 'All',
  overview: {
    title: 'Overview',
    subtitle: 'Platform health at a glance.',
    editions: 'Course editions',
    published: 'Published',
    drafts: 'Drafts',
    inReview: 'In review',
    approved: 'Approved',
    retired: 'Retired',
    moderation: 'Moderation queue',
    openReports: 'Open issue reports',
    openReviewRequests: 'Open review requests',
    users: 'Users',
    admins: 'Administrators',
    learners: 'Students',
    certificates: 'Certificates',
    valid: 'Valid',
    revoked: 'Revoked',
    xp: 'Non-cash XP',
    xpIssued: 'XP issued',
    xpEntries: (count) => `${count} valid ledger entries`,
    quickLinks: 'Quick links',
    recentActivity: 'Recent activity',
    viewAll: 'View all',
  },
  curriculum: {
    title: 'Curriculum & Editorial',
    subtitle:
      'Create and edit drafts, record sign-offs, approve, publish, retire and restore editions. Sign-offs are recorded under your account.',
    filterStatus: 'Status',
    noEditions: 'No editions match this filter.',
    provenance: 'Provenance',
    subjectReview: 'Subject',
    languageReview: 'Language',
    rightsReview: 'Rights & access',
    signed: 'signed',
    pending: 'pending',
    verified: 'verified',
    missing: 'missing',
    editDraft: 'Edit draft',
    editDraftTitle: 'Edit draft edition',
    titleLabel: 'Title',
    subtitleLabel: 'Subtitle',
    descriptionLabel: 'Description',
    sendToReview: 'Send to subject review',
    signSubject: 'Sign subject review',
    signLanguage: 'Sign language review',
    signRights: 'Sign rights & approve',
    approveAll: 'Approve (all sign-offs)',
    approveAllHint: 'Records subject, language and rights sign-offs under your account and moves the edition to Approved.',
    publish: 'Publish',
    retire: 'Retire',
    restoreApproved: 'Restore to Approved',
    backToDraft: 'Back to draft',
    createTitle: 'Create a new draft edition',
    targetCourse: 'Course',
    editionLocale: 'Edition language',
    sourceLicense: 'Source & licence basis',
    sourceLicensePlaceholder: 'Original ECONOVA note / OpenStax CC BY 4.0',
    initialLesson: 'First lesson (optional)',
    lessonTitlePlaceholder: 'Lesson title',
    lessonBodyPlaceholder: 'Lesson body or transcript draft…',
    aiAssisted: 'Mark provenance as AI-assisted (review sign-offs still required)',
    createDraft: 'Create draft',
    editionTitlePlaceholder: 'e.g. Elasticity & Consumer Welfare (v2)',
  },
  moderation: {
    title: 'Moderation',
    subtitle: 'Student segment review requests and issue reports.',
    statusFilter: 'Status',
    statuses: { open: 'Open', investigating: 'Investigating', resolved: 'Resolved' },
    reviewRequests: 'Segment review requests',
    issueReports: 'Issue reports',
    noReviewRequests: 'No review requests for this filter.',
    noReports: 'No issue reports for this filter.',
    noteLabel: 'Resolution note',
    notePlaceholder: 'Explain what was checked or changed…',
    markInvestigating: 'Investigating',
    markResolved: 'Resolve',
    reopen: 'Reopen',
    existingNote: 'Note:',
  },
  users: {
    title: 'Users & Certificates',
    subtitle: 'Search accounts, grant or remove administrator access, and revoke certificates.',
    searchPlaceholder: 'Search by name or email',
    usersHeading: 'Users',
    columns: { name: 'Name', email: 'Email', role: 'Role', joined: 'Joined', actions: 'Actions' },
    makeAdmin: 'Make admin',
    makeLearner: 'Make student',
    you: 'you',
    selfDemotionHint: 'You cannot remove your own administrator role.',
    noUsers: 'No users match this search.',
    certificatesHeading: 'Certificates',
    certificateSearchPlaceholder: 'Search recipient, course or token',
    noCertificates: 'No certificates match this search.',
    revoke: 'Revoke',
    revokeTitle: 'Revoke certificate',
    revokeBody: (recipient, course) =>
      `Revoking ${recipient}'s certificate for “${course}” makes its public verification fail. This is recorded in the audit log.`,
    revokeReasonLabel: 'Audit reason (required)',
    revokeReasonPlaceholder: 'Why is this certificate being revoked?',
    confirmRevoke: 'Revoke certificate',
    revokedOn: 'Revoked',
    certificateStatus: { valid: 'Valid', revoked: 'Revoked' },
  },
  audit: {
    title: 'Audit Log',
    subtitle: 'Every administrative action, newest first.',
    actionFilter: 'Action',
    targetFilter: 'Target type',
    searchPlaceholder: 'Search reason, target or actor',
    columns: { when: 'When', actor: 'Actor', action: 'Action', target: 'Target', reason: 'Reason' },
    noEvents: 'No audit events match these filters.',
    system: 'System',
  },
};

const UZ: AdminCopy = {
  consoleTitle: 'Admin paneli',
  consoleSubtitle:
    'O‘quv dasturi, moderatsiya, foydalanuvchilar va sertifikatlarni boshqaring. Har bir amal audit jurnaliga yoziladi.',
  sectionNavLabel: 'Admin sahifalari',
  signedInAs: 'Hisob',
  loading: 'Yuklanmoqda…',
  refresh: 'Yangilash',
  empty: 'Hozircha hech narsa yo‘q.',
  cancel: 'Bekor qilish',
  save: 'Saqlash',
  search: 'Qidirish',
  all: 'Barchasi',
  overview: {
    title: 'Umumiy ko‘rinish',
    subtitle: 'Platforma holati bir qarashda.',
    editions: 'Kurs nashrlari',
    published: 'Nashr etilgan',
    drafts: 'Qoralamalar',
    inReview: 'Ko‘rib chiqilmoqda',
    approved: 'Tasdiqlangan',
    retired: 'Nashrdan olingan',
    moderation: 'Moderatsiya navbati',
    openReports: 'Ochiq xato xabarlari',
    openReviewRequests: 'Ochiq ko‘rib chiqish so‘rovlari',
    users: 'Foydalanuvchilar',
    admins: 'Administratorlar',
    learners: 'Talabalar',
    certificates: 'Sertifikatlar',
    valid: 'Amalda',
    revoked: 'Bekor qilingan',
    xp: 'Pul bo‘lmagan XP',
    xpIssued: 'Berilgan XP',
    xpEntries: (count) => `${count} ta amaldagi yozuv`,
    quickLinks: 'Tezkor havolalar',
    recentActivity: 'So‘nggi faollik',
    viewAll: 'Barchasini ko‘rish',
  },
  curriculum: {
    title: 'O‘quv dasturi va tahririyat',
    subtitle:
      'Qoralamalarni yarating va tahrirlang, tasdiqlarni qayd eting, nashrlarni tasdiqlang, nashr eting, nashrdan oling va qayta tiklang. Tasdiqlar sizning hisobingiz nomidan yoziladi.',
    filterStatus: 'Holat',
    noEditions: 'Bu filtrga mos nashr yo‘q.',
    provenance: 'Manba',
    subjectReview: 'Mavzu',
    languageReview: 'Til',
    rightsReview: 'Huquq va qulaylik',
    signed: 'tasdiqlangan',
    pending: 'kutilmoqda',
    verified: 'tekshirilgan',
    missing: 'yo‘q',
    editDraft: 'Qoralamani tahrirlash',
    editDraftTitle: 'Qoralama nashrni tahrirlash',
    titleLabel: 'Sarlavha',
    subtitleLabel: 'Kichik sarlavha',
    descriptionLabel: 'Tavsif',
    sendToReview: 'Mavzu tekshiruviga yuborish',
    signSubject: 'Mavzu tekshiruvini tasdiqlash',
    signLanguage: 'Til tekshiruvini tasdiqlash',
    signRights: 'Huquqni tasdiqlash va ma’qullash',
    approveAll: 'Tasdiqlash (barcha imzolar)',
    approveAllHint: 'Mavzu, til va huquq tasdiqlarini sizning hisobingiz nomidan yozadi va nashrni «Tasdiqlangan» holatiga o‘tkazadi.',
    publish: 'Nashr etish',
    retire: 'Nashrdan olish',
    restoreApproved: 'Tasdiqlanganga qaytarish',
    backToDraft: 'Qoralamaga qaytarish',
    createTitle: 'Yangi qoralama nashr yaratish',
    targetCourse: 'Kurs',
    editionLocale: 'Nashr tili',
    sourceLicense: 'Manba va litsenziya asosi',
    sourceLicensePlaceholder: 'ECONOVA asl matni / OpenStax CC BY 4.0',
    initialLesson: 'Birinchi dars (ixtiyoriy)',
    lessonTitlePlaceholder: 'Dars sarlavhasi',
    lessonBodyPlaceholder: 'Dars matni yoki transkript qoralamasi…',
    aiAssisted: 'Manbani AI yordamida yaratilgan deb belgilash (tasdiqlar baribir talab qilinadi)',
    createDraft: 'Qoralama yaratish',
    editionTitlePlaceholder: 'masalan: Elastiklik va iste’molchi farovonligi (v2)',
  },
  moderation: {
    title: 'Moderatsiya',
    subtitle: 'Talabalarning bo‘lim bo‘yicha ko‘rib chiqish so‘rovlari va xato xabarlari.',
    statusFilter: 'Holat',
    statuses: { open: 'Ochiq', investigating: 'Tekshirilmoqda', resolved: 'Hal qilingan' },
    reviewRequests: 'Bo‘lim bo‘yicha so‘rovlar',
    issueReports: 'Xato xabarlari',
    noReviewRequests: 'Bu filtr uchun so‘rov yo‘q.',
    noReports: 'Bu filtr uchun xato xabari yo‘q.',
    noteLabel: 'Yechim izohi',
    notePlaceholder: 'Nima tekshirilgani yoki o‘zgartirilganini yozing…',
    markInvestigating: 'Tekshirilmoqda',
    markResolved: 'Hal qilish',
    reopen: 'Qayta ochish',
    existingNote: 'Izoh:',
  },
  users: {
    title: 'Foydalanuvchilar va sertifikatlar',
    subtitle: 'Hisoblarni qidiring, administrator huquqini bering yoki oling va sertifikatlarni bekor qiling.',
    searchPlaceholder: 'Ism yoki email bo‘yicha qidirish',
    usersHeading: 'Foydalanuvchilar',
    columns: { name: 'Ism', email: 'Email', role: 'Rol', joined: 'Qo‘shilgan', actions: 'Amallar' },
    makeAdmin: 'Admin qilish',
    makeLearner: 'Talaba qilish',
    you: 'siz',
    selfDemotionHint: 'O‘zingizning administrator rolingizni olib tashlay olmaysiz.',
    noUsers: 'Qidiruvga mos foydalanuvchi yo‘q.',
    certificatesHeading: 'Sertifikatlar',
    certificateSearchPlaceholder: 'Oluvchi, kurs yoki token bo‘yicha qidirish',
    noCertificates: 'Qidiruvga mos sertifikat yo‘q.',
    revoke: 'Bekor qilish',
    revokeTitle: 'Sertifikatni bekor qilish',
    revokeBody: (recipient, course) =>
      `${recipient} uchun «${course}» sertifikatini bekor qilsangiz, uni ommaviy tekshirish muvaffaqiyatsiz bo‘ladi. Bu audit jurnaliga yoziladi.`,
    revokeReasonLabel: 'Audit sababi (majburiy)',
    revokeReasonPlaceholder: 'Nega bu sertifikat bekor qilinmoqda?',
    confirmRevoke: 'Sertifikatni bekor qilish',
    revokedOn: 'Bekor qilingan',
    certificateStatus: { valid: 'Amalda', revoked: 'Bekor qilingan' },
  },
  audit: {
    title: 'Audit jurnali',
    subtitle: 'Barcha ma’muriy amallar, eng yangisi birinchi.',
    actionFilter: 'Amal',
    targetFilter: 'Obyekt turi',
    searchPlaceholder: 'Sabab, obyekt yoki bajaruvchi bo‘yicha qidirish',
    columns: { when: 'Vaqt', actor: 'Bajaruvchi', action: 'Amal', target: 'Obyekt', reason: 'Sabab' },
    noEvents: 'Bu filtrlarga mos audit yozuvi yo‘q.',
    system: 'Tizim',
  },
};

export function adminCopy(locale: LocaleCode): AdminCopy {
  return locale === 'uz' ? UZ : EN;
}
