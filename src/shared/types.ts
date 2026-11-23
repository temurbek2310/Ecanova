export type Subject = 'Economics' | 'Mathematics' | 'Business';
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type LocaleCode = 'en' | 'uz';
export type JourneyStatus = 'not_started' | 'progressing' | 'completed' | 'paused';
/**
 * Active platform roles. The database CHECK constraint still accepts the legacy
 * values 'editor' | 'reviewer' | 'publisher'; such rows are read through
 * `normalizeUserRole` (econova-rules.ts) and treated as non-admin learners.
 */
export type UserRole = 'learner' | 'admin';
export type AgeBand = 'school' | 'university' | 'independent';

export type EditorialStatus =
  | 'draft'
  | 'subject_review'
  | 'language_review'
  | 'rights_accessibility_review'
  | 'approved'
  | 'published'
  | 'retired';

export type SimulationType = 'supply_demand' | 'calculus_derivative' | 'unit_economics' | 'none';

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  preferredLocale: LocaleCode;
  timezone: string;
  ageBand: AgeBand;
  leaderboardOptIn: boolean;
  leaderboardPseudonym: string;
  consentAcceptedAt: string | null;
  dailyStudyGoalMinutes: number;
  studyGoalNotificationsEnabled: boolean;
  weeklyDigestEmailEnabled?: boolean;
  lessonNotes?: Record<string, string>;
  bookmarkedCourseIds: string[];
  hasPassword?: boolean;
}

export type User = UserSummary;

export interface ProvenanceSummary {
  id: string;
  sourceTitle: string;
  authorCreator: string;
  originalUrl: string;
  publisherPlatform: string;
  licenseBasis: string;
  attributionText: string;
  commercialAllowed: boolean;
  adaptationAllowed: boolean;
  translationAllowed: boolean;
  aiAssisted: boolean;
  aiModel: string | null;
  promptVersion: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string;
}

export interface LessonBlock {
  kind: 'hook' | 'concept' | 'example' | 'misconception' | 'recap' | 'formula';
  heading: string;
  body: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface GlossaryTermItem {
  term: string;
  definition: string;
  courseId?: string;
  lessonId?: string;
  lessonTitle?: string;
  subject?: Subject;
}

export interface SegmentReviewRequest {
  id: string;
  userId: string | null;
  studentDisplayName: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  segmentHeading: string;
  comment: string;
  status: 'open' | 'investigating' | 'resolved';
  reviewerNote: string | null;
  createdAt: string;
}

export interface LessonPublic {
  id: string;
  editionId: string;
  sequenceNum: number;
  title: string;
  summary: string;
  objectives: string[];
  bodyBlocks: LessonBlock[];
  keyTerms: KeyTerm[];
  simulationType: SimulationType;
  videoUrl: string | null;
  captionsVtt: string | null;
  transcript: string;
  estimatedMinutes: number;
  isRequired: boolean;
  provenance: ProvenanceSummary | null;
}

export interface QuestionPublic {
  id: string;
  sequenceNum: number;
  objectiveRef: string;
  prompt: string;
  options: string[];
}

export interface QuestionWithKey extends QuestionPublic {
  correctOptionIndex: number;
  explanation: string;
}

export interface AssessmentPublic {
  id: string;
  editionId: string;
  title: string;
  passingScorePercent: number;
  maxAttemptsPerDay: number;
  retryPolicyText: string;
  version: number;
  questions: QuestionPublic[];
}

export interface CourseEditionSummary {
  id: string;
  courseId: string;
  locale: LocaleCode;
  version: number;
  title: string;
  subtitle: string;
  description: string;
  outcomes: string[];
  prerequisites: string[];
  completionRules: string;
  passingScorePercent: number;
  status: EditorialStatus;
  subjectReviewerId: string | null;
  languageReviewerId: string | null;
  rightsReviewerId: string | null;
  publishedAt: string | null;
  updatedAt: string;
  lessonCount: number;
  lessonTitles?: string[];
  estimatedMinutes: number;
  provenance: ProvenanceSummary | null;
}

export interface CourseCatalogItem {
  id: string;
  slug: string;
  subject: Subject;
  level: CourseLevel;
  estimatedMinutes: number;
  topicTags?: string[];
  editions: Record<LocaleCode, CourseEditionSummary | null>;
}

export interface CourseDetailResponse {
  course: CourseCatalogItem;
  edition: CourseEditionSummary;
  lessons: LessonPublic[];
  assessment: AssessmentPublic | null;
}

export interface EnrollmentRecord {
  id: string;
  courseId: string;
  locale: LocaleCode;
  journeyStatus: JourneyStatus;
  completedLessonIds: string[];
  requiredLessonIds: string[];
  bestScorePercent: number | null;
  passedAssessment: boolean;
  enrolledAt: string;
  completedAt: string | null;
  pausedAt: string | null;
}

export interface XpLedgerEntry {
  id: string;
  eventType: 'lesson_completed' | 'assessment_passed' | 'course_completed' | 'referral_reward' | 'reversal';
  referenceId: string;
  amount: number;
  status: 'valid' | 'reversed';
  ruleVersion: string;
  description: string;
  createdAt: string;
}

export interface StreakSummary {
  currentStreak: number;
  bestStreak: number;
  lastActivityLocalDate: string | null;
  timezone: string;
}

export interface BadgeAward {
  id: string;
  badgeKey: string;
  title: string;
  criteria: string;
  awardedAt: string;
}

export interface CertificateRecord {
  id: string;
  courseId: string;
  editionId: string;
  editionVersion: number;
  locale: LocaleCode;
  recipientDisplayName: string;
  courseTitle: string;
  subject: Subject;
  level: CourseLevel;
  publicToken: string;
  status: 'valid' | 'revoked';
  shareEnabled: boolean;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  templateVersion: string;
  qrSvg?: string;
}

export interface CertificateVerificationResult {
  verificationStatus: 'valid' | 'revoked' | 'not_found';
  verifiedAt?: string;
  certificate?: {
    recipientDisplayName: string;
    courseTitle: string;
    subject: Subject;
    level: CourseLevel;
    locale: LocaleCode;
    editionVersion: number;
    issuedAt: string;
    revokedAt: string | null;
    revokeReason: string | null;
    nonAccreditationNotice: string;
  };
}

export interface CertificateServerVerification {
  certificateId: string;
  publicToken: string;
  verificationStatus: 'valid' | 'revoked';
  verifiedAt: string;
  issuedAt: string;
  shareEnabled: boolean;
  recipientDisplayName: string;
  courseTitle: string;
  subject: Subject;
  level: CourseLevel;
  locale: LocaleCode;
  editionVersion: number;
  revokedAt: string | null;
  revokeReason: string | null;
  nonAccreditationNotice: string;
}

export interface LeaderboardEntry {
  rank: number;
  pseudonym: string;
  cohortXp: number;
  lessonsCompleted: number;
  isCurrentUser: boolean;
}

export interface QuizLeaderboardEntry {
  rank: number;
  pseudonym: string;
  courseId: string;
  courseTitle: string;
  subject: Subject;
  assessmentId: string;
  assessmentTitle: string;
  bestScorePercent: number;
  attemptsCountThisWeek: number;
  passed: boolean;
  achievedAt: string;
  isCurrentUser: boolean;
}

export interface WeeklyQuizLeaderboardData {
  weekStartIso: string;
  weekEndIso: string;
  entries: QuizLeaderboardEntry[];
}

export interface IssueReportRecord {
  id: string;
  courseId: string | null;
  lessonId: string | null;
  segmentHeading?: string | null;
  category: 'accuracy' | 'translation' | 'accessibility' | 'rights' | 'safety' | 'segment_review';
  description: string;
  status: 'open' | 'investigating' | 'resolved';
  resolutionNote: string | null;
  createdAt: string;
}

export type EditorialSignoffType = 'subject' | 'language' | 'rights';

export interface EditorialSignoffs {
  hasProvenance: boolean;
  hasSubjectReview: boolean;
  hasLanguageReview: boolean;
  hasRightsAccessibilityReview: boolean;
}
