import type { LocaleCode } from '../shared/types';

/**
 * Bilingual (en / uz Latin) copy for every toast dispatched through the shared
 * notification system. Server-provided reasons are passed through as the
 * message body; titles always come from this catalog so they follow the
 * active locale.
 */
export interface NotificationCopy {
  common: {
    regionLabel: string;
    dismiss: string;
    retry: string;
    signIn: string;
    view: string;
    genericError: string;
  };
  sync: {
    offline: string;
    offlineMessage: string;
    reconciling: string;
    synced: string;
    conflict: string;
    failed: string;
    failedMessage: string;
  };
  lesson: {
    completed: string;
    completedMessage: (lessonTitle: string) => string;
    savedOffline: string;
    savedOfflineMessage: string;
    completeFailed: string;
  };
  progressSync: {
    syncing: string;
    synced: string;
    partial: string;
    failed: string;
    guest: string;
  };
  assessment: {
    submitting: string;
    passed: string;
    notPassed: string;
    certificateIssued: string;
    certificateIssuedMessage: string;
    submitFailed: string;
    timeUp: string;
  };
  enrollment: {
    enrolled: string;
    enrolledMessage: (courseTitle: string) => string;
    paused: string;
    resumed: string;
    updateFailed: string;
  };
  bookmark: {
    added: string;
    removed: string;
    failed: string;
  };
  studyGoal: {
    saved: string;
    savedMessage: (minutes: number) => string;
    failed: string;
    remindersOn: string;
    remindersOff: string;
    remindersFailed: string;
    testSent: string;
    testFailed: string;
  };
  certificate: {
    linkCopied: string;
    linkCopiedPrivateMessage: string;
    shareEnabled: string;
    shareEnabledMessage: string;
    shareDisabled: string;
    shareFailed: string;
    exported: string;
    exportFailed: string;
    verified: string;
    verifiedMessage: (recipient: string, course: string) => string;
    revokedFound: string;
    notFound: string;
    verifyFailed: string;
    revoked: string;
    revokedMessage: string;
    revokeFailed: string;
  };
  review: {
    reportSent: string;
    reportSentMessage: string;
    reportFailed: string;
    reviewSent: string;
    reviewSentMessage: string;
    reviewFailed: string;
  };
  editorial: {
    transitioned: (statusLabel: string) => string;
    signoffRecorded: (statusLabel: string) => string;
    restored: string;
    published: string;
    retired: string;
    blocked: string;
    draftCreated: (version: number | string, locale: string) => string;
    draftCreatedMessage: string;
    draftFailed: string;
    reportResolved: string;
    reviewResolved: string;
    resolveFailed: string;
    loadFailed: string;
  };
  profile: {
    saved: string;
    saveFailed: string;
    digestOn: string;
    digestOff: string;
    digestFailed: string;
    cacheCleared: string;
    cacheClearFailed: string;
    exported: string;
    exportFailed: string;
    deleted: string;
    deleteFailed: string;
    signedIn: (name: string) => string;
    signedOut: string;
  };
  share: {
    shared: string;
    copied: string;
    copyFailed: string;
    unavailable: string;
  };
  community: {
    joined: string;
    left: string;
    updateFailed: string;
    referralApplied: string;
    referralFailed: string;
  };
  notes: {
    saved: string;
    syncFailed: string;
  };
  catalog: {
    loadFailed: string;
    courseLoadFailed: string;
  };
  auth: {
    failed: string;
  };
  access: {
    insufficientRole: string;
    /** `destinationLabel` is null when the page is unknown (e.g. after a server redirect). */
    insufficientRoleMessage: (destinationLabel: string | null) => string;
  };
  companion: {
    unavailable: string;
    unavailableMessage: string;
    requestFailed: string;
    diagramFailed: string;
  };
  audio: {
    unsupported: string;
    failed: string;
  };
  focus: {
    focusComplete: string;
    breakComplete: string;
  };
  dictation: {
    title: string;
    errorTitle: string;
  };
  validation: {
    incompleteAssessment: string;
    invalidGoal: string;
    goalRange: (min: number, max: number) => string;
  };
}

const EN: NotificationCopy = {
  common: {
    regionLabel: 'Notifications',
    dismiss: 'Dismiss notification',
    retry: 'Retry',
    signIn: 'Sign in',
    view: 'View',
    genericError: 'Something went wrong. Please try again.',
  },
  sync: {
    offline: '[ UPLINK OFFLINE :: LOCAL BUFFER ACTIVE ]',
    offlineMessage: 'Progress is saved on this device and will sync when you reconnect.',
    reconciling: '[ UPLINK REESTABLISHED :: RECONCILING DATA... ]',
    synced: '[ RECONCILIATION: COMPLETE ]',
    conflict: '[ SYNC CONFLICT :: RETRYING ]',
    failed: '[ SYNC FAILED :: ACTION REQUIRED ]',
    failedMessage: 'Your local progress is safe. Retry when the connection is stable.',
  },
  lesson: {
    completed: 'Lesson complete',
    completedMessage: (lessonTitle) => `“${lessonTitle}” was saved to your progress.`,
    savedOffline: 'Saved offline',
    savedOfflineMessage: 'This completion will sync when you reconnect.',
    completeFailed: 'Could not record completion',
  },
  progressSync: {
    syncing: 'Syncing course progress…',
    synced: 'Course progress synced',
    partial: 'Sync incomplete',
    failed: 'Progress sync failed',
    guest: 'Saved on this device',
  },
  assessment: {
    submitting: 'Grading your answers…',
    passed: 'Assessment passed',
    notPassed: 'Not passed yet',
    certificateIssued: 'Certificate issued',
    certificateIssuedMessage: 'Your verifiable completion certificate is ready.',
    submitFailed: 'Could not submit assessment',
    timeUp: 'Time is up — answers submitted automatically',
  },
  enrollment: {
    enrolled: 'Enrolled',
    enrolledMessage: (courseTitle) => `You are now enrolled in “${courseTitle}”.`,
    paused: 'Course paused',
    resumed: 'Course resumed',
    updateFailed: 'Could not update enrollment',
  },
  bookmark: {
    added: 'Course bookmarked',
    removed: 'Bookmark removed',
    failed: 'Could not update bookmark',
  },
  studyGoal: {
    saved: 'Daily goal updated',
    savedMessage: (minutes) => `New target: ${minutes} minutes per day.`,
    failed: 'Could not save daily goal',
    remindersOn: 'Goal reminders enabled',
    remindersOff: 'Goal reminders turned off',
    remindersFailed: 'Could not update reminders',
    testSent: 'Test alert sent',
    testFailed: 'Test alert not sent',
  },
  certificate: {
    linkCopied: 'Verification link copied',
    linkCopiedPrivateMessage: 'Enable Share Link when you want others to verify it.',
    shareEnabled: 'Share link enabled',
    shareEnabledMessage: 'Anyone with the link can now verify this certificate.',
    shareDisabled: 'Share link revoked',
    shareFailed: 'Could not update share link',
    exported: 'Export ready',
    exportFailed: 'Export failed',
    verified: 'Certificate verified',
    verifiedMessage: (recipient, course) => `${recipient} · ${course}`,
    revokedFound: 'Certificate has been revoked',
    notFound: 'Certificate not found',
    verifyFailed: 'Verification failed',
    revoked: 'Certificate revoked',
    revokedMessage: 'The revocation was logged to the audit trail.',
    revokeFailed: 'Revocation blocked',
  },
  review: {
    reportSent: 'Issue reported',
    reportSentMessage: 'Logged for human editorial review.',
    reportFailed: 'Could not submit report',
    reviewSent: 'Review requested',
    reviewSentMessage: 'Reviewers can now inspect this segment in the Editorial Studio.',
    reviewFailed: 'Could not send review request',
  },
  editorial: {
    transitioned: (statusLabel) => `Edition moved to ${statusLabel}`,
    signoffRecorded: (statusLabel) => `Sign-off recorded · ${statusLabel}`,
    restored: 'Restored to Approved',
    published: 'Edition published',
    retired: 'Edition retired',
    blocked: 'Action blocked',
    draftCreated: (version, locale) => `Draft v${version} created (${locale})`,
    draftCreatedMessage: 'Requires Subject, Language and Rights reviews before publishing.',
    draftFailed: 'Could not create draft',
    reportResolved: 'Issue report resolved',
    reviewResolved: 'Review request resolved',
    resolveFailed: 'Could not resolve item',
    loadFailed: 'Could not load Editorial Studio',
  },
  profile: {
    saved: 'Profile updated',
    saveFailed: 'Could not save profile',
    digestOn: 'Weekly email summary enabled',
    digestOff: 'Weekly email summary turned off',
    digestFailed: 'Could not update email summary',
    cacheCleared: 'Offline copy removed',
    cacheClearFailed: 'Could not remove offline copy',
    exported: 'Data export downloaded',
    exportFailed: 'Could not export your data',
    deleted: 'Account deleted',
    deleteFailed: 'Could not delete account',
    signedIn: (name) => `Signed in as ${name}`,
    signedOut: 'Signed out',
  },
  share: {
    shared: 'Shared',
    copied: 'Copied to clipboard',
    copyFailed: 'Could not copy',
    unavailable: 'Sharing is unavailable',
  },
  community: {
    joined: 'Joined the leaderboard',
    left: 'Hidden from leaderboards',
    updateFailed: 'Could not update leaderboard settings',
    referralApplied: 'Referral code applied',
    referralFailed: 'Could not apply referral code',
  },
  notes: {
    saved: 'Saved to Quick Notes',
    syncFailed: 'Notes saved locally only',
  },
  catalog: {
    loadFailed: 'Could not load the course catalog',
    courseLoadFailed: 'Could not open this course',
  },
  auth: {
    failed: 'Authentication failed',
  },
  access: {
    insufficientRole: 'Access restricted',
    insufficientRoleMessage: (destinationLabel) =>
      destinationLabel
        ? `Your account role cannot open ${destinationLabel}. You have been returned to the overview.`
        : 'Your account role cannot open that page. You have been returned to the overview.',
  },
  companion: {
    unavailable: 'AI features are off',
    unavailableMessage:
      'AI features are disabled until GEMINI_API_KEY is configured in AI Studio Settings > Secrets. All core courses, lessons, assessments, and certificates work without AI.',
    requestFailed: 'Study companion unavailable',
    diagramFailed: 'Could not generate diagram',
  },
  audio: {
    unsupported: 'Ambient audio unavailable',
    failed: 'Ambient audio error',
  },
  focus: {
    focusComplete: 'Focus session complete',
    breakComplete: 'Break complete',
  },
  dictation: {
    title: 'Voice dictation',
    errorTitle: 'Dictation stopped',
  },
  validation: {
    incompleteAssessment: 'Answer every question first',
    invalidGoal: 'Invalid daily goal',
    goalRange: (min, max) => `Daily study goal must be between ${min} and ${max} minutes.`,
  },
};

const UZ: NotificationCopy = {
  common: {
    regionLabel: 'Bildirishnomalar',
    dismiss: 'Bildirishnomani yopish',
    retry: 'Qayta urinish',
    signIn: 'Kirish',
    view: 'Ko‘rish',
    genericError: 'Nimadir xato ketdi. Qaytadan urinib ko‘ring.',
  },
  sync: {
    offline: '[ ALOQA UZILDI :: MAHALLIY BUFER FAOL ]',
    offlineMessage: 'Natijalar ushbu qurilmada saqlanadi va aloqa tiklanganda sinxronlanadi.',
    reconciling: '[ ALOQA TIKLANDI :: MA’LUMOTLAR MUVOFIQLASHTIRILMOQDA... ]',
    synced: '[ MUVOFIQLASHTIRISH: YAKUNLANDI ]',
    conflict: '[ SINXRONLASH ZIDDIYATI :: QAYTA URINILMOQDA ]',
    failed: '[ SINXRONLASH MUVAFFAQIYATSIZ :: AMAL KERAK ]',
    failedMessage: 'Mahalliy natijalaringiz xavfsiz. Aloqa barqaror bo‘lganda qayta urining.',
  },
  lesson: {
    completed: 'Dars yakunlandi',
    completedMessage: (lessonTitle) => `“${lessonTitle}” o‘quv natijalaringizga saqlandi.`,
    savedOffline: 'Oflayn saqlandi',
    savedOfflineMessage: 'Aloqa tiklanganda ushbu natija sinxronlanadi.',
    completeFailed: 'Yakunlashni qayd etib bo‘lmadi',
  },
  progressSync: {
    syncing: 'Kurs natijalari sinxronlanmoqda…',
    synced: 'Kurs natijalari sinxronlandi',
    partial: 'Sinxronlash to‘liq emas',
    failed: 'Sinxronlash muvaffaqiyatsiz',
    guest: 'Ushbu qurilmada saqlandi',
  },
  assessment: {
    submitting: 'Javoblaringiz baholanmoqda…',
    passed: 'Imtihondan o‘tdingiz',
    notPassed: 'Hali o‘tilmadi',
    certificateIssued: 'Sertifikat berildi',
    certificateIssuedMessage: 'Tekshiriladigan yakunlash sertifikatingiz tayyor.',
    submitFailed: 'Imtihonni yuborib bo‘lmadi',
    timeUp: 'Vaqt tugadi — javoblar avtomatik yuborildi',
  },
  enrollment: {
    enrolled: 'Kursga yozildingiz',
    enrolledMessage: (courseTitle) => `Siz endi “${courseTitle}” kursidasiz.`,
    paused: 'Kurs to‘xtatildi',
    resumed: 'Kurs davom ettirildi',
    updateFailed: 'Kurs holatini yangilab bo‘lmadi',
  },
  bookmark: {
    added: 'Kurs saqlanganlarga qo‘shildi',
    removed: 'Saqlanganlardan olib tashlandi',
    failed: 'Saqlanganlarni yangilab bo‘lmadi',
  },
  studyGoal: {
    saved: 'Kunlik maqsad yangilandi',
    savedMessage: (minutes) => `Yangi maqsad: kuniga ${minutes} daqiqa.`,
    failed: 'Kunlik maqsadni saqlab bo‘lmadi',
    remindersOn: 'Maqsad eslatmalari yoqildi',
    remindersOff: 'Maqsad eslatmalari o‘chirildi',
    remindersFailed: 'Eslatmalarni yangilab bo‘lmadi',
    testSent: 'Sinov bildirishnomasi yuborildi',
    testFailed: 'Sinov bildirishnomasi yuborilmadi',
  },
  certificate: {
    linkCopied: 'Tekshiruv havolasi nusxalandi',
    linkCopiedPrivateMessage: 'Boshqalar tekshira olishi uchun “Ulashishni yoqish”ni bosing.',
    shareEnabled: 'Ulashish havolasi yoqildi',
    shareEnabledMessage: 'Havolaga ega har kim endi ushbu sertifikatni tekshira oladi.',
    shareDisabled: 'Ulashish havolasi bekor qilindi',
    shareFailed: 'Ulashish havolasini yangilab bo‘lmadi',
    exported: 'Eksport tayyor',
    exportFailed: 'Eksport muvaffaqiyatsiz',
    verified: 'Sertifikat tasdiqlandi',
    verifiedMessage: (recipient, course) => `${recipient} · ${course}`,
    revokedFound: 'Sertifikat bekor qilingan',
    notFound: 'Sertifikat topilmadi',
    verifyFailed: 'Tekshirib bo‘lmadi',
    revoked: 'Sertifikat bekor qilindi',
    revokedMessage: 'Bekor qilish audit jurnaliga yozildi.',
    revokeFailed: 'Bekor qilish bloklandi',
  },
  review: {
    reportSent: 'Xato haqida xabar yuborildi',
    reportSentMessage: 'Tahririyat ko‘rib chiqish navbatiga qo‘shildi.',
    reportFailed: 'Xabarni yuborib bo‘lmadi',
    reviewSent: 'Ko‘rib chiqish so‘raldi',
    reviewSentMessage: 'Muharrirlar ushbu qismni Tahririyat studiyasida ko‘rib chiqadi.',
    reviewFailed: 'So‘rovni yuborib bo‘lmadi',
  },
  editorial: {
    transitioned: (statusLabel) => `Nashr holati: ${statusLabel}`,
    signoffRecorded: (statusLabel) => `Tasdiq qayd etildi · ${statusLabel}`,
    restored: 'Tasdiqlangan holatga qaytarildi',
    published: 'Nashr e’lon qilindi',
    retired: 'Nashr arxivlandi',
    blocked: 'Amal bloklandi',
    draftCreated: (version, locale) => `Qoralama v${version} yaratildi (${locale})`,
    draftCreatedMessage: 'E’lon qilishdan oldin fan, til va huquq tekshiruvlari talab qilinadi.',
    draftFailed: 'Qoralamani yaratib bo‘lmadi',
    reportResolved: 'Xabar hal qilindi',
    reviewResolved: 'Ko‘rib chiqish so‘rovi hal qilindi',
    resolveFailed: 'Elementni hal qilib bo‘lmadi',
    loadFailed: 'Tahririyat studiyasini yuklab bo‘lmadi',
  },
  profile: {
    saved: 'Profil yangilandi',
    saveFailed: 'Profilni saqlab bo‘lmadi',
    digestOn: 'Haftalik email xulosasi yoqildi',
    digestOff: 'Haftalik email xulosasi o‘chirildi',
    digestFailed: 'Email xulosasini yangilab bo‘lmadi',
    cacheCleared: 'Oflayn nusxa o‘chirildi',
    cacheClearFailed: 'Oflayn nusxani o‘chirib bo‘lmadi',
    exported: 'Ma’lumotlar eksporti yuklab olindi',
    exportFailed: 'Ma’lumotlaringizni eksport qilib bo‘lmadi',
    deleted: 'Hisob o‘chirildi',
    deleteFailed: 'Hisobni o‘chirib bo‘lmadi',
    signedIn: (name) => `${name} sifatida kirdingiz`,
    signedOut: 'Tizimdan chiqdingiz',
  },
  share: {
    shared: 'Ulashildi',
    copied: 'Buferga nusxalandi',
    copyFailed: 'Nusxalab bo‘lmadi',
    unavailable: 'Ulashish imkonsiz',
  },
  community: {
    joined: 'Reytingga qo‘shildingiz',
    left: 'Reytinglardan yashirildingiz',
    updateFailed: 'Reyting sozlamalarini yangilab bo‘lmadi',
    referralApplied: 'Taklif kodi qo‘llanildi',
    referralFailed: 'Taklif kodini qo‘llab bo‘lmadi',
  },
  notes: {
    saved: 'Tezkor qaydlarga saqlandi',
    syncFailed: 'Qaydlar faqat mahalliy saqlandi',
  },
  catalog: {
    loadFailed: 'Kurslar katalogini yuklab bo‘lmadi',
    courseLoadFailed: 'Ushbu kursni ochib bo‘lmadi',
  },
  auth: {
    failed: 'Kirish amalga oshmadi',
  },
  access: {
    insufficientRole: 'Kirish cheklangan',
    insufficientRoleMessage: (destinationLabel) =>
      destinationLabel
        ? `Hisobingiz roli «${destinationLabel}» bo‘limini ochishga ruxsat bermaydi. Siz bosh sahifaga qaytarildingiz.`
        : 'Hisobingiz roli bu sahifani ochishga ruxsat bermaydi. Siz bosh sahifaga qaytarildingiz.',
  },
  companion: {
    unavailable: 'Sun’iy intellekt funksiyalari o‘chirilgan',
    unavailableMessage:
      'Sun’iy intellekt funksiyalari AI Studio Settings > Secrets bo‘limida GEMINI_API_KEY sozlanmaguncha o‘chirilgan. Barcha asosiy darslar, testlar va sertifikatlar to‘liq ishlaydi.',
    requestFailed: 'O‘quv yordamchisi javob bermadi',
    diagramFailed: 'Diagrammani yaratib bo‘lmadi',
  },
  audio: {
    unsupported: 'Fon ovozi mavjud emas',
    failed: 'Fon ovozida xatolik',
  },
  focus: {
    focusComplete: 'Diqqat sessiyasi yakunlandi',
    breakComplete: 'Tanaffus yakunlandi',
  },
  dictation: {
    title: 'Ovozli diktovka',
    errorTitle: 'Diktovka to‘xtadi',
  },
  validation: {
    incompleteAssessment: 'Avval barcha savollarga javob bering',
    invalidGoal: 'Kunlik maqsad noto‘g‘ri',
    goalRange: (min, max) => `Kunlik o‘quv maqsadi ${min} dan ${max} daqiqagacha bo‘lishi kerak.`,
  },
};

export const NOTIFICATION_COPY: Record<LocaleCode, NotificationCopy> = { en: EN, uz: UZ };

export function notificationCopy(locale: LocaleCode): NotificationCopy {
  return NOTIFICATION_COPY[locale === 'uz' ? 'uz' : 'en'];
}
