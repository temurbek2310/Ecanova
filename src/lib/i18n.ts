import type { CourseLevel, EditorialStatus, JourneyStatus, LocaleCode, Subject } from '../shared/types';

export const UI_STRINGS = {
  en: {
    brand: 'ECONOVA',
    nav: {
      overview: 'Overview',
      catalog: 'Courses',
      achievements: 'XP & Streaks',
      community: 'Leaderboard',
      certificates: 'Certificates',
      profile: 'Profile & Privacy',
      admin: 'Editorial Studio',
    },
    heroTitle: 'Structured mastery in Economics, Mathematics, and Business',
    heroSubtitle:
      'Separately authored English and Uzbek editions. Server-verified progress, interactive models, and course-specific certificates.',
    browseCatalog: 'Explore Courses',
    continueLearning: 'Continue Learning',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    allSubjects: 'All Subjects',
    allLevels: 'All Levels',
    editionLabel: 'Course Edition',
    editionEn: 'English Edition',
    editionUz: 'O‘zbekcha nashr (Uzbek)',
    editionMissingNote:
      'This course edition is not published in the selected language yet. ECONOVA never substitutes unreviewed machine translations.',
    subjects: {
      Economics: 'Economics',
      Mathematics: 'Mathematics',
      Business: 'Business',
    } as Record<Subject, string>,
    levels: {
      Beginner: 'Beginner',
      Intermediate: 'Intermediate',
      Advanced: 'Advanced',
    } as Record<CourseLevel, string>,
    journey: {
      not_started: 'Not Started',
      progressing: 'Progressing (Learner Status)',
      completed: 'Completed',
      paused: 'Paused',
    } as Record<JourneyStatus, string>,
    editorial: {
      draft: 'Draft',
      subject_review: 'Subject Review',
      language_review: 'Language Review',
      rights_accessibility_review: 'Rights & Accessibility',
      approved: 'Approved',
      published: 'Published',
      retired: 'Retired',
    } as Record<EditorialStatus, string>,
    nonCashNotice:
      'XP is strictly non-cash recognition for verified study milestones. It has no monetary value and cannot be withdrawn or exchanged.',
    nonAccreditationNotice:
      'ECONOVA certificates confirm completion of a specific course edition only. They are not academic credit or professional accreditation.',
    installApp: 'Install App',
    offlineBanner: 'Offline mode — Cached public catalog available. Syncs when reconnected.',
  },
  uz: {
    brand: 'ECONOVA',
    nav: {
      overview: 'Bosh sahifa',
      catalog: 'Kurslar',
      achievements: 'XP va davomiylik',
      community: 'Reyting',
      certificates: 'Sertifikatlar',
      profile: 'Profil va maxfiylik',
      admin: 'Tahririyat',
    },
    heroTitle: 'Iqtisodiyot, Matematika va Biznes bo‘yicha tizimli bilim',
    heroSubtitle:
      'O‘zbek va ingliz tillarida alohida mualliflik va inson nazoratidan o‘tgan nashrlar. Serverda tasdiqlanadigan natijalar va har bir kurs uchun alohida sertifikat.',
    browseCatalog: 'Kurslarni ko‘rish',
    continueLearning: 'O‘qishni davom ettirish',
    signIn: 'Kirish',
    signOut: 'Chiqish',
    allSubjects: 'Barcha fanlar',
    allLevels: 'Barcha darajalar',
    editionLabel: 'Kurs nashri',
    editionEn: 'Inglizcha nashr (English)',
    editionUz: 'O‘zbekcha nashr',
    editionMissingNote:
      'Tanlangan tildagi nashr hali chop etilmagan. ECONOVA tekshirilmagan mashina tarjimasini avtomatik almashtirib qo‘ymaydi.',
    subjects: {
      Economics: 'Iqtisodiyot',
      Mathematics: 'Matematika',
      Business: 'Biznes',
    } as Record<Subject, string>,
    levels: {
      Beginner: 'Boshlang‘ich',
      Intermediate: 'O‘rta',
      Advanced: 'Yuqori',
    } as Record<CourseLevel, string>,
    journey: {
      not_started: 'Boshlanmagan',
      progressing: 'Jarayonda (O‘quvchi holati)',
      completed: 'Yakunlangan',
      paused: 'To‘xtatilgan',
    } as Record<JourneyStatus, string>,
    editorial: {
      draft: 'Qoralama',
      subject_review: 'Fan ekspertizasi',
      language_review: 'Til tekshiruvi',
      rights_accessibility_review: 'Huquq va qulaylik',
      approved: 'Tasdiqlangan',
      published: 'Chop etilgan',
      retired: 'Arxivlangan',
    } as Record<EditorialStatus, string>,
    nonCashNotice:
      'XP faqat tasdiqlangan o‘quv natijalari uchun beriladigan naqd pulsiz balldir. Uning pul qiymati yo‘q va yechib olinmaydi.',
    nonAccreditationNotice:
      'ECONOVA sertifikati faqat muayyan kurs nashri yakunlanganini tasdiqlaydi; u rasmiy akademik kredit yoki davlat diplomi emas.',
    installApp: 'Ilovani o‘rnatish',
    offlineBanner: 'Oflayn rejim — Saqlangan ommaviy katalog ko‘rsatilmoqda.',
  },
} as const;

export function t(locale: LocaleCode) {
  return UI_STRINGS[locale];
}
