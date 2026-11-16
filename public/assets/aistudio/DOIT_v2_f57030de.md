# ECONOVA — Product Requirements & Implementation Blueprint

**Document:** `DOIT_v2.md`  
**Version:** 2.0  
**Status:** Updated product requirements and implementation blueprint  
**Prepared:** 15 November 2026 (Asia/Tashkent)  
**Product name:** ECONOVA  
**Legacy tagline from v0.1:** Learn. Earn. Grow. (Review before release so “Earn” cannot be read as a cash promise.)  

> **Source note:** Rebuilt from the founder-provided `C:/Users/teo/Downloads/DOIT.md` (v0.1, 15 November 2026). The original document's 26 main sections and useful product, UX, content, technical, and release details are retained and updated. Confirmed decisions in the current request and referenced conversation supersede conflicting v0.1 assumptions. The prototype details below are historical statements from v0.1, not a claim that its prototype file or services were inspected in this workspace.

**Decision labels**

- **Founder-confirmed:** Directly stated or selected by the founder in the referenced conversation.
- **Working requirement:** A practical product requirement proposed here to make the brief implementable; confirm during planning where marked open.
- **Open decision:** Needs a founder or specialist decision before the affected feature is finalized or launched.

## 1. Executive summary

ECONOVA is a mobile-friendly learning platform for Economics, Mathematics, and Business. It will launch as a Progressive Web App (PWA), with native iOS or Android apps considered later only if evidence shows that a native app solves a real user need. Its initial audience includes school learners and university students. The main early objective is to help learners make progress and grow the user base; near-term revenue is not the priority.

The product combines structured courses, lessons, practice and assessment, learner progress, course completion certificates, and opt-in social motivation features. The interface direction is premium dark mode, carried forward from the earlier design request. Uzbek and English will be supported as **separately authored and reviewed editions** of course material. Translation or AI may assist editorial work, but neither language edition is published without qualified human review.

Course difficulty has three levels: **Beginner, Intermediate, and Advanced**. **Progressing** describes a learner journey or current status; it is not a fourth course difficulty level. Each course has its own completion certificate. Leaderboards, daily streaks, achievement badges, referrals, and shareable certificates are intended product features. Any points retained in the product are non-cash experience points (XP); cash withdrawal and cash-equivalent redemption are out of MVP scope.

The product must protect learner privacy, including the privacy and safety of minors, while making content provenance, human review, accessible learning, and fair gamification routine parts of operations. AI may assist with lesson and video production, but a human editor and subject reviewer remain accountable for published learning content.

### 1.1 What exists today

The v0.1 specification described an `econova_prototype.html` front-end with a dark dashboard and clickable Overview/Dashboard, My Courses, Video Lessons, Quizzes, NOVA Wallet, Leaderboard, and Profile views. It described sample course cards, learning statistics, a sample lesson, a three-question quiz, demo points, and withdrawal messaging. It also stated that the prototype was not connected to a database, authentication provider, AI/video service, or payment provider and that its illustrative data reset on refresh. Those details are retained as historical context only. Placeholder identities, balances, exchange rates, transactions, progress, and rankings are not product policy or real learner data.

### 1.2 Product vision

Make Economics, Mathematics, and Business understandable through clear lessons, useful practice, reviewed media, transparent progress, and recognition of course completion. The platform's early priority is learning quality and user growth, not revenue.

### 1.3 Product principles

1. **Learning before earning:** rewards, if present, support learning and never replace the educational outcome.
2. **Accuracy over simplification:** simplify language without changing definitions, assumptions, causal relationships, or material limitations.
3. **Source transparency:** retain source references, rights, authorship, and review history.
4. **Fair motivation:** make progress and award rules understandable; avoid farming, shame, or unhealthy pressure.
5. **No cash claims:** XP is non-cash and not withdrawable or cash-equivalent in MVP.
6. **Privacy by design:** collect only information required to provide the service.
7. **Accessible by default:** provide readable text, captions, transcripts, keyboard support, responsive layouts, and clear feedback.
8. **Trustworthy AI:** generated material is a draft; people remain accountable for verification, rights, and publication.

## 2. Product scope

### 2.1 Intended first audience

The initial learners are school learners and university students, as selected in the product discussion. Independent learners may also use the courses. The exact age range, launch countries, account eligibility, and guardian involvement are open decisions. Until the audience and launch markets are defined, design and data handling must assume that minors may use ECONOVA.

### 2.2 MVP (first usable product)

The first usable product should include:

- Responsive PWA for web browsers, with an installable experience where supported.
- Economics, Mathematics, and Business course catalogs.
- Beginner, Intermediate, and Advanced course levels.
- A learner-facing Progressing journey/status that reflects ongoing study, separate from course level.
- Uzbek and English editions, managed and reviewed independently.
- Lessons with text, examples, diagrams, optional video/audio, transcripts, and practice.
- Quizzes or other configured assessments, progress tracking, course completion, and certificates.
- A separate, verifiable certificate for each completed course.
- Administrative workflows for drafting, reviewing, publishing, updating, and retiring course content.
- Privacy, accessibility, analytics, moderation, and security foundations.
- No cash withdrawal or cash-equivalent reward mechanism. Any points shipped are non-cash XP only.

### 2.3 Later releases

Features may be phased after the core learning journey is reliable:

- Daily streaks and achievement badges with gentle, transparent rules.
- Opt-in, privacy-controlled leaderboards.
- Referral links with non-cash, abuse-resistant attribution.
- Learner-controlled sharing of course-specific certificates.
- AI-assisted lesson drafting, storyboarding, and video production after a reviewed pilot.
- Spaced repetition, adaptive revision, teacher/school accounts, and additional subjects or languages, if validated.
- Native iOS or Android apps only if evidence shows that the PWA materially limits learning or retention.

These are ECONOVA product requirements, but their release order can follow editorial capacity, privacy readiness, and evidence. No paid AI provider or native app is a launch dependency.

### 2.4 Explicitly out of scope for the first MVP

- Cash withdrawal, payout, exchange rate, cash-equivalent rewards, token trading, transfer, or purchase of XP.
- Claims that ECONOVA certificates are accredited, equivalent to school or university credit, or professional qualifications.
- Fully automated publishing of AI-generated lessons, translations, questions, or videos.
- Public learner profiles or unrestricted direct messaging between learners.
- Advertising or a paid subscription model as a launch dependency.

### 2.5 Product goals and principles

- Make high-quality, progressively deeper learning accessible on common phones and computers.
- Help learners understand ideas through concise explanations, worked examples, visuals, practice, and useful feedback.
- Make course progress visible and motivating without monetary value.
- Build trust through source tracking, editorial review, clear course rules, and verifiable course-specific certificates.
- Grow the user base while measuring learning quality, language parity, accessibility, and user safety.
- Let learners inspect courses before requesting unnecessary personal information; make progress recoverable across devices.
- Treat Uzbek and English as complete, separately reviewed editions rather than machine-translated leftovers.

## 3. Core user journey

### 3.1 Learner journey

1. **Sign up/log in:** The learner selects a language and learning preferences. Browsing public catalog information does not require an account; request one when saving progress or issuing a certificate.
2. **Discover a course:** Course cards show subject, title, description, difficulty, edition, lesson count/estimated time, availability, and learner progress if enrolled.
3. **Open a lesson:** Show course/module context, objectives, estimated duration, text explanation, key terms, examples, source references, available video, captions/transcript, and completion state.
4. **Study and complete:** Learners study text and optional media, practise, and complete a meaningful activity. Merely opening a page or watching a video is not sufficient evidence by itself.
5. **Take the assessment:** Questions align with objectives; provide accessible input, clear feedback, score summary, explanations, and published retry rules.
6. **Record progress:** Server-side rules save completion and any approved non-cash XP. Client code cannot award XP or decide certificate eligibility.
7. **Review progress:** Show completed lessons, course progress, assessment history, optional streaks/badges/XP, and the certificate for each completed course.

### 3.2 Admin/editor journey

1. Editor creates a subject/course, level, and separate language editions.
2. Editor adds source records, rights/permission notes, learning outcomes, lesson content, media, and assessment items.
3. Subject and language reviewers check accuracy, clarity, age suitability, and alignment; rights/accessibility checks are recorded.
4. Publisher previews the learner experience and publishes only approved versions.
5. Staff monitor learner feedback, completion, assessment quality, media errors, and reports.
6. Staff can correct, unpublish, archive, or replace content while preserving version history.

### 3.3 Recognition and return

1. The learner can review course progress, earned non-cash XP if enabled, streaks, and badges.
2. Leaderboard participation is opt-in and uses a chosen display name or pseudonym.
3. Once the course's published completion criteria are met, ECONOVA issues a separate certificate for that course.
4. The learner controls whether to share a certificate. A public verification page reveals only the minimum information required to confirm authenticity.
5. Referrals use attributable links or codes and do not promise cash or cash-equivalent value.

### 3.4 Recovery and accessibility

- Preserve completed lessons and valid assessment records through logout, refresh, or device changes.
- Explain incomplete or failed sync without discarding locally available work.
- Make transcripts and text alternatives available for learning media.
- Provide keyboard-accessible controls, clear focus, readable contrast, captions, and responsive layouts.
- Let learners pause, resume, or change course without punitive loss of earned learning records.

## 4. Information architecture and navigation

The v0.1 prototype used a desktop sidebar and a compact mobile navigation. Preserve the familiar dashboard/course/lesson flow in the responsive PWA while expanding it for the bilingual catalog, certificates, privacy, and content review.

### 4.1 Main navigation

- **Overview/Dashboard:** Welcome, learning summary, continue-learning action, course cards, optional weekly goal, and recent activity.
- **My Courses:** Catalog, enrolled courses, level and edition information, modules, and progress.
- **Lessons:** Text/media learning surface, captions, transcript, notes, outline, practice, and assessments.
- **Achievements and XP:** Streaks, badges, and non-cash XP balance/history if XP is enabled. Do not label this as a cash wallet.
- **Leaderboard:** Optional community feature with pseudonymous display, bounded period/cohort, and privacy controls.
- **Certificates:** Private library, download/share controls, and verification status.
- **Profile and Settings:** Display name, language, privacy/social settings, account controls, and data requests.
- **Help and Policies:** Contact/help, privacy notice, terms, community rules if used, and content/certificate explanations.

### 4.2 Additional pages required for a production app

- Public landing page; sign-up/login/password recovery; onboarding and language selection.
- Course detail; lesson/transcript view; assessment review; progress and certificate library.
- Privacy, terms, help/FAQ, contact/report-a-problem, certificate verification, and certificate sharing controls.
- Admin dashboard and course/content editor; review queue; user/moderation controls; source and rights register; XP ledger/abuse review; certificate template and issuance operations.
- Analytics and operational monitoring with access controls and retention limits.

## 5. UX and visual design system

### 5.1 Visual direction

- **Theme:** Dark, as chosen for the original interface.
- **Positioning:** Modern education technology with a premium, calm academic feel.
- **Personality:** Focused, clear, optimistic, intelligent, trustworthy.
- Keep learning content visually primary; XP and other rewards remain secondary. The interface must not resemble a casino or speculative finance product.
- Use a clear hierarchy, generous spacing, restrained accent colors, and distinct visual states for level, progress, completion, XP, and warnings. Never communicate status by color alone.
- Keep motion purposeful and respect reduced-motion preferences.

### 5.2 Current prototype palette

The source v0.1 described these approximate tokens; preserve them as starting points, not a final brand guide. Recheck contrast in the implemented UI.

| Token | Approximate value | Use |
|---|---|---|
| Background | `#080B14` | Main page |
| Sidebar | `#0B0F19` | Navigation |
| Panel | `#101522` | Cards and content panels |
| Secondary panel | `#141B2B` | Nested surfaces |
| Border | `#222B3D` | Dividers and card borders |
| Main text | `#F3F6FF` | Primary headings and text |
| Muted text | `#8994AA` | Supporting text |
| Purple | `#9274FF` | Primary actions and progress |
| Cyan | `#5DE1D2` | Highlights and active states |
| Green | `#6FE0A1` | Positive status and success |
| Gold | `#FFC96B` | XP/reward accent only |

### 5.3 Typography

The original prototype used Manrope for headings and DM Sans for body text. Treat these as candidate brand fonts. The production system must support Uzbek Latin and the selected script conventions, use system fallbacks, avoid very small body text, and remain readable at 200% zoom.

### 5.4 Components

Reusable components include navigation/sidebar, top bar and profile control, course card, level tag, course progress bar, statistic card, buttons, lesson/media player, transcript, lesson outline, quiz answer option, feedback panel, XP history row, certificate card/share preview, empty/loading/error states, confirmation dialog, and responsive mobile navigation.

### 5.5 Responsive behaviour

- Desktop: full sidebar and multi-column dashboard.
- Tablet: narrower navigation and fewer grid columns.
- Mobile: compact navigation, single-column content, and touch-friendly controls.
- Video, mathematics notation, and quiz answers must fit narrow screens without horizontal scrolling.
- Important actions must remain reachable without hover.
- Design mobile-first while remaining useful on larger screens; test ordinary and constrained connections.

### 5.6 Accessibility

- Target WCAG AA accessibility; verify the applicable version and criteria during release planning.
- Provide sufficient text/control contrast, visible keyboard focus, semantic headings/landmarks, accessible button names, and keyboard-operable quizzes and navigation.
- Provide captions and transcripts for video; do not put instructional content only in an image/video.
- Support reduced motion, clear validation and error recovery, longer localized strings, correct language metadata, and locale-aware dates/numbers.
- Include accessibility and language review in content and product release gates.

## 6. Course and lesson content model

### 6.1 Course structure

Recommended hierarchy: `Subject → Course → Edition → Level → Module/Unit → Lesson → Practice or assessment`. Initial subjects are **Economics**, **Mathematics**, and **Business**. Course difficulty has three levels: **Beginner**, **Intermediate**, and **Advanced**. A course may have explicit prerequisites, but must explain them and provide a clear route to prepare.

### 6.2 Course fields

Each course should include stable `id` and `slug`, subject, level/difficulty, title and descriptions, target audience, learning outcomes, prerequisites, estimated minutes, thumbnail, status (draft, review, published, archived), creator, timestamps, and content version. Locale-specific copy, publication state, and review sign-off belong to its separate edition.

### 6.3 Lesson fields

Each lesson should include `id`, course/module/edition/version references, title, summary, learning objectives, structured body, key terms, examples, video/media references, captions, transcript, estimated minutes, sequence number, required/optional state, status, review state, reviewer IDs, source reference IDs, and publication timestamp. Questions must link to lesson objectives.

### 6.4 Lesson quality requirements

Every published lesson must have stated objectives; explain technical terms accessibly; use accurate examples and distinguish hypothetical examples from real data; avoid unsupported claims and invented citations; include sources; provide captions and a transcript if it includes video; receive subject and language review; include a quiz or practice aligned to objectives; and carry a version so corrections can be traced.

### 6.5 Simplification standard

“Simplify” must not remove important meaning. Preserve definitions, assumptions, causal relationships, and material limitations; replace unnecessarily complex wording; explain jargon at first use; add a familiar example where useful; distinguish disputed interpretations from settled facts; and obtain subject review of the final explanation.

### 6.6 Uzbek and English course editions

- Uzbek and English are separately authored and reviewed editions of the same course identity.
- Machine translation or AI may assist drafting, but qualified reviewers check meaning, terminology, examples, tone, and accuracy independently in each language.
- Each locale has its own version, reviewers, media, captions/transcript, publication state, and correction history.
- Never silently substitute a different language when an edition is missing; show availability and let the learner switch explicitly.
- Uzbek script convention, terminology glossary, and locale codes remain open decisions and must be set before the first course is published.

### 6.7 Progressing status and course completion

**Progressing** is a learner journey/status, not a fourth course level. It indicates ongoing movement through learning activities and must never imply mastery or certification. Store precise underlying states such as not started, in progress, completed, and paused. Define when the learner-facing Progressing label appears.

Completion criteria are configured by course and edition, shown before the learner starts, and may require lessons and a reviewed assessment. Retry rules, passing thresholds, required/optional lessons, and completion evidence must be defined before publishing. Records are idempotent and tied to the published course version. A quiz score alone is not a proctored credential.

## 7. Source material, LearnAnything.xyz, and content rights

The v0.1 concept named **LearnAnything.xyz** as a discovery source for Economics materials. This is a discovery lead only: identify the actual author and original publication and verify rights for each item. Do not assume the directory owns or licenses material it links to.

Before using any source, check whether the specific license allows adaptation, summarization, translation, commercial use, and redistribution; preserve required attribution; do not bypass paywalls, access controls, or technical restrictions; and prefer original, openly licensed, public-domain, or directly licensed material. Get legal advice when rights are unclear.

### 7.1 Source register

Each source record includes title, author/creator, original URL, publisher/platform, license or permission basis, attribution wording, commercial-use permission, adaptation permission, translation permission, date accessed, internal reviewer, and restrictions/notes.

### 7.2 Content provenance

Every lesson, question, diagram, image, audio clip, video, and certificate asset needs a provenance record. Record whether ECONOVA created, commissioned, licensed, or adapted it; applicable license/permission and attribution; modifications and restrictions; source IDs; and published content version. For AI-assisted drafts retain prompt/template version, model/provider and generation date where known, draft version, human reviewer, approval date, and edits. Describe whether content is original, adapted, summarized, or inspired accurately; do not claim it is “from” a source when it is not.

Public availability, a link, or citation alone does not grant reuse rights. Do not reproduce books, paid courses, videos, diagrams, or question banks without permission or a suitable license.

### 7.3 Human review and publication gate

No AI-generated or externally sourced educational item may publish automatically. Each release requires:

1. A content editor checks clarity, structure, age appropriateness, and learning objectives.
2. A subject-matter reviewer verifies facts, examples, calculations, answer keys, and references.
3. A language reviewer approves the Uzbek or English edition independently.
4. An accessibility check reviews captions, transcript, equations/visual alternatives, and interaction instructions.
5. A rights check confirms provenance and permitted use of every included asset.
6. An authorized publisher approves the exact version and records the decision.

Changes to a published lesson or assessment create a new version, retain the prior record, identify material corrections, and trigger re-review where appropriate. A correction path must let staff hide or replace harmful, incorrect, or rights-infringing content promptly.

### 7.4 Contributor and takedown process

- Obtain written contributor permissions and clarify ownership/license for commissioned work.
- Provide a contact route to report a rights concern or educational error.
- Log the report, temporarily restrict content when warranted, investigate, record a resolution, and notify affected learners when a correction materially changes learning or assessment.
- Limit admin access to identifiable learner data and content operations by role.

## 8. AI-assisted lesson and video production

AI is optional production assistance, not an authority or automatic publisher. No AI/video vendor or paid plan has been chosen. Before buying a tool, compare small demos for comprehension, accuracy, language quality, accessibility, rights, privacy, editing effort, and total cost.

### 8.1 Intended workflow

1. **Brief:** Editor defines learner, level, outcomes, prior knowledge, lesson structure, and questions to answer.
2. **Source pack:** Collect original, licensed, or otherwise permitted references with provenance records.
3. **Draft:** Human author writes the lesson; AI may help outline or suggest wording against the source pack.
4. **Verification:** Subject reviewer checks every factual claim, number, formula, chart, and answer key against sources and recomputes quantitative work independently.
5. **Language editions:** Create or adapt Uzbek and English editions, then review each independently for meaning, terminology, examples, and natural language.
6. **Learning design:** Add examples, visual explanations, retrieval practice, and feedback aligned to the learning outcome.
7. **Accessibility and rights review:** Complete transcript/caption, text alternative, and asset permissions checks.
8. **Approval and release:** Approve a versioned edition through the human publication gate in Section 7.
9. **Monitor and improve:** Review learner confusion, reports, assessment performance, and correction needs; revise through a new reviewed version.

### 8.2 Video lesson experience

The player should support play/pause, seek/timeline, playback speed, volume, fullscreen where supported, captions on/off, transcript access, clear loading/playback errors, and mobile controls. Resume position is optional and should follow the learner's privacy settings. Lesson understanding must not depend on video availability.

### 8.3 AI content safeguards

- AI output is a draft, not trusted educational truth; human review is required before publication.
- Check facts, calculations, terminology, bias, citations, and learner clarity; label hypothetical examples.
- Keep source attribution and prompt/template versions for reproducibility.
- Provide a learner correction/report route.
- Do not clone a real person's voice or likeness without permission; check commercial rights for voices, visuals, music, and videos.
- Do not put learner personal data into generation tools.

### 8.4 Suggested lesson format

A short lesson may use: practical hook; learning objective; plain-language explanation; visual model or diagram; realistic or clearly labeled hypothetical example; common misconception; recap; transition to practice/quiz. Validate lesson length with learners; the original prototype's example duration is not a requirement.

### 8.5 Video format evaluation

Before purchasing video-generation services, create a small pilot using three candidate formats:

- Motion graphics, diagrams, or worked examples with narration.
- AI presenter/avatar with supporting visuals.
- Hybrid presenter and animated explanations.

The formats are candidates, not a locked decision. Evaluate them separately for Economics, Mathematics, and Business where the teaching need differs. Mathematics lessons should prioritize readable notation and step-by-step worked solutions. Compare comprehension, completion, accessibility, pronunciation/translation quality, factual accuracy, editing effort, reuse rights, learner preference, and per-minute production cost. Use learner feedback without exposing minors' identities. Choose the least complex format that meets the learning need.

### 8.6 Media production controls

- A human reviewer approves script, pronunciation, captions, transcript, diagrams, and final video.
- Do not clone a real person's voice or likeness without documented consent and appropriate rights.
- Disclose synthetic presenter/voice use where needed for transparency and user trust.
- Do not upload personal learner data to content-generation tools.
- Keep source scripts and editable assets so errors can be corrected without recreating a lesson.
- Deliver a text and transcript path when video cannot load or the learner prefers not to watch.

## 9. Quiz and assessment system

### 9.1 MVP question types

Start with single-answer multiple choice, three or four options, one correct answer, and a written explanation for the correct answer. Add explanations for common wrong answers where useful. Later formats may include multiple-select, true/false, numeric answer, matching, scenario-based questions, and carefully reviewed short written responses.

### 9.2 Quiz requirements

- Link every question to one or more course/lesson objectives and the correct language edition.
- Store correct answers server-side; never send answer keys before submission.
- Randomize question/option order only when it preserves fairness and objective coverage.
- Record each attempt, responses, score, assessment version, and feedback.
- Review for ambiguity, age suitability, cultural clarity, translation quality, and mathematical correctness.
- Explain results; support an explicit retry policy; prevent duplicate progress or XP issuance.
- Use formative practice to teach. Do not require identity, webcam, or biometrics for ordinary quizzes.

### 9.3 Scoring

The basic score may be `quiz_score_percent = (correct_answers / total_questions) * 100`. Passing threshold, attempt limit, feedback timing, and how retries affect completion remain configurable course decisions. A score must not be described as proctored or independently verified.

### 9.4 Prototype behaviour

The v0.1 file described three sample supply/demand questions that selected one answer, checked it, showed an explanation, calculated a demo reward, and updated an in-page NOVA balance. This was front-end demonstration logic only. Treat the questions and reward values as placeholders; production scoring, completion, and XP decisions run server-side.

## 10. NOVA points and rewards

The v0.1 document proposed an in-app NOVA points unit. The confirmed product decision narrows any retained points to **non-cash XP only**. Use “XP” in requirements and UI unless the founder later explicitly approves “NOVA” as a non-cash display label. This is not money, stored value, cryptocurrency, an investment, a deposit, or a promise of future payment.

### 10.1 Purpose

XP, if shipped, can recognize verified learning milestones while keeping learning itself as the outcome. XP must be visually secondary to lessons and progress and must not determine mastery or certificates unless a course's published assessment criteria say otherwise.

### 10.2 Potential earning events

Candidate events are completing an eligible lesson, completing/passing a quiz, reaching a course milestone, maintaining a learning habit, and completing a course. Exact values and caps are open decisions; the v0.1 prototype examples (+50 for a quiz and +25 for a lesson) are placeholders, not approved policy.

### 10.3 Reward principles

- Reward learning evidence, not clicks, repeated guessing, or watch time alone.
- Publish simple rules and any daily/weekly cap; explain denied or reversed awards and provide an appeal route.
- Issue XP only after trusted server-side verification; use idempotency keys and a versioned rule set.
- Do not let users buy answers or pay to improve XP odds; avoid randomized prize mechanics.
- Make awards non-transferable and non-purchasable; no redemption, withdrawal, exchange, cash equivalent, or promised conversion in MVP.

### 10.4 Reward ledger

Maintain an append-only ledger rather than an editable balance. Each event records transaction ID, user, event/reference ID, type, amount, status, idempotency key, rule version, timestamp, description/reason, actor/system, and any reversal link. The displayed XP total is calculated from valid entries or maintained transaction-safely and reconciled against the ledger. For MVP, omit redemption holds, payout records, and payment credentials.

### 10.5 Redemption and withdrawals

**Cash redemption and withdrawals are not MVP features.** Do not display a withdrawal button, conversion rate, payout eligibility, or future earnings promise. Any post-MVP proposal would require a separate founder decision and qualified legal, financial, fraud, and operational review before it could be designed or announced. Until such a decision exists, XP remains non-cash and non-redeemable.

### 10.6 Prototype wallet

The v0.1 wallet mockup and any sample balance, transaction, exchange-rate copy, or withdrawal button are historical placeholder UI. Replace it with an XP history/balance view only if XP is enabled; remove cash-like UI and unsupported exchange language before any release.

## 11. Gamification and community

### 11.1 Learning streaks

- Define a learning day using the learner's chosen time zone or a clearly explained account setting.
- Count only a meaningful, verifiable learning action, not just opening the app.
- Make missed-day rules predictable and avoid shaming or punishment. A pause or loss of streak must not erase course progress.
- Prevent duplicate same-day activity from artificially extending streaks.
- Keep reminders optional and age-appropriate; do not send push notifications until consent and platform requirements are designed.

### 11.2 Achievements

- Award badges for defined achievements such as completing a unit, demonstrating persistence, or finishing a course.
- Publish the criteria and ensure the badge is earned through valid records, not a client-side claim.
- Keep achievement history stable; corrections or revoked awards require a logged reason.
- Avoid badges that encourage unhealthy time-on-task or public disclosure of sensitive attributes.

### 11.3 Leaderboard

- Leaderboard participation is opt-in; use a pseudonym/display name and allow the learner to leave or hide from rankings.
- Use bounded cohorts and periods such as course/week rather than an unbounded global ranking by default.
- Rank on a defined learning signal, not raw hours online. Prevent duplicate accounts and replayed events from inflating ranks.
- Do not display age, school, precise location, email, or certificate details on rankings.
- Provide reporting and moderation tools; hide or suspend suspicious scores pending review.
- Whether minors can appear in public or only private cohort rankings is an open safeguarding decision.

### 11.4 Referrals

- Provide user-initiated referral links/codes; never upload contact books or send invitations automatically.
- Attribute a referral without exposing private learner information.
- Any optional incentive is non-cash XP and follows a published eligibility event; no earnings claims.
- Rate-limit claims, block self-referral and duplicate-account abuse, review suspicious clusters, and record reversible ledger entries.

### 11.5 Certificates and sharing

- Issue a separate course certificate only after the published completion criteria for that course/version are met; one course completion never grants another course's certificate.
- Use a consistent, reviewed template; AI may assist with design concepts, while a human approves the final reusable template. Generate each learner's certificate from structured data, not a fresh AI image.
- Include ECONOVA, learner-approved display name, course and edition, completion date, unique certificate ID, and QR/verification link as approved by privacy policy.
- State that it confirms ECONOVA course completion only; it is not accreditation, school credit, or a professional qualification.
- Let the learner download and choose whether to share. Preview public fields before sharing; support link revocation and an audit trail.
- Verification must distinguish valid, revoked, and not found certificates without revealing account or unrelated learning data.

## 12. Functional requirements

Priority key: **P0** is required for a safe, usable first learning release; **P1** is a committed feature that may follow as soon as its privacy, editorial, and abuse controls are ready; **P2** requires later validation or a separate decision.

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-001 | P0 | Account access | Learner can browse public catalog and use configured account, sign-in/out, recovery, and privacy flows. |
| FR-002 | P0 | PWA shell | Core app is responsive and installable where supported; offline/error states are clear. |
| FR-003 | P0 | Subjects and levels | Catalog supports Economics, Mathematics, Business and Beginner, Intermediate, Advanced. |
| FR-004 | P0 | Language editions | Uzbek and English availability is distinct; each links to its own reviewed edition. |
| FR-005 | P0 | Course details | Shows objectives, level, edition, prerequisites, workload, outline, and completion/certificate rules. |
| FR-006 | P0 | Lesson delivery | Shows text, objectives, terms, examples, sources, and available media/transcript. |
| FR-007 | P0 | Accessible media | Approved video supports captions/transcript; lesson remains usable without video. |
| FR-008 | P0 | Progress | Saves and resumes progress across sessions using server-side course rules. |
| FR-009 | P0 | Assessment delivery | Delivers published questions without exposing correct answers before submission. |
| FR-010 | P0 | Assessment evaluation | Server validates responses, records attempts, returns explanations, and prevents duplicates. |
| FR-011 | P0 | Course certificate | Each completed course independently issues a certificate tied to its version and criteria. |
| FR-012 | P0 | Certificate verification | Unique certificate ID/link returns minimal valid, revoked, or not-found status. |
| FR-013 | P0 | Certificate sharing | Learner previews public fields, chooses to share, and can revoke the share link. |
| FR-014 | P0 | Content administration | Staff can draft, review, publish, correct, unpublish, archive versioned content. |
| FR-015 | P0 | Rights and review | Published items have provenance, rights, subject/language/accessibility review, and approval records. |
| FR-016 | P0 | Terms, privacy, and age | Policies, account/data controls, and launch-market age/consent flows are available. |
| FR-017 | P0 | No cash withdrawal | MVP has no withdrawal, payout, conversion, or cash-equivalent reward path. |
| FR-018 | P1 | Non-cash XP | If enabled, awards are server-verified, rule-based, idempotent, auditable, and non-cash. |
| FR-019 | P1 | Daily streaks | Counts meaningful activity once per learner-local day and never removes course progress. |
| FR-020 | P1 | Badges | Awards published milestones from validated records and displays criteria. |
| FR-021 | P1 | Leaderboard | Opt-in rankings use pseudonyms, privacy-safe cohorts, and abuse moderation. |
| FR-022 | P1 | Referrals | User-initiated codes attribute eligible events with abuse controls and no cash claims. |
| FR-023 | P1 | Learner reporting | Learner can report a content, accessibility, or safety concern through a clear route. |
| FR-024 | P1 | Analytics | Measures learning, retention, growth, content health, and abuse guardrails with privacy limits. |
| FR-025 | P1 | AI drafting | Editors can create source-linked drafts for review; AI cannot auto-publish. |
| FR-026 | P1 | Optional reminders | Consent-based, learner-configurable reminders are supported only after channel review. |
| FR-027 | P2 | Native apps | Consider only if evidence identifies PWA limitations that materially affect learning/retention. |
| FR-028 | P2 | More subjects/formats | Add after curriculum, review capacity, and learner demand are validated. |

### 12.1 Accounts and preferences

- Learners can browse public catalog information without an account.
- Account sign-up collects only information required for secure access, progress, communication the learner requests, and certificate issuance.
- Learners can select language, change display name, manage social visibility, and request account/data actions.
- Authentication methods, guardian flows, age gates, and account recovery design are open decisions.

### 12.2 Catalog and lessons

- Catalog filters work across subject, level, language edition, and availability.
- Course page communicates objectives, level, edition, estimated effort, prerequisites, content freshness, and certificate requirements.
- Lesson player supports text, media, transcript, practice, progress status, and resume.
- Version changes do not silently rewrite a learner's historic completion record.

### 12.3 Progress and certificates

- Progress reflects published course/lesson rules and syncs across authenticated sessions.
- A course completion decision is calculated on the server from the versioned course criteria.
- Completion issues at most one active certificate for the learner and completed course version unless an authorized reissue is recorded.
- Every course has a distinct certificate record; completing one course does not imply completion of another.
- Verification distinguishes valid, revoked, and not found records and shows a clear explanation.

### 12.4 Social and growth features

- Learners can opt in/out of leaderboard participation, control certificate sharing, and use referral links.
- XP, streaks, and badges derive from trustworthy events and are not client-editable.
- Moderators can review abuse reports, disable links, reverse fraudulent rewards, and record actions.
- Social settings default to the more private choice until reviewed for the selected age policy.

### 12.5 Staff and operations

- Editors can create and revise drafts without publishing directly.
- Reviewers can approve or request changes with a recorded reason.
- Publishers can release only reviewed, rights-cleared versions.
- Admin actions affecting content, learner rewards, leaderboard visibility, or certificates are audited.
- Staff permissions follow least privilege; access to personal learner data is limited and logged.

## 13. Non-functional requirements

### 13.1 Performance

- Keep dashboard and course pages responsive on ordinary mobile and constrained connections.
- Optimize images and video delivery; do not load large media before playback; paginate/incrementally load large catalogs.
- Cache the PWA shell and only explicitly approved content; measure deployed page performance and media failures.

### 13.2 Reliability

- Use managed backups, monitor server errors, and define recovery/support targets before launch.
- Make progress sync, quiz submission, certificate issuance, and XP ledger updates transaction-safe and idempotent.
- Fail gracefully when video, AI, email, or analytics services are unavailable.
- Ensure service-worker updates do not strand learners on incompatible cached content.

### 13.3 Security

- Enforce server-side authorization for every protected operation; never trust client-supplied quiz scores, completion, or XP amounts.
- Protect answer keys and certificate tokens; keep provider/API secrets on the server.
- Validate inputs, use secure sessions/cookies, rate-limit authentication/quizzes/referrals/certificates, audit staff actions, and update dependencies.
- Use row-level security or equivalent access controls, database transactions, backups, and separate development/staging/production environments.
- Do not store card/bank details; no payout integration exists in MVP.

### 13.4 Privacy and age-appropriate safeguards

- Publish clear terms/privacy information; collect only necessary data; define retention, deletion/export, and account privacy controls.
- Determine launch-market age, guardian-consent, and child-safety requirements before accepting learners. This document does not assert legal compliance; obtain jurisdiction-specific review.
- Default social exposure and certificate sharing to private/opt-in. Do not expose legal name, email, age, school, precise location, or private activity.
- Obtain appropriate consent/notice for analytics and communications; do not use minors' data for targeted advertising.
- Review third-party AI/video/analytics data handling before sending content or data. Do not send learner personal data to generation providers.
- Provide reporting/escalation paths and limit staff access to learner records by role.

### 13.5 Observability

Track frontend/backend errors, API latency, video failures, quiz submission and progress-sync errors, certificate verification issues, ledger reconciliation, suspicious activity, and content publication/revision events. Never log passwords, authentication tokens, unnecessary learner data, or sensitive request bodies.

### 13.6 Accessibility and maintainability

- Use semantic UI, sufficient contrast, visible focus, captions/transcripts, keyboard support, text alternatives, reduced motion, and responsive layouts.
- Keep content separate from presentation; use versioned schemas for new subjects, editions, and media formats.
- Document deployment, migrations, backup/recovery, content release/rollback, certificate verification, incident handling, and staff roles.

## 14. Suggested technical architecture

### 14.1 High-level architecture

1. **PWA frontend:** Responsive catalog, learner experience, admin interface, install metadata, and optional service worker.
2. **Application API:** Authentication integration, course/catalog delivery, progress, assessments, XP, referrals, certificates, and admin actions.
3. **Relational database:** Courses, editions, content versions, learner progress, assessment records, reward ledger, certificates, permissions, and audit events.
4. **Object storage/CDN:** Reviewed media, downloadable certificates, and static assets with access controls appropriate to each item.
5. **Background processing:** Video transcoding, certificate PDF creation, notification delivery if enabled, and analytics aggregation.
6. **Operations:** Monitoring, backups, error reporting, audit retention, and content rollback procedures.

### 14.2 Candidate technology direction

The earlier conversation proposed Next.js, Tailwind CSS, Supabase/PostgreSQL, Supabase Auth, and Vercel. Treat these as **candidate options, not founder-confirmed requirements**. Evaluate them against privacy and age requirements, cost, team skill, regional access/performance, media needs, portability, and operational support before locking the stack. Preserve PostgreSQL-compatible data design if the chosen platform supports it, but avoid provider-specific assumptions in content records.

### 14.3 Important architecture rules

- Browser code displays information but never decides assessment, completion, certificate, or XP eligibility.
- Protect quiz answer keys; check roles on every content operation.
- Use database constraints and transactions for assessment, progress, certificate, and XP integrity.
- Keep AI/video provider keys server-side, version database migrations, and separate development, staging, and production.
- Keep integrations replaceable where practical and define a graceful fallback when a provider is unavailable.

### 14.4 PWA requirements

- Provide a valid web app manifest, app name/icons, theme metadata, and installable behavior where supported by the browser.
- Serve securely over HTTPS in production.
- Provide an offline shell and graceful offline/poor-connection states. Cache only content and assets suitable for offline access; protect private learner data on shared devices.
- Define what actions are available offline. Queue only safe, idempotent progress actions and reconcile them visibly after reconnection.
- Ensure service-worker updates do not strand users on incompatible cached content; provide a safe refresh path.
- Do not imply identical features across browsers. Native apps remain a later option if PWA capability gaps materially harm learning or retention.
- Push notifications are optional and not required for MVP.

### 14.5 Integration boundaries and repository structure

- Keep authentication, analytics, email, media generation, and storage behind replaceable interfaces where practical.
- No provider secret or privileged database credential may ship to the browser.
- AI-generated output enters the editorial review system as a draft, never directly into the published catalog.
- Use versioned, documented API contracts and idempotency keys for progress, assessment submission, reward, and certificate operations.

The v0.1 document suggested a Next.js-style repository with route groups for public, learner, and admin pages; reusable components; shared libraries for auth, rewards, validation, and analytics; database migrations/seeds; tests; docs; and an example environment file. Keep this organization only if the candidate stack is selected; it is not a framework mandate.

## 15. Initial database design

### 15.1 Main tables

The following is a logical model; exact table names, keys, and normalization can be chosen during implementation. Use stable IDs, timestamps, foreign keys, and audit/version fields. Store language-edition content independently.

| Entity | Purpose and important fields |
|---|---|
| `users` | Authentication subject, account status, created/updated timestamps; avoid storing excess profile data. |
| `learner_profiles` | Display name/pseudonym, preferred locale/time zone, privacy preferences, optional learner journey status. |
| `consent_records` | Consent/policy version, purpose, actor, timestamp, method, withdrawal; only what is required for the chosen age policy. |
| `subjects` | Stable subject key and display metadata for Economics, Mathematics, Business, and future subjects. |
| `courses` | Stable identity, subject, level, public catalog metadata, lifecycle status. |
| `course_editions` | Course ID, locale, version, title/description/outcomes, review state, reviewer approvals, publication date. |
| `units` / `lessons` | Ordered course structure and locale/version-specific objectives and content blocks. |
| `content_assets` | Media/file metadata, storage key, caption/transcript status, accessibility text, rights/provenance reference. |
| `provenance_records` | Creator/source, URL/reference, license/permission, attribution, AI assistance, review and expiry metadata. |
| `assessments` / `questions` | Versioned assessment specification and question content, localized edition, answer/feedback access controls. |
| `enrollments` | Learner, course edition/version, status, started/completed/paused timestamps. |
| `lesson_progress` | Learner, lesson version, state, completion evidence, last activity; unique constraints prevent duplicate completion. |
| `assessment_attempts` | Learner, assessment version, response summary, score/result, attempt time, completion decision. |
| `xp_ledger` | Append-only XP amount, rule/event, idempotency key, reversal reference, created time. No cash balance or withdrawal record. |
| `streak_records` | Learner, learning-day key/time zone, qualifying activity reference, current/best streak calculation. |
| `badge_definitions` / `badge_awards` | Versioned badge rules and learner awards with evidence and reversal audit. |
| `leaderboard_entries` | Period/cohort, pseudonymous display reference, validated score, visibility and moderation state; avoid permanent public profiles. |
| `referral_codes` / `referral_events` | Opaque code, referrer, attribution, eligibility event, abuse review, reward ledger reference. |
| `certificates` | Learner, course and edition/version, unique public ID, secure verification token/hash, issue date, status, template version, revocation metadata. |
| `audit_events` | Staff/system actor, action, target, timestamp, reason, and non-sensitive change record. |
| `analytics_events` | Minimal event name, timestamp, course/edition context, consent/purpose and pseudonymous session/account key where appropriate. |

### 15.2 Database integrity rules

- Published content versions are immutable; corrections create a new version.
- Completion and reward operations are idempotent.
- Certificate identity is unique and cannot be guessed from sequential database IDs.
- Private profile data is not copied into public leaderboard or certificate records by default.
- Retention and deletion rules cover derived data, event logs, exports, and backups.
- Access control is enforced by the API/database, not by hiding frontend controls alone.

## 16. API and server-side operation outline

The final API style and paths are implementation decisions. The following resource groups describe required capabilities:

- `GET /catalog`, `GET /subjects`, `GET /courses/{courseId}` — public catalog and course edition metadata.
- `GET /courses/{courseId}/editions/{locale}` — published edition and version.
- `POST /enrollments`, `GET /me/enrollments` — enrollment and resume state.
- `GET /lessons/{lessonId}`, `PUT /me/progress/{lessonId}` — lesson content and idempotent progress update.
- `POST /assessments/{assessmentId}/attempts` — server-validated assessment submission.
- `GET /me/progress`, `GET /me/certificates` — learner's private records.
- `GET /certificates/verify/{publicToken}` — minimal public verification result.
- `POST /me/certificates/{certificateId}/share` and `DELETE` equivalent — create or revoke share access after confirmation.
- `GET /me/achievements`, `GET /leaderboards/{cohort}/{period}` — privacy-filtered gamification data.
- `POST /referrals/claim` — validate referral attribution and eligibility with abuse checks.
- Admin-only resources for draft content, review decisions, publishing, asset provenance, certificate operations, and moderation.

**API controls**

- Authenticate and authorize each private or staff operation server-side.
- Validate schemas, payload sizes, locale/version IDs, and permitted state transitions.
- Use idempotency for actions that create progress, assessment results, rewards, referrals, or certificates.
- Rate-limit sensitive endpoints and return generic verification errors that do not reveal account data.
- Version contracts and avoid returning answer keys, private learner details, internal moderation notes, or secrets.
- Log action metadata while avoiding sensitive response bodies and unnecessary personal data.

### 16.1 Reward issuance sequence

1. Client submits assessment responses.
2. Server authenticates the learner, validates the assessment and attempt, and loads protected answers.
3. Server calculates the result and checks retry/completion/XP policy.
4. Server writes the attempt and any eligible XP ledger event transactionally with an idempotency key.
5. Server returns score, feedback, completion state, and confirmed non-cash XP if enabled.
6. Client refreshes progress and XP views. Failures must not create partial or duplicate awards.

### 16.2 Certificate issuance and verification

1. Server checks the course edition/version's published completion criteria against the learner's authoritative progress and assessment records.
2. A unique certificate is created idempotently for that learner/course/version and rendered from an approved template.
3. The learner can download it privately and explicitly enable a share link after reviewing disclosed fields.
4. Public verification uses an unguessable token and returns only a minimal status and approved certificate details.
5. Revocation, correction, reissue, and link disabling create auditable events; verification reflects current status.

## 17. Admin and content operations

### 17.1 Roles

- **Author/editor:** Creates drafts and proposes changes.
- **Subject reviewer:** Verifies educational and quantitative correctness.
- **Language reviewer:** Approves one locale edition for meaning and natural usage.
- **Rights reviewer:** Confirms source and license records.
- **Accessibility reviewer:** Checks media alternatives and learner usability.
- **Publisher:** Releases only fully reviewed versions.
- **Administrator/moderator:** Manages platform configuration or safety/abuse cases using least privilege.

Small teams may hold multiple roles, but publishing should still record the distinct checks and accountable approver. High-risk course or safety decisions should receive a second person review where feasible.

### 17.2 Content statuses

`Draft → Subject review → Language review → Rights/accessibility review → Approved → Published → Superseded or retired`

- Show missing sources, untranslated/missing locale assets, incomplete captions, unapproved edits, and stale review dates.
- Preserve publication history and rollback capability.
- Require a reason for direct edits to published material; publish a new version instead of silently overwriting.
- Provide learner report channels for incorrect, harmful, inaccessible, or rights-concerning content.

### 17.3 Admin dashboard metrics

- Published courses/lessons/editions and drafts awaiting review.
- Reported content/safety/accessibility issues and correction status.
- Learner enrollments, lesson completion, and assessment quality.
- Video playback and progress-sync failures.
- XP issued by event, blocked duplicates, reversals, suspicious patterns, and ledger reconciliation.
- Certificate issuance, verification failures, revocations, and share-link status.

### 17.4 Certificate operations

- Generate from an approved, versioned template.
- Record issue, reissue, correction, revocation, and verification events.
- Require authorization and reason for revocation or manual correction.
- Keep certificate verification available without exposing account management or unrelated learning data.

## 18. Analytics and product metrics

Track learning quality and product growth, not time spent alone. Define event formulas, access, retention, and consent/notice before collecting data. Prefer aggregated or pseudonymous reporting and use minimum cohort sizes where needed to reduce re-identification risk.

### 18.1 Activation

- Sign-up and onboarding completion where account creation is required.
- First course opened, first lesson started/completed, and first assessment submitted.
- Course-start conversion by subject, level, language edition, and entry channel.

### 18.2 Learning

- Lesson and course completion, assessment score distribution, improvement across attempts, and objective attainment where assessments are valid for comparison.
- Return-to-learning rate, weekly/monthly active progressing learners, and learner-reported clarity/helpfulness.
- Certificate issuance per course and voluntary share rate.
- Correction reports, content accuracy issues, accessibility issues, and Uzbek/English catalog parity.

### 18.3 Product health and growth

- Organic, referral, and shared-course/certificate acquisition; referral conversion and abuse rate.
- Retention by acquisition cohort, locale, subject, and course level, interpreted alongside learning outcomes.
- Video start/failure, progress-sync errors, page performance, support requests, and operational availability.
- Cost and staff effort per fully reviewed, published course edition.

### 18.4 Rewards integrity

- XP issued by event/rule, duplicate award attempts blocked, reversals, and ledger reconciliation.
- Unusual quiz patterns, referral abuse, leaderboard reports, and suspicious account clusters.
- Do not optimize for streak length, screen time, or rank at the expense of learning, wellbeing, or privacy.
- Do not use minors' data for targeted advertising; avoid precise location, contact-list, or sensitive demographic collection for growth attribution.
- Review metrics for language gaps, bias, and misleading comparisons before changing the product.

## 19. Testing and quality assurance

These are proposed release checks; execution is tracked for each release. Do not treat an unchecked item as completed.

### 19.1 Frontend and PWA checks

- Navigation, dashboard, catalog, course/lesson pages, and missing-content states work at supported widths.
- Quiz selection, feedback, results, certificate library/share controls, and XP history render consistently.
- Keyboard focus, assistive-technology names, responsive layouts, manifest/install behavior, poor-network states, offline shell, cache refresh, and service-worker update paths work.

### 19.2 Backend and security checks

- Unauthenticated users cannot access protected learner data; learners cannot edit course content, set scores, or award XP.
- Correct answers are withheld before assessment submission.
- Retries, concurrent submissions, and repeated requests do not duplicate completion, XP, referrals, or certificates.
- Ledger totals reconcile; certificate tokens are unguessable; admin operations are authorized and audited.
- Rate limits, session handling, input validation, account recovery, data deletion/export, and abuse controls are reviewed.

### 19.3 Content and learning checks

- Subject reviewer approves definitions, calculations, examples, and answer keys.
- Objectives align with lesson sequence, practice, assessment, and completion rules.
- Source/license/provenance records are complete; captions match narration; transcript is complete.
- AI-assisted content has no unsupported citations and is human-reviewed.
- Uzbek and English terminology, examples, and meaning are independently reviewed; accessibility and age suitability are checked.

### 19.4 Release checks

Before a public release, review security, privacy/age flows, terms, rights, accessibility, backup/recovery, error monitoring, release rollback, support/reporting, reward rules, certificate verification, and removal of fake/sample user data. Keep a named release owner, supported-browser/device list, known-issue log, content-version inventory, and sign-off record.

## 20. Delivery roadmap

A controlled sequence is preferable to launching every feature before the content and safeguards are ready. Timing and staffing remain to be estimated.

### Phase 0 — Product decisions and validation

- Confirm launch country, age policy, Uzbek script/locale, first courses, assessment rules, and certificate details.
- Confirm rights strategy, review roles, support/reporting process, PWA scope, and measurable learning/growth goals.
- Validate course clarity with a small pilot audience and select infrastructure after privacy/cost/team review.

**Exit criteria:** owners are assigned to open decisions and launch risks are recorded.

### Phase 1 — Production UI foundation

- Build responsive PWA shell, dark design system, public landing, account screens, course catalog/detail, learner dashboard, profile/settings, language selection, and routes.

**Exit criteria:** the core app navigation works at supported desktop, tablet, and mobile sizes.

### Phase 2 — Learning platform

- Build database/migrations, subjects/courses/editions/modules/lessons, source register, content admin and review workflow, lesson view, media/transcript, and progress tracking.
- Publish a small complete reviewed course set in Uzbek and English, starting at Beginner level and expanding difficulty only as editorial capacity allows.

**Exit criteria:** an authorized editor can publish a reviewed edition and a learner can study/resume it with progress saved.

### Phase 3 — Assessment and course certificates

- Build quiz authoring, secure delivery and server-side grading, attempt history, completion rules, course-specific certificate generation, private library, verification, and revocation.
- Add non-cash XP only if its rules are approved; otherwise omit XP UI and ledger operations.

**Exit criteria:** assessment and completion decisions are versioned; a qualifying learner receives exactly one verifiable certificate per completed course/version.

### Phase 4 — AI content pipeline

- Pilot source intake, AI-assisted lesson drafts, scripts/storyboards, video formats, captions/transcripts, human review, and traceable publication.

**Exit criteria:** one permitted-source lesson can move through human review to publication with rights and provenance recorded; paid services are selected only after evaluation.

### Phase 5 — Engagement and launch readiness

- Release streaks, badges, opt-in leaderboard, referrals, and certificate sharing with privacy and abuse controls.
- Configure analytics, support/reporting, monitoring, security, privacy, accessibility, and operating procedures.

**Exit criteria:** enabled social features are privacy-safe and supportable, and the learning experience is ready for a controlled launch.

### Phase 6 — Separate future platform/reward evaluation

Native apps and any cash/redeemable reward concept are not MVP commitments. Native apps require evidence of a material PWA limitation. Any cash proposal requires a separate founder decision and qualified legal, financial, fraud, and operational review; no future cash redemption is promised by this roadmap.

## 21. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Source links are mistaken for licenses | Identify each original author and verify rights separately; preserve source and permission records. |
| Incorrect AI-generated facts or math | Require source-based review, independent calculation checks, versioned correction, and learner reporting. |
| Copyright or license violation | Require asset-level provenance and rights approval; use original/cleared material and maintain takedown handling. |
| Weak or inconsistent Uzbek/English editions | Maintain separate review and release status per locale; budget for qualified subject and language reviewers. |
| Minors' personal data or unsafe exposure | Set market-specific age/consent policy, privacy-first defaults, data minimization, moderation, and staff access controls before launch. |
| Streaks/leaderboards create unhealthy pressure | Opt-in settings, bounded cohorts, meaningful activity criteria, no punishment to course progress, and wellbeing review. |
| XP/referral manipulation | Server-side validation, idempotency, rate limits, audit trail, abuse monitoring, and reversible non-cash awards. |
| Certificate misrepresentation | State that certificates show course completion only; publish criteria and provide secure verification. |
| PWA offline/cache exposes learner data | Cache public content selectively; protect or avoid private data cache; test shared-device sign-out and update paths. |
| AI video cost or poor teaching fit | Pilot multiple formats before subscription; choose per subject; retain transcript/text alternatives. |
| Growth focus damages learning quality | Pair acquisition and retention metrics with learning, correction, accessibility, privacy, and abuse guardrails. |
| Scope exceeds editorial capacity | Start with a small, complete, high-quality catalog and add courses only when review capacity is available. |

## 22. Decisions still required

Resolve before the affected feature or public launch:

1. **Launch market and age policy:** Which countries and age groups are served first? Are guardian consent or age-assurance steps required? What support/moderation process is available?
2. **Language conventions:** Uzbek Latin, Cyrillic, or both? Which locale codes and terminology style guide? Who reviews each edition?
3. **Initial curriculum:** Which specific courses and learning outcomes launch in the three subjects? How many levels are ready for publication?
4. **Course standards:** Prerequisites, course length, passing thresholds, retry rules, and certificate completion criteria per course.
5. **Progressing label:** Exact learner-facing meaning and when it appears; underlying status names and reset/pause behavior.
6. **Certificate policy:** Display name vs legal name, public fields, template ownership, correction/reissue/revocation policy, and public-link lifetime after deletion.
7. **XP:** Whether it ships in MVP; whether “NOVA” remains the display name; exact non-cash award rules and thresholds.
8. **Leaderboard:** Eligible ages, opt-in defaults, cohort size, period, ranking signal, and moderation coverage.
9. **Streaks and reminders:** Learning-day calculation, pause/grace behavior, and whether reminders are enabled at launch.
10. **Referrals:** Eligibility event, non-cash reward if any, abuse policy, and age-appropriate sharing copy.
11. **Video:** Whether video is needed in the first course, which formats to pilot, and the budget/quality threshold before a paid tool is selected.
12. **Brand and design:** Final logo, accent palette, typography, light theme need, and certificate template approval.
13. **Technology:** Final frontend, hosting, database/auth provider, analytics, media storage, and support vendors.
14. **Offline scope:** Which lessons/assets can be downloaded or cached, how long they persist, and shared-device privacy behavior.
15. **Commercial model:** When and how revenue, sponsorships, or paid features may be evaluated without undermining free access or learner trust.
16. **Native-app threshold:** What evidence would justify moving beyond the PWA.

## 23. Recommended MVP acceptance checklist

The product is ready for an initial public learning release when all applicable items are true:

### Learner experience

- [ ] It launches as a responsive PWA, with installation behavior where supported and clear fallbacks elsewhere.
- [ ] The catalog contains Economics, Mathematics, and Business; course level is Beginner, Intermediate, or Advanced.
- [ ] Progressing is implemented/documented as a journey/status, never a fourth difficulty level.
- [ ] Uzbek and English editions have distinct content versions and independent language/subject review records.
- [ ] Each published course has visible objectives, workload, prerequisites if any, assessment/completion rules, and sources.
- [ ] Lessons work without video and include suitable transcript/caption/text alternatives for media.
- [ ] Progress and assessment records are saved safely and cannot be duplicated into extra completions/rewards by retries.
- [ ] Each completed course issues its own certificate with a unique, verifiable ID and accurate completion wording.
- [ ] Certificate sharing is controlled by the learner; verification exposes only approved minimal information.
- [ ] No cash withdrawal, cash-equivalent redemption, or monetary XP representation exists in MVP.

### Content operations

- [ ] No learning content or asset is published without provenance, rights clearance, and human review.
- [ ] Editors can create/version content, reviewers can approve or request changes, and only approved editions can publish.
- [ ] Uzbek and English versions have distinct review records; learners can report content issues.
- [ ] Published lesson and assessment versions can be traced, corrected, withdrawn, and restored without losing history.

### Rewards integrity and privacy

- [ ] XP, if enabled, is issued only by trusted server-side logic; duplicate awards are blocked and all adjustments are ledgered.
- [ ] Streak, badge, leaderboard, referral, and share rules are documented; privacy choices and abuse controls work for every enabled feature.
- [ ] No cash withdrawal, cash-equivalent redemption, or monetary XP representation exists in MVP.
- [ ] Age-appropriate safeguards, consent/notice, deletion, retention, and staff access policies are reviewed for launch markets.

### Certificates

- [ ] Every course has separate completion criteria and its own certificate record.
- [ ] Certificate issuance is idempotent, versioned, and tied to authoritative completion records.
- [ ] Verification exposes only approved minimal fields and supports valid/revoked/not-found status.
- [ ] Learners control sharing and can revoke a public share link.

### Launch quality

- [ ] Admin roles, review gates, audit history, content rollback, correction process, and abuse/report routes work.
- [ ] Analytics measures learning and growth with privacy guardrails and documented retention.
- [ ] Accessibility and supported-device checks are complete; critical issues are resolved or explicitly documented.
- [ ] Backup, monitoring, incident response, support ownership, and release rollback are ready.
- [ ] Native apps and paid AI tools are not launch dependencies without a separate evidence-based decision.

## 24. Immediate next steps

1. Resolve launch market, age/guardian policy, Uzbek script convention, and first course curriculum.
2. Define course learning objectives, level, edition, assessment/retry rules, and separate certificate criteria.
3. Assign editorial and rights-review roles; build the source register and bilingual review workflow.
4. Select a small set of complete courses that can be authored and reviewed in both languages.
5. Confirm the stack and operational owner after privacy, cost, PWA, and support requirements are understood.
6. Build the learning core and certificate flow before expanding social/gamification features.
7. Pilot AI/video formats only when a real lesson needs video; evaluate before buying any paid service.
8. Use learning quality, user feedback, accessibility, privacy, and growth outcomes to guide later decisions.

## 25. Glossary

- **PWA (Progressive Web App):** A website that can provide app-like installation and selected offline/browser capabilities where supported.
- **Course edition:** A language-specific, reviewed version of a course, such as Uzbek or English.
- **Course level:** Difficulty category: Beginner, Intermediate, or Advanced.
- **Progressing:** Learner journey/status indicating ongoing progress; not a course level or proof of mastery.
- **XP:** Non-cash experience points, if retained; not money, not withdrawable, and not redeemable for cash in MVP.
- **Provenance:** Record of where content/assets came from, who created them, what rights apply, and how they were reviewed.
- **Human review:** Named editor/reviewer approval before educational content or media is published.
- **Idempotency:** A repeated request has the same effect as one request, preventing duplicate progress, rewards, or certificates.
- **Certificate verification:** A limited check that an ECONOVA course completion record is genuine and currently valid.
- **Leaderboard cohort:** A bounded group and time period used for a ranking, such as learners in one course during one week.
- **MVP:** Minimum viable product: the smallest complete, safe release that supports the intended core learning journey.

## 26. Final product definition

ECONOVA is a premium, dark-mode-first, bilingual learning PWA for school learners, university students, and independent learners, initially focused on Economics, Mathematics, and Business. It offers separately authored and reviewed Uzbek and English course editions at Beginner, Intermediate, and Advanced levels. Progressing describes a learner's ongoing journey, not an additional difficulty level.

The platform helps learners study through structured lessons, practice and reviewed assessments, visible progress, and a separate verifiable certificate for each completed course. It may use carefully reviewed AI assistance for lessons and video production, while humans remain accountable for accuracy, language quality, accessibility, and content rights. Streaks, badges, leaderboards, referrals, shareable certificates, and non-cash XP support motivation and discovery with privacy and anti-abuse safeguards. MVP has no cash withdrawal or cash-equivalent rewards. ECONOVA launches as a PWA; native apps, paid AI services, monetization, and other expansion choices depend on evidence and later approval.
