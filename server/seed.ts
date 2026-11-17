import { hashPassword } from './auth.ts';
import { db, runInTransaction, type SqlExecutor } from './db.ts';
import type { KeyTerm, LessonBlock } from '../src/shared/types.ts';

function json(v: unknown): string {
  return JSON.stringify(v);
}

export async function seedIfEmpty(): Promise<void> {
  const existingCourses = await db.queryOne<{ cnt: string | number }>(
    'SELECT COUNT(*) as cnt FROM courses'
  );
  const existingWeeklyAttempts = await db.queryOne<{ cnt: string | number }>(
    "SELECT COUNT(*) as cnt FROM assessment_attempts WHERE id LIKE 'att-seed-%'"
  );
  const count = Number(existingCourses?.cnt ?? 0);
  const shouldSeedCurriculum = count === 0;
  const shouldSeedCohort =
    process.env.ENABLE_DEMO_SANDBOX === 'true' || Number(existingWeeklyAttempts?.cnt ?? 0) === 0;

  if (!shouldSeedCurriculum && !shouldSeedCohort) {
    return;
  }

  const now = new Date().toISOString();

  await runInTransaction(async (tx: SqlExecutor) => {
    if (shouldSeedCurriculum) {
      // 1. Provenance Records
      const insertProv = async (
        id: string,
        sourceTitle: string,
        authorCreator: string,
        originalUrl: string,
        publisherPlatform: string,
        licenseBasis: string,
        attributionText: string,
        commercialAllowed: boolean,
        adaptationAllowed: boolean,
        translationAllowed: boolean,
        aiAssisted: boolean,
        aiModel: string | null,
        promptVersion: string | null,
        reviewedBy: string | null,
        reviewedAt: string | null,
        notes: string
      ) => {
        await tx.execute(
          `INSERT INTO provenance_records (
            id, source_title, author_creator, original_url, publisher_platform,
            license_basis, attribution_text, commercial_allowed, adaptation_allowed,
            translation_allowed, ai_assisted, ai_model, prompt_version, reviewed_by, reviewed_at, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING`,
          [
            id,
            sourceTitle,
            authorCreator,
            originalUrl,
            publisherPlatform,
            licenseBasis,
            attributionText,
            commercialAllowed,
            adaptationAllowed,
            translationAllowed,
            aiAssisted,
            aiModel,
            promptVersion,
            reviewedBy,
            reviewedAt,
            notes,
          ]
        );
      };

      await insertProv(
        'prov-econ-1',
        'Principles of Microeconomics (OpenStax, 3rd ed.) & ECONOVA Original Synthesis',
        'Steven A. Greenlaw, David Shapiro & ECONOVA Curriculum Team',
        'https://openstax.org/details/books/principles-microeconomics-3e',
        'OpenStax / Rice University (discovered via LearnAnything.xyz directory)',
        'CC BY 4.0',
        'Adapted in part from OpenStax Principles of Microeconomics 3e (CC BY 4.0). Independently authored & reviewed in English and Uzbek Latin by ECONOVA.',
        true,
        true,
        true,
        false,
        null,
        null,
        'Dr. A. Karimov (Economics Reviewer)',
        now,
        'Original OpenStax license verified directly at publisher URL; LearnAnything.xyz used strictly as discovery lead.'
      );

      await insertProv(
        'prov-math-1',
        'Calculus Volume 1 (OpenStax) & Applied Marginal Analysis Notes',
        'Gilbert Strang, Edwin Herman & ECONOVA Mathematics Faculty',
        'https://openstax.org/details/books/calculus-volume-1',
        'OpenStax / Rice University',
        'CC BY-NC-SA 4.0 / ECONOVA Original Worked Examples',
        'Concept structure aligned with OpenStax Calculus Vol. 1 (CC BY-NC-SA 4.0); all worked marginal-cost examples authored originally by ECONOVA.',
        false,
        true,
        true,
        false,
        null,
        null,
        'Prof. N. Tursunova (Math Reviewer)',
        now,
        'Non-commercial curriculum module; original worked problems verified independently.'
      );

      await insertProv(
        'prov-biz-1',
        'ECONOVA Original Casebook: Central Asian & Global Unit Economics',
        'ECONOVA Business Curriculum Group',
        'https://econova.edu/curriculum/unit-economics-v1',
        'ECONOVA Original Publication',
        'ECONOVA Original (All Rights Reserved for Platform Delivery)',
        'Original curriculum authored by ECONOVA Business faculty using hypothetical illustrative startup datasets.',
        true,
        true,
        true,
        false,
        null,
        null,
        'M. Alimov (Business Reviewer)',
        now,
        'Hypothetical cohort numbers clearly labeled in lesson text.'
      );

      await insertProv(
        'prov-econ-draft',
        'Monetary Policy & Price Stability Primer (Draft)',
        'ECONOVA Editorial Desk',
        'https://econova.edu/editorial/draft-macro-1',
        'ECONOVA Internal Draft',
        'Original Draft — Pending Rights & Subject Verification',
        'Drafted by editorial team with AI outline assistance; awaiting subject and language sign-off.',
        true,
        true,
        true,
        true,
        'gemini-4-hydrogen',
        'outline-prompt-v1',
        null,
        null,
        'AI-assisted outline remains strictly in editorial review queue.'
      );

      // 2. Courses
      const insertCourse = async (
        id: string,
        slug: string,
        subject: string,
        level: string,
        estimatedMinutes: number
      ) => {
        await tx.execute(
          `INSERT INTO courses (id, slug, subject, level, estimated_minutes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [id, slug, subject, level, estimatedMinutes, now]
        );
      };

      await insertCourse('course-econ-beg', 'supply-demand-equilibrium', 'Economics', 'Beginner', 45);
      await insertCourse('course-math-int', 'applied-calculus-marginal', 'Mathematics', 'Intermediate', 60);
      await insertCourse('course-biz-adv', 'unit-economics-capital', 'Business', 'Advanced', 75);
      await insertCourse('course-econ-int', 'macro-policy-inflation', 'Economics', 'Intermediate', 50);

      // 3. Separate English and Uzbek Editions
      const insertEdition = async (
        id: string,
        courseId: string,
        locale: 'en' | 'uz',
        version: number,
        title: string,
        subtitle: string,
        description: string,
        outcomes: string[],
        prerequisites: string[],
        completionRules: string,
        passingScorePercent: number,
        status: string,
        provenanceId: string,
        subjectReviewerId: string | null,
        languageReviewerId: string | null,
        rightsReviewerId: string | null,
        publishedAt: string | null
      ) => {
        await tx.execute(
          `INSERT INTO course_editions (
            id, course_id, locale, version, title, subtitle, description,
            outcomes_json, prerequisites_json, completion_rules, passing_score_percent,
            status, provenance_id, subject_reviewer_id, language_reviewer_id, rights_reviewer_id,
            published_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO NOTHING`,
          [
            id,
            courseId,
            locale,
            version,
            title,
            subtitle,
            description,
            json(outcomes),
            json(prerequisites),
            completionRules,
            passingScorePercent,
            status,
            provenanceId,
            subjectReviewerId,
            languageReviewerId,
            rightsReviewerId,
            publishedAt,
            now,
          ]
        );
      };

      await insertEdition(
        'ed-econ-beg-en-v1',
        'course-econ-beg',
        'en',
        1,
        'Foundations of Supply, Demand & Market Equilibrium',
        'Understand how prices coordinate buyers, sellers, and scarce resources.',
        'Build intuition for consumer willingness to pay, producer marginal cost, equilibrium price discovery, and how non-price shocks shift market outcomes.',
        [
          'Distinguish movements along a demand or supply curve from full curve shifts.',
          'Calculate equilibrium price and quantity from linear market schedules.',
          'Explain consumer surplus, producer surplus, and price-ceiling shortages.',
        ],
        ['Basic arithmetic and reading two-variable coordinate graphs.'],
        'Complete all 3 required lessons and score at least 70% on the final 5-question assessment.',
        70,
        'published',
        'prov-econ-1',
        'rev-econ-karimov',
        'rev-en-smith',
        'rev-rights-azimov',
        now
      );

      await insertEdition(
        'ed-econ-beg-uz-v1',
        'course-econ-beg',
        'uz',
        1,
        'Talab, taklif va bozor muvozanati asoslari',
        'Narxlar xaridorlar va ishlab chiqaruvchilar qarorlarini qanday muvofiqlashtirishini o‘rganing.',
        'Iste’molchi to‘lashga tayyorligi, ishlab chiqaruvchining chekli xarajati, bozor muvozanati hamda tashqi omillar ta’sirida egri chiziqlarning siljishini amaliy misollar asosida tushuning.',
        [
          'Talab va taklif chizig‘i bo‘ylab harakatni chiziqning to‘liq siljishidan farqlash.',
          'Chiziqli tenglamalar yordamida muvozanat narx va muvozanat hajmni hisoblash.',
          'Iste’molchi va ishlab chiqaruvchi ortiqchaligi hamda narx chegaralarining taqchillikka ta’sirini tushuntirish.',
        ],
        ['Oddiy arifmetika va koordinata tekisligida grafiklarni o‘qiy olish.'],
        'Barcha 3 ta majburiy darsni yakunlang va yakuniy 5 savollik baholashdan kamida 70% natija oling.',
        70,
        'published',
        'prov-econ-1',
        'rev-econ-karimov',
        'rev-uz-rahimova',
        'rev-rights-azimov',
        now
      );

      await insertEdition(
        'ed-math-int-en-v1',
        'course-math-int',
        'en',
        1,
        'Applied Calculus: Derivatives, Marginal Rates & Optimization',
        'Connect instantaneous rates of change to cost minimization and profit maximization.',
        'Master secant-to-tangent limits, power and chain differentiation rules, and first- and second-order optimality conditions used in quantitative economics and finance.',
        [
          'Interpret the first derivative geometrically as tangent slope and economically as marginal rate.',
          'Differentiate polynomial and composite revenue/cost functions accurately.',
          'Use first- and second-derivative tests to verify local maxima and minima.',
        ],
        ['Algebraic manipulation of polynomials and linear/quadratic functions.'],
        'Complete all 3 required lessons and pass the 5-question quantitative assessment (70%+).',
        70,
        'published',
        'prov-math-1',
        'rev-math-tursunova',
        'rev-en-smith',
        'rev-rights-azimov',
        now
      );

      await insertEdition(
        'ed-math-int-uz-v1',
        'course-math-int',
        'uz',
        1,
        'Amaliy matematik analiz: Hosila, marjinal sur’atlar va optimallashtirish',
        'Oniy o‘zgarish tezligini xarajatni kamaytirish va foydani maksimallashtirish bilan bog‘lang.',
        'Kesuvchi chiziqdan urinmaga o‘tish limiti, daraja va murakkab funksiya hosilalari hamda iqtisodiyotda qo‘llaniladigan birinchi va ikkinchi tartibli optimallik shartlarini o‘zlashtiring.',
        [
          'Birinchi hosilani geometrik jihatdan urinma burchak koeffitsienti, iqtisodiy jihatdan esa marjinal ko‘rsatkich sifatida talqin qilish.',
          'Ko‘phadli va murakkab daromad-xarajat funksiyalaridan to‘g‘ri hosila olish.',
          'Birinchi va ikkinchi hosila alomatlari orqali lokal maksimum va minimum nuqtalarini tekshirish.',
        ],
        ['Ko‘phadlar ustida algebraik amallar va kvadrat funksiyalar asoslari.'],
        'Barcha 3 ta majburiy darsni tugating va 5 savollik amaliy testdan kamida 70% ball to‘plang.',
        70,
        'published',
        'prov-math-1',
        'rev-math-tursunova',
        'rev-uz-rahimova',
        'rev-rights-azimov',
        now
      );

      await insertEdition(
        'ed-biz-adv-en-v1',
        'course-biz-adv',
        'en',
        1,
        'Unit Economics, Cash Flow Modeling & Capital Allocation',
        'Evaluate business durability using contribution margin, LTV/CAC, and payback discipline.',
        'Analyze how gross margin, customer acquisition cost, churn, and working capital timing interact to determine whether growth creates or destroys enterprise value.',
        [
          'Compute contribution margin per unit and break-even volume under fixed/variable cost structures.',
          'Evaluate customer Lifetime Value (LTV), CAC payback months, and sensitivity to churn.',
          'Distinguish accounting profit from operating cash flow when allocating growth capital.',
        ],
        ['Familiarity with income statement structure and basic percentage math.'],
        'Complete all 3 required lessons and achieve 70% or higher on the capstone assessment.',
        70,
        'published',
        'prov-biz-1',
        'rev-biz-alimov',
        'rev-en-smith',
        'rev-rights-azimov',
        now
      );

      await insertEdition(
        'ed-biz-adv-uz-v1',
        'course-biz-adv',
        'uz',
        1,
        'Unit-iqtisodiyot, pul oqimini modellashtirish va kapital taqsimoti',
        'Biznes barqarorligini marjinal foyda, LTV/CAC va o‘zini oqlash muddati orqali baholang.',
        'Yalpi marja, mijoz jalb qilish xarajati (CAC), mijozlar ketishi (churn) va aylanma kapital vaqti o‘sishning qiymat yaratishi yoki yo‘qotishiga qanday ta’sir qilishini tahlil qiling.',
        [
          'Doimiy va o‘zgaruvchan xarajatlar tarkibida birlikka to‘g‘ri keladigan hissa marjasini va zararsizlik nuqtasini hisoblash.',
          'Mijozning umrbod qiymati (LTV), CAC qoplanish oylari va churn o‘zgarishiga sezgirlikni baholash.',
          'Kapital taqsimotida buxgalteriya foydasini operatsion pul oqimidan aniq ajratish.',
        ],
        ['Daromadlar hisoboti tuzilishi va foiz hisob-kitoblari bilan tanishlik.'],
        'Barcha 3 ta majburiy darsni yakunlang va yakuniy baholashdan kamida 70% natija oling.',
        70,
        'published',
        'prov-biz-1',
        'rev-biz-alimov',
        'rev-uz-rahimova',
        'rev-rights-azimov',
        now
      );

      await insertEdition(
        'ed-econ-int-en-v1',
        'course-econ-int',
        'en',
        1,
        'Macroeconomic Policy & Inflation Dynamics',
        'Explore central bank interest rates, aggregate demand, and price stability.',
        'Draft edition exploring how monetary policy transmission and supply shocks shape inflation expectations.',
        [
          'Explain the difference between demand-pull and cost-push inflation.',
          'Analyze how policy rate changes influence borrowing and aggregate demand.',
        ],
        ['Foundations of Supply, Demand & Market Equilibrium.'],
        'Complete lessons and pass assessment (70%+).',
        70,
        'subject_review',
        'prov-econ-draft',
        null,
        null,
        null,
        null
      );

      // 4. Lessons
      const insertLesson = async (
        id: string,
        editionId: string,
        seq: number,
        title: string,
        summary: string,
        objectives: string[],
        blocks: LessonBlock[],
        terms: KeyTerm[],
        sim: 'supply_demand' | 'derivative_tangent' | 'unit_economics' | 'none',
        captions: string,
        transcript: string,
        mins: number,
        provId: string
      ) => {
        await tx.execute(
          `INSERT INTO lessons (
            id, edition_id, sequence_num, title, summary, objectives_json,
            body_blocks_json, key_terms_json, simulation_type, video_url, captions_vtt,
            transcript, estimated_minutes, is_required, provenance_id
          ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, NULL, $10, $11, $12, TRUE, $13)
          ON CONFLICT (id) DO NOTHING`,
          [
            id,
            editionId,
            seq,
            title,
            summary,
            json(objectives),
            json(blocks),
            json(terms),
            sim,
            captions,
            transcript,
            mins,
            provId,
          ]
        );
      };

      // --- ECONOMICS BEGINNER EN ---
      await insertLesson(
        'les-econ-en-1',
        'ed-econ-beg-en-v1',
        1,
        'Why Prices Move: Willingness to Pay & Demand',
        'Discover why lower prices invite more buyers and how income or tastes shift the entire demand curve.',
        ['Define quantity demanded vs. demand.', 'Identify at least three demand shifters holding price constant.'],
        [
          {
            kind: 'hook',
            heading: 'Opening Scenario: The Morning Coffee Market',
            body: 'Imagine a university district where iced coffee sells for $4.00. When a sudden heatwave hits, lines double even though the price did not change. Why? Buyers’ willingness to pay shifted outward.',
          },
          {
            kind: 'concept',
            heading: 'Movement Along vs. Shift of the Curve',
            body: 'The Law of Demand states that, holding all else equal (ceteris paribus), a lower price increases quantity demanded—this is a movement along a fixed curve. When non-price factors (income, preferences, prices of substitutes/complements, or expectations) change, the entire demand curve shifts right or left.',
          },
          {
            kind: 'example',
            heading: 'Hypothetical Worked Schedule',
            body: 'Suppose Qd = 120 - 10P. At P = $6, buyers want 60 cups. If P drops to $4, Qd rises to 80 cups (a movement along the curve). If a heatwave adds +20 cups at every price, the new curve is Qd\' = 140 - 10P.',
          },
          {
            kind: 'misconception',
            heading: 'Common Misconception',
            body: 'Changing a good’s own price never shifts its demand curve—it only moves buyers along the existing demand schedule.',
          },
          {
            kind: 'recap',
            heading: 'Key Takeaway',
            body: 'Separate price changes (movements along) from structural market changes (curve shifts) before predicting market outcomes.',
          },
        ],
        [
          { term: 'Ceteris Paribus', definition: 'Latin for "other things being equal"—isolating one variable change at a time.' },
          { term: 'Substitute Good', definition: 'A good that satisfies a similar need (e.g., tea and coffee), so a price rise in one boosts demand for the other.' },
        ],
        'supply_demand',
        'WEBVTT\n\n00:00.000 --> 00:08.000\nWelcome to Lesson 1. Today we separate movements along a demand curve from full demand shifts.\n\n00:08.000 --> 00:18.000\nWhen only price changes, quantity demanded moves along the existing curve. External shocks shift the entire schedule.',
        'Welcome to Lesson 1: Why Prices Move. When a product’s own price decreases while other factors stay constant, quantity demanded rises along the existing demand curve. When income, tastes, or related goods’ prices change, buyers want a different quantity at every price—shifting the entire curve. Use the interactive Supply & Demand model below to adjust the Demand Shift slider and watch equilibrium move.',
        15,
        'prov-econ-1'
      );

      await insertLesson(
        'les-econ-en-2',
        'ed-econ-beg-en-v1',
        2,
        'Supply, Marginal Cost & Producer Incentives',
        'Explore why upward-sloping supply reflects rising marginal cost and how input costs shift supply.',
        ['Explain why higher market prices draw higher quantity supplied.', 'Distinguish input-cost shocks from price-driven movements along supply.'],
        [
          {
            kind: 'hook',
            heading: 'Opening Scenario: Expanding Bakery Output',
            body: 'A local bakery easily produces 100 loaves at $2 each. To bake 200 loaves, it must pay overtime wages and run older ovens—raising the cost of each additional loaf.',
          },
          {
            kind: 'concept',
            heading: 'Marginal Cost & The Law of Supply',
            body: 'Producers supply additional units only when the market price covers the marginal cost of producing that unit. Because short-run marginal costs typically rise as capacity tightens, the supply curve slopes upward.',
          },
          {
            kind: 'example',
            heading: 'Hypothetical Supply Equation',
            body: 'Let Qs = -20 + 15P. At P = $4, Qs = 40 units. If flour prices fall and lower production cost by $1 per unit, supply shifts right so producers offer more at every price.',
          },
          {
            kind: 'recap',
            heading: 'Key Takeaway',
            body: 'Input prices, technology, taxes, and producer expectations shift the supply curve; own-price changes move along it.',
          },
        ],
        [
          { term: 'Marginal Cost', definition: 'The additional cost of producing one more unit of output.' },
          { term: 'Supply Shock', definition: 'An unexpected change in input costs or technology that shifts the entire supply curve.' },
        ],
        'supply_demand',
        'WEBVTT\n\n00:00.000 --> 00:09.000\nIn Lesson 2, we examine producer supply and why marginal cost rises with output.\n\n00:09.000 --> 00:18.000\nCheaper inputs or better technology shift supply rightward, lowering equilibrium price.',
        'In Lesson 2, we examine the producer side of the market. Because producing extra units in the short run strains equipment and labor, marginal cost rises, giving the supply curve its upward slope. Lower input costs or productivity gains shift supply right, allowing more units to be offered at every price.',
        15,
        'prov-econ-1'
      );

      await insertLesson(
        'les-econ-en-3',
        'ed-econ-beg-en-v1',
        3,
        'Market Equilibrium, Surplus & Price Controls',
        'Solve for equilibrium and see how binding price ceilings or floors create shortages or surpluses.',
        ['Compute market-clearing price and quantity where Qd = Qs.', 'Diagnose shortages from binding price ceilings and surpluses from price floors.'],
        [
          {
            kind: 'concept',
            heading: 'Clearing the Market',
            body: 'Market equilibrium occurs at the intersection where quantity demanded equals quantity supplied (Qd = Qs). Above equilibrium price, sellers produce more than buyers want (excess supply / surplus), pushing prices down. Below equilibrium, buyers want more than sellers offer (excess demand / shortage), bidding prices up.',
          },
          {
            kind: 'formula',
            heading: 'Solving Linear Equilibrium',
            body: 'If Qd = 120 - 10P and Qs = 20 + 10P, setting Qd = Qs gives 120 - 10P = 20 + 10P → 100 = 20P → P* = $5 and Q* = 70 units.',
          },
          {
            kind: 'example',
            heading: 'Binding Price Ceiling Effect',
            body: 'If authorities cap the price at P = $3 (below P* = $5), Qd becomes 90 while Qs falls to 50—creating a persistent shortage of 40 units.',
          },
          {
            kind: 'recap',
            heading: 'Key Takeaway',
            body: 'Free-adjusting prices eliminate persistent shortages and surpluses; binding caps or floors hold the market away from clearing.',
          },
        ],
        [
          { term: 'Market Equilibrium', definition: 'Price-quantity pair where quantity demanded equals quantity supplied with zero pressure to change.' },
          { term: 'Binding Price Ceiling', definition: 'A legal maximum price set below equilibrium, causing a persistent shortage.' },
        ],
        'supply_demand',
        'WEBVTT\n\n00:00.000 --> 00:10.000\nLesson 3 brings demand and supply together to find equilibrium price and quantity.\n\n00:10.000 --> 00:20.000\nTry setting a price ceiling below equilibrium in the interactive graph to measure the resulting shortage.',
        'Lesson 3 brings buyers and sellers together. Setting Qd equal to Qs yields the market-clearing price P* and quantity Q*. When a price ceiling is imposed below P*, quantity demanded exceeds quantity supplied, producing a measurable shortage.',
        15,
        'prov-econ-1'
      );

      // --- ECONOMICS BEGINNER UZ ---
      await insertLesson(
        'les-econ-uz-1',
        'ed-econ-beg-uz-v1',
        1,
        'Narxlar nega o‘zgaradi: to‘lashga tayyorlik va talab',
        'Narx pasayishi nega xaridorlarni ko‘paytirishini va daromad yoki did o‘zgarishi talabni qanday siljitishini bilib oling.',
        ['Talab hajmi va talab tushunchalarini ajrata olish.', 'Narxdan tashqari kamida uchta talab omilini tushuntirish.'],
        [
          {
            kind: 'hook',
            heading: 'Amaliy vaziyat: Talabalar shaharchasida muzdek choy bozori',
            body: 'Tasavvur qiling, bir stakan choy 10 000 so‘m turadi. Havo keskin isib ketgan kuni narx o‘zgarmasa ham navbat ikki barobar oshadi. Sababi — xaridorlarning to‘lashga tayyorligi yuqoriga siljidi.',
          },
          {
            kind: 'concept',
            heading: 'Chiziq bo‘ylab harakat va chiziqning siljishi',
            body: 'Talab qonuniga ko‘ra, boshqa sharoitlar o‘zgarmaganda (ceteris paribus) narx tushsa, talab hajmi ortadi — bu mavjud chiziq bo‘ylab harakatdir. Daromad, did, o‘rinbosar tovarlar narxi yoki kutilmalar o‘zgarsa, butun talab chizig‘i o‘ngga yoki chapga siljiydi.',
          },
          {
            kind: 'example',
            heading: 'Shartli hisob-kitob misoli',
            body: 'Aytaylik, Qd = 120 - 10P. P = 6 bo‘lganda xaridorlar 60 dona oladi. Narx 4 ga tushsa, talab hajmi 80 donaga ko‘tariladi (chiziq bo‘ylab harakat). Issiq ob-havo har bir narxda +20 dona qo‘shsa, yangi tenglama Qd\' = 140 - 10P bo‘ladi.',
          },
          {
            kind: 'misconception',
            heading: 'Keng tarqalgan xato',
            body: 'Tovarning o‘z narxi o‘zgarishi hech qachon talab egri chizig‘ini siljitmaydi — u faqat mavjud chiziq bo‘ylab nuqtani ko‘chiradi.',
          },
          {
            kind: 'recap',
            heading: 'Asosiy xulosa',
            body: 'Bozor natijasini bashorat qilishdan oldin narx o‘zgarishi va tarkibiy omillar siljishini ajratib oling.',
          },
        ],
        [
          { term: 'Ceteris Paribus', definition: 'Lotinchadan "boshqa sharoitlar teng bo‘lganda" — faqat bitta omil ta’sirini ajratib tahlil qilish usuli.' },
          { term: 'O‘rinbosar tovar', definition: 'Bir-birining o‘rnini bosa oladigan tovarlar (masalan, choy va qahva).' },
        ],
        'supply_demand',
        'WEBVTT\n\n00:00.000 --> 00:09.000\n1-darsga xush kelibsiz. Bugun talab chizig‘i bo‘ylab harakat va to‘liq siljish farqini ko‘ramiz.\n\n00:09.000 --> 00:18.000\nFaqat narx o‘zgarganda talab hajmi o‘zgaradi; tashqi omillar esa butun egri chiziqni siljitadi.',
        '1-dars: Narxlar nega o‘zgaradi. Tovarning o‘z narxi pasayganda, boshqa omillar o‘zgarmasa, talab hajmi mavjud chiziq bo‘ylab oshadi. Daromad yoki did o‘zgarganda esa har bir narx darajasida talab o‘zgarib, chiziq siljiydi. Quyidagi interaktiv grafikda Talab siljishi slayderini sinab ko‘ring.',
        15,
        'prov-econ-1'
      );

      await insertLesson(
        'les-econ-uz-2',
        'ed-econ-beg-uz-v1',
        2,
        'Taklif, chekli xarajat va ishlab chiqaruvchi rag‘batlari',
        'Yuqoriga qiyalangan taklif chizig‘i o‘sib boruvchi chekli xarajatni qanday aks ettirishini o‘rganing.',
        ['Yuqori narx nega taklif hajmini oshirishini tushuntirish.', 'Resurs xarajati siljishini narx bo‘ylab harakatdan ajratish.'],
        [
          {
            kind: 'hook',
            heading: 'Amaliy vaziyat: Novvoyxona quvvatini oshirish',
            body: 'Mahalliy novvoyxona 100 ta nonni odatiy xarajatda pishiradi. Lekin kuniga 200 ta non chiqarish uchun qo‘shimcha ish haqi va zaxira pechlarni yoqish kerak — har bir keyingi non qimmatroqqa tushadi.',
          },
          {
            kind: 'concept',
            heading: 'Chekli xarajat va taklif qonuni',
            body: 'Ishlab chiqaruvchi bozor narxi kamida qo‘shimcha birlikning chekli xarajatini qoplagandagina ishlab chiqarishni kengaytiradi. Qisqa muddatda quvvat cheklangani sari chekli xarajat oshib boradi, shu bois taklif egri chizig‘i yuqoriga yo‘naladi.',
          },
          {
            kind: 'recap',
            heading: 'Asosiy xulosa',
            body: 'Xomashyo narxi, texnologiya va soliqlar taklif chizig‘ini siljitadi; mahsulotning o‘z narxi esa chiziq bo‘ylab harakatlantiradi.',
          },
        ],
        [
          { term: 'Chekli xarajat', definition: 'Qo‘shimcha bir dona mahsulot ishlab chiqarish uchun ketadigan qo‘shimcha xarajat.' },
          { term: 'Taklif shoki', definition: 'Xomashyo narxi yoki texnologiyadagi keskin o‘zgarish natijasida butun taklif chizig‘ining siljishi.' },
        ],
        'supply_demand',
        'WEBVTT\n\n00:00.000 --> 00:09.000\n2-darsda ishlab chiqaruvchi qarorlari va chekli xarajat o‘sishini ko‘rib chiqamiz.',
        '2-darsda taklif tomonini tahlil qilamiz. Qisqa muddatda qo‘shimcha mahsulot chiqarish qimmatlashgani sababli taklif chizig‘i yuqoriga qiyalanadi. Arzonlashgan resurslar yoki yangi texnologiya taklifni o‘ngga siljitadi.',
        15,
        'prov-econ-1'
      );

      await insertLesson(
        'les-econ-uz-3',
        'ed-econ-beg-uz-v1',
        3,
        'Bozor muvozanati, ortiqchalik va narx cheklovlari',
        'Muvozanat narxini hisoblang va majburiy narx shiftlari qanday taqchillik yaratishini ko‘ring.',
        ['Qd = Qs tengligidan muvozanat narx va hajmni topish.', 'Narx shiftidan kelib chiqadigan taqchillikni o‘lchash.'],
        [
          {
            kind: 'concept',
            heading: 'Bozorning muvozanatlashuvi',
            body: 'Talab hajmi taklif hajmiga tenglashgan nuqtada (Qd = Qs) bozor muvozanati qaror topadi. Narx muvozanatdan yuqori bo‘lsa ortiqcha taklif (tovar to‘planishi), past bo‘lsa taqchillik yuzaga keladi.',
          },
          {
            kind: 'formula',
            heading: 'Chiziqli muvozanatni yechish',
            body: 'Qd = 120 - 10P va Qs = 20 + 10P bo‘lsa, 120 - 10P = 20 + 10P → 100 = 20P → P* = 5 va Q* = 70 birlik.',
          },
          {
            kind: 'recap',
            heading: 'Asosiy xulosa',
            body: 'Erkin moslashuvchi narx taqchillik va ortiqchalikni bartaraf etadi; muvozanatdan past narx shifti esa doimiy taqchillikni keltirib chiqaradi.',
          },
        ],
        [
          { term: 'Bozor muvozanati', definition: 'Talab hajmi va taklif hajmi teng bo‘lgan, narx o‘zgarishiga bosim yo‘q holat.' },
          { term: 'Narx shifti', definition: 'Qonuniy ravishda belgilangan maksimal narx; muvozanatdan past bo‘lsa taqchillik tug‘diradi.' },
        ],
        'supply_demand',
        'WEBVTT\n\n00:00.000 --> 00:09.000\n3-darsda talab va taklif kesishadigan muvozanat nuqtasini hisoblaymiz.',
        '3-darsda xaridor va sotuvchi kesishgan nuqta — muvozanatni aniqlaymiz. Qd = Qs tenglamasi P* va Q* ni beradi. Agar narx shifti P* dan past belgilansa, taqchillik yuzaga keladi.',
        15,
        'prov-econ-1'
      );

      // --- MATHEMATICS INTERMEDIATE EN ---
      await insertLesson(
        'les-math-en-1',
        'ed-math-int-en-v1',
        1,
        'From Secant Slopes to the Derivative',
        'Understand how shrinking an interval Δx to zero turns average change into instantaneous rate.',
        ['Compute average rate of change over an interval [x, x + h].', "Interpret f'(x) as the slope of the tangent line."],
        [
          {
            kind: 'hook',
            heading: 'Why Average Speed Is Not Enough',
            body: 'Knowing a firm averaged $500 profit per day this month does not tell you whether today’s extra unit adds profit or loses money. You need the instantaneous marginal rate.',
          },
          {
            kind: 'formula',
            heading: 'The Difference Quotient Limit',
            body: "f'(x) = lim(h→0) [f(x + h) - f(x)] / h. As h approaches zero, the secant line through two points pivots into the tangent line at x.",
          },
          {
            kind: 'recap',
            heading: 'Key Takeaway',
            body: "Move the evaluation point x in the interactive Tangent Slope explorer below to observe how f'(x) tracks curve steepness.",
          },
        ],
        [
          { term: 'Secant Line', definition: 'A straight line joining two distinct points on a curve, measuring average rate of change.' },
          { term: 'Tangent Slope', definition: "The instantaneous rate of change f'(x) at a single point x." },
        ],
        'derivative_tangent',
        'WEBVTT\n\n00:00.000 --> 00:09.000\nLesson 1 connects average secant slopes to the instantaneous derivative.',
        "In Lesson 1, we shrink the step size h toward zero so the secant slope converges to the tangent slope f'(x). Use the interactive Calculus Tangent Slope tool below to test x across the quadratic profit curve.",
        20,
        'prov-math-1'
      );

      await insertLesson(
        'les-math-en-2',
        'ed-math-int-en-v1',
        2,
        'Power, Sum & Chain Rules for Cost & Revenue',
        'Differentiate polynomial and composite economic functions cleanly.',
        ['Apply d/dx(x^n) = n*x^(n-1) to polynomial cost functions.', 'Use the Chain Rule for nested growth or pricing expressions.'],
        [
          {
            kind: 'concept',
            heading: 'Power Rule & Marginal Cost',
            body: "Given total cost C(q) = 120 + 8q + 0.5q^2, differentiating term-by-term gives Marginal Cost MC(q) = C'(q) = 8 + q. Producing the 20th unit adds approximately $28 in cost.",
          },
          {
            kind: 'formula',
            heading: 'Chain Rule',
            body: "If y = f(g(x)), then dy/dx = f'(g(x)) · g'(x). Example: for R(t) = (2t + 5)^3, R'(t) = 3(2t + 5)^2 · 2 = 6(2t + 5)^2.",
          },
        ],
        [{ term: 'Marginal Revenue', definition: "The derivative R'(q) of total revenue with respect to quantity sold." }],
        'derivative_tangent',
        'WEBVTT\n\n00:00.000 --> 00:08.000\nLesson 2 applies the Power and Chain Rules to marginal cost and revenue.',
        'Lesson 2 walks through differentiating cost and revenue polynomials and composite functions using the Power and Chain rules.',
        20,
        'prov-math-1'
      );

      await insertLesson(
        'les-math-en-3',
        'ed-math-int-en-v1',
        3,
        'Optimization: First & Second Derivative Tests',
        "Locate stationary points where f'(x) = 0 and verify maxima vs. minima using curvature f''(x).",
        ["Solve f'(x) = 0 to find candidate critical points.", "Use f''(x) < 0 (concave down) to confirm a maximum and f''(x) > 0 to confirm a minimum."],
        [
          {
            kind: 'example',
            heading: 'Worked Profit Maximization',
            body: "Suppose Profit π(q) = -2q^2 + 48q - 100. First derivative: π'(q) = -4q + 48 = 0 → q* = 12 units. Second derivative: π''(q) = -4 < 0, confirming a strict maximum profit of π(12) = $188.",
          },
        ],
        [
          { term: 'Critical Point', definition: "An interior point where f'(x) = 0 or is undefined." },
          { term: 'Concavity', definition: "Determined by f''(x): negative means concave down (local peak); positive means concave up (local valley)." },
        ],
        'derivative_tangent',
        'WEBVTT\n\n00:00.000 --> 00:08.000\nLesson 3 locates optimal output where marginal profit equals zero.',
        "Lesson 3 proves optimality: set π'(q) = 0 to find q*, then check π''(q) < 0 to verify you found a profit peak rather than a valley.",
        20,
        'prov-math-1'
      );

      // --- MATHEMATICS INTERMEDIATE UZ ---
      await insertLesson(
        'les-math-uz-1',
        'ed-math-int-uz-v1',
        1,
        'Kesuvchidan urinmaga: hosila tushunchasi',
        'Oraliq Δx nolga intilganda o‘rtacha o‘zgarish tezligi qanday qilib oniy tezlikka aylanishini tushuning.',
        ['[x, x + h] oraliqda o‘rtacha o‘zgarish tezligini hisoblash.', "f'(x) ni urinma to‘g‘ri chiziqning burchak koeffitsienti sifatida talqin qilish."],
        [
          {
            kind: 'concept',
            heading: 'Chegaraviy o‘tish va hosila',
            body: "f'(x) = lim(h→0) [f(x + h) - f(x)] / h. h nolga yaqinlashgani sari ikki nuqtadan o‘tuvchi kesuvchi chiziq x nuqtadagi urinmaga aylanadi.",
          },
        ],
        [{ term: 'Urinma burchak koeffitsienti', definition: "Egri chiziqning berilgan nuqtadagi oniy og‘ish tezligi f'(x)." }],
        'derivative_tangent',
        'WEBVTT\n\n00:00.000 --> 00:08.000\n1-darsda kesuvchi chiziqdan urinma va hosila tushunchasiga o‘tamiz.',
        "1-darsda h qadamni nolga yaqinlashtirib, oniy o‘zgarish tezligi f'(x) ni hosil qilamiz. Quyidagi interaktiv grafikda x nuqtasini siljitib ko‘ring.",
        20,
        'prov-math-1'
      );

      await insertLesson(
        'les-math-uz-2',
        'ed-math-int-uz-v1',
        2,
        'Daraja va murakkab funksiya hosilalari',
        'Ko‘phadli va murakkab xarajat-daromad funksiyalaridan hosila olishni mashq qiling.',
        ['d/dx(x^n) = n*x^(n-1) qoidasini iqtisodiy funksiyalarga tatbiq etish.'],
        [
          {
            kind: 'formula',
            heading: 'Marjinal xarajat misoli',
            body: "Agar umumiy xarajat C(q) = 120 + 8q + 0.5q^2 bo‘lsa, hadma-had hosila olish natijasida marjinal xarajat MC(q) = C'(q) = 8 + q hosil bo‘ladi.",
          },
        ],
        [{ term: 'Marjinal daromad', definition: 'Umumiy daromad R(q) funksiyasining mahsulot hajmi q bo‘yicha birinchi hosilasi.' }],
        'derivative_tangent',
        'WEBVTT\n\n00:00.000 --> 00:08.000\n2-darsda daraja va zanjir qoidalari yordamida marjinal ko‘rsatkichlarni topamiz.',
        '2-darsda daraja qoidasi va murakkab funksiya hosilasi orqali marjinal xarajat hamda daromadni hisoblaymiz.',
        20,
        'prov-math-1'
      );

      await insertLesson(
        'les-math-uz-3',
        'ed-math-int-uz-v1',
        3,
        'Optimallashtirish: birinchi va ikkinchi hosila alomatlari',
        "f'(x) = 0 statsionar nuqtalarni topib, f''(x) yordamida maksimum yoki minimumni isbotlang.",
        ["f'(x) = 0 tenglamadan kritik nuqtalarni topish.", "f''(x) < 0 sharti bilan foyda maksimumini tasdiqlash."],
        [
          {
            kind: 'example',
            heading: 'Yechilgan optimallashtirish masalasi',
            body: "Foyda funksiyasi π(q) = -2q^2 + 48q - 100 bo‘lsin. π'(q) = -4q + 48 = 0 → q* = 12. Ikkinchi hosila π''(q) = -4 < 0 bo‘lgani uchun q* = 12 nuqtada qat’iy maksimum (π = 188) erishiladi.",
          },
        ],
        [{ term: 'Kritik nuqta', definition: 'Hosilasi nolga teng yoki aniqlanmagan ichki nuqta.' }],
        'derivative_tangent',
        'WEBVTT\n\n00:00.000 --> 00:08.000\n3-darsda birinchi va ikkinchi hosila alomatlari bilan foyda maksimumini topamiz.',
        '3-darsda foyda funksiyasining birinchi hosilasini nolga tenglashtirib optimal hajmni topamiz va ikkinchi hosila manfiyligi bilan maksimum ekanini isbotlaymiz.',
        20,
        'prov-math-1'
      );

      // --- BUSINESS ADVANCED EN ---
      await insertLesson(
        'les-biz-en-1',
        'ed-biz-adv-en-v1',
        1,
        'Contribution Margin & Break-Even Architecture',
        'Separate variable delivery costs from fixed overhead to find true unit profitability.',
        ['Calculate Unit Contribution Margin = Price - Variable Cost per Unit.', 'Determine break-even unit volume = Fixed Costs / Unit Contribution Margin.'],
        [
          {
            kind: 'concept',
            heading: 'Why Gross Revenue Misleads',
            body: 'Growing revenue on negative unit contribution margin accelerates cash burn. Always verify that each incremental transaction contributes positive margin toward fixed overhead.',
          },
          {
            kind: 'formula',
            heading: 'Break-Even Formula (Hypothetical)',
            body: 'With Price = $80, Variable Delivery Cost = $30, Unit Contribution Margin = $50 (62.5%). If monthly fixed operating costs are $25,000, break-even requires 25,000 / 50 = 500 active units/month.',
          },
        ],
        [{ term: 'Contribution Margin', definition: 'Revenue minus variable costs per unit, available to cover fixed costs and profit.' }],
        'unit_economics',
        'WEBVTT\n\n00:00.000 --> 00:08.000\nLesson 1 decomposes unit contribution margin and break-even volume.',
        'Lesson 1 shows why revenue growth only builds value when unit contribution margin is positive. Use the interactive Unit Economics modeler below to test price, margin, and CAC payback.',
        25,
        'prov-biz-1'
      );

      await insertLesson(
        'les-biz-en-2',
        'ed-biz-adv-en-v1',
        2,
        'LTV, CAC Payback & Churn Sensitivity',
        'Measure how retention compounds customer Lifetime Value and shortens capital payback.',
        ['Compute LTV = (Monthly ARPA × Gross Margin %) / Monthly Churn Rate.', 'Evaluate CAC Payback Months = CAC / (Monthly ARPA × Gross Margin %).'],
        [
          {
            kind: 'example',
            heading: 'Hypothetical Cohort Comparison',
            body: 'At $50 monthly ARPA, 80% gross margin ($40/mo contribution), and 4% monthly churn, expected lifetime is 25 months and LTV = $1,000. With $320 CAC, payback is 8 months and LTV:CAC is 3.125x.',
          },
        ],
        [{ term: 'CAC Payback Period', definition: 'Months of gross-margin contribution needed to recover customer acquisition cost.' }],
        'unit_economics',
        'WEBVTT\n\n00:00.000 --> 00:08.000\nLesson 2 models LTV, CAC payback, and how churn compresses enterprise value.',
        'Lesson 2 walks through LTV, CAC payback months, and why small improvements in monthly retention disproportionately raise LTV.',
        25,
        'prov-biz-1'
      );

      await insertLesson(
        'les-biz-en-3',
        'ed-biz-adv-en-v1',
        3,
        'Working Capital, Cash Flow & Capital Allocation',
        'Understand why profitable companies can run out of cash and how to sequence investments.',
        ['Reconcile net income with operating cash flow via receivables and inventory timing.', 'Prioritize capital allocation by incremental return on invested capital.'],
        [
          {
            kind: 'concept',
            heading: 'Cash Conversion Timing',
            body: 'If you pay suppliers in 15 days but collect from enterprise buyers in 60 days, rapid sales growth temporarily consumes cash—requiring disciplined working capital planning.',
          },
        ],
        [{ term: 'Operating Cash Flow', definition: 'Actual cash generated by core operations after working-capital timing changes.' }],
        'unit_economics',
        'WEBVTT\n\n00:00.000 --> 00:08.000\nLesson 3 reconciles accounting profit with cash flow and capital allocation.',
        'Lesson 3 focuses on working capital cycles and disciplined capital allocation decisions.',
        25,
        'prov-biz-1'
      );

      // --- BUSINESS ADVANCED UZ ---
      await insertLesson(
        'les-biz-uz-1',
        'ed-biz-adv-uz-v1',
        1,
        'Hissa marjasi va zararsizlik nuqtasi arxitekturasi',
        'O‘zgaruvchan xarajatlarni doimiy xarajatlardan ajratib, haqiqiy birlik foydasini aniqlang.',
        ['Birlik hissa marjasi = Narx - O‘zgaruvchan xarajat formulasini qo‘llash.'],
        [
          {
            kind: 'formula',
            heading: 'Zararsizlik nuqtasi (shartli misol)',
            body: 'Narx = $80, o‘zgaruvchan xarajat = $30 bo‘lsa, hissa marjasi = $50. Oylik doimiy xarajatlar $25,000 bo‘lganda zararsizlik hajmi 25,000 / 50 = 500 birlikka teng.',
          },
        ],
        [{ term: 'Hissa marjasi', definition: 'Doimiy xarajatlarni qoplash va foyda yaratish uchun qoladigan birlik daromadi.' }],
        'unit_economics',
        'WEBVTT\n\n00:00.000 --> 00:08.000\n1-darsda hissa marjasi va zararsizlik hajmini hisoblaymiz.',
        '1-darsda har bir sotilgan birlikning doimiy xarajatlarni qoplashdagi ulushini tahlil qilamiz.',
        25,
        'prov-biz-1'
      );

      await insertLesson(
        'les-biz-uz-2',
        'ed-biz-adv-uz-v1',
        2,
        'LTV, CAC qoplanish muddati va churn sezgirligi',
        'Mijozlarni saqlab qolish umrbod qiymatni qanday oshirishini va kapital qaytishini tezlashtirishini o‘rganing.',
        ['LTV = (Oylik ARPA × Yalpi marja %) / Oylik churn formulasini qo‘llash.'],
        [
          {
            kind: 'example',
            heading: 'Shartli kohorta tahlili',
            body: 'Oylik $50 ARPA, 80% yalpi marja ($40 hissa) va 4% oylik churn sharoitida LTV = $1,000. $320 CAC bilan qoplanish muddati 8 oyni tashkil etadi.',
          },
        ],
        [{ term: 'CAC qoplanish muddati', definition: 'Mijoz jalb qilish xarajatini qoplash uchun zarur bo‘lgan oylar soni.' }],
        'unit_economics',
        'WEBVTT\n\n00:00.000 --> 00:08.000\n2-darsda LTV va CAC nisbatini modellashtiramiz.',
        '2-darsda mijoz umrbod qiymati va jalb qilish xarajatining qoplanish muddatini baholaymiz.',
        25,
        'prov-biz-1'
      );

      await insertLesson(
        'les-biz-uz-3',
        'ed-biz-adv-uz-v1',
        3,
        'Aylanma kapital, pul oqimi va kapital taqsimoti',
        'Foydali korxonalarda ham nega naqd pul taqchilligi yuzaga kelishi mumkinligini tushuning.',
        ['Sof foydani operatsion pul oqimi bilan solishtirish.'],
        [
          {
            kind: 'concept',
            heading: 'Pul aylanish vaqti',
            body: 'Yetkazib beruvchilarga 15 kunda to‘lab, mijozlardan to‘lovni 60 kunda olsangiz, tez o‘sish vaqtincha naqd pulni bog‘lab qo‘yadi.',
          },
        ],
        [{ term: 'Operatsion pul oqimi', definition: 'Asosiy faoliyatdan aylanma kapital o‘zgarishlaridan keyin qoladigan haqiqiy pul.' }],
        'unit_economics',
        'WEBVTT\n\n00:00.000 --> 00:08.000\n3-darsda aylanma kapital va kapital taqsimotini o‘rganamiz.',
        '3-darsda buxgalteriya foydasi va real pul oqimi o‘rtasidagi farqni tahlil qilamiz.',
        25,
        'prov-biz-1'
      );

      // Pending draft lesson
      await insertLesson(
        'les-econ-int-draft-1',
        'ed-econ-int-en-v1',
        1,
        'Demand-Pull vs. Cost-Push Inflation (Draft)',
        'AI-assisted outline awaiting human economics faculty verification.',
        ['Differentiate aggregate demand surges from supply-chain cost shocks.'],
        [
          {
            kind: 'concept',
            heading: 'Draft Concept Note',
            body: 'This lesson is currently in Subject Review. Do not cite or certify until subject, language, and rights reviewers sign off.',
          },
        ],
        [],
        'none',
        '',
        'Draft transcript pending voice & caption review.',
        15,
        'prov-econ-draft'
      );

      // 5. Assessments & Questions
      const seedAssessment = async (
        id: string,
        editionId: string,
        title: string,
        retryText: string,
        qs: Array<{
          id: string;
          obj: string;
          prompt: string;
          options: string[];
          correct: number;
          explanation: string;
        }>
      ) => {
        await tx.execute(
          `INSERT INTO assessments (id, edition_id, title, passing_score_percent, max_attempts_per_day, retry_policy_text, version)
           VALUES ($1, $2, $3, 70, 5, $4, 1)
           ON CONFLICT (id) DO NOTHING`,
          [id, editionId, title, retryText]
        );
        for (let idx = 0; idx < qs.length; idx++) {
          const q = qs[idx];
          await tx.execute(
            `INSERT INTO questions (id, assessment_id, sequence_num, objective_ref, prompt, options_json, correct_option_index, explanation)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [`${id}-${q.id}`, id, idx + 1, q.obj, q.prompt, json(q.options), q.correct, q.explanation]
          );
        }
      };

      await seedAssessment(
        'asmt-econ-beg-en',
        'ed-econ-beg-en-v1',
        'Supply, Demand & Equilibrium Mastery Check',
        'Up to 5 attempts per day. Passing requires 70% (4 of 5 correct). Explanations are shown after submission.',
        [
          {
            id: 'q1',
            obj: 'les-econ-en-1',
            prompt: 'When the price of coffee drops from $5 to $3 (all else equal), what occurs on the coffee demand graph?',
            options: [
              'The entire demand curve shifts rightward',
              'A movement downward along the existing demand curve',
              'The supply curve shifts leftward',
              'Equilibrium quantity becomes zero',
            ],
            correct: 1,
            explanation: 'A change in the good’s own price causes a movement along the existing demand curve, not a curve shift.',
          },
          {
            id: 'q2',
            obj: 'les-econ-en-1',
            prompt: 'Tea and coffee are substitutes. If the price of tea rises sharply, what happens to the demand for coffee?',
            options: [
              'Coffee demand shifts right (increases at every price)',
              'Coffee demand shifts left',
              'Only quantity supplied changes',
              'Coffee becomes a complement',
            ],
            correct: 0,
            explanation: 'More expensive tea causes some consumers to switch to coffee, shifting coffee demand rightward.',
          },
          {
            id: 'q3',
            obj: 'les-econ-en-2',
            prompt: 'Why does a short-run supply curve typically slope upward?',
            options: [
              'Buyers prefer paying higher prices',
              'Marginal production costs tend to rise as output expands',
              'Governments mandate higher prices',
              'Demand and supply are identical lines',
            ],
            correct: 1,
            explanation: 'Higher prices are needed to cover rising marginal cost on additional output units.',
          },
          {
            id: 'q4',
            obj: 'les-econ-en-3',
            prompt: 'Given Qd = 100 - 5P and Qs = 20 + 5P, what is the equilibrium price P*?',
            options: ['$5', '$8', '$10', '$12'],
            correct: 1,
            explanation: 'Setting 100 - 5P = 20 + 5P gives 80 = 10P, so P* = $8 (and Q* = 60).',
          },
          {
            id: 'q5',
            obj: 'les-econ-en-3',
            prompt: 'What market imbalance occurs when a binding price ceiling is set below equilibrium price?',
            options: [
              'Persistent surplus (Qs > Qd)',
              'Persistent shortage (Qd > Qs)',
              'Immediate market clearing',
              'Zero consumer demand',
            ],
            correct: 1,
            explanation: 'Below equilibrium price, buyers demand more than producers are willing to supply, creating a shortage.',
          },
        ]
      );

      await seedAssessment(
        'asmt-econ-beg-uz',
        'ed-econ-beg-uz-v1',
        'Talab, taklif va muvozanat bo‘yicha yakuniy baholash',
        'Kuniga 5 martagacha urinish mumkin. O‘tish chegarasi — 70% (5 tadan kamida 4 ta to‘g‘ri).',
        [
          {
            id: 'q1',
            obj: 'les-econ-uz-1',
            prompt: 'Boshqa sharoitlar o‘zgarmaganda qahva narxi 5 dan 3 ga tushsa, grafikda nima sodir bo‘ladi?',
            options: [
              'Butun talab egri chizig‘i o‘ngga siljiydi',
              'Mavjud talab chizig‘i bo‘ylab pastga harakat bo‘ladi',
              'Taklif chizig‘i chapga siljiydi',
              'Talab nolga tushadi',
            ],
            correct: 1,
            explanation: 'Tovarning o‘z narxi o‘zgarishi chiziqni siljitmaydi, balki mavjud chiziq bo‘ylab harakatni yuzaga keltiradi.',
          },
          {
            id: 'q2',
            obj: 'les-econ-uz-1',
            prompt: 'Choy va qahva o‘rinbosar tovarlar. Choy narxi keskin oshsa, qahva talabi qanday o‘zgaradi?',
            options: [
              'Qahva talab chizig‘i o‘ngga siljiydi',
              'Qahva talab chizig‘i chapga siljiydi',
              'Hech qanday o‘zgarish bo‘lmaydi',
              'Qahva narxi nolga tushadi',
            ],
            correct: 0,
            explanation: 'Choy qimmatlashganda iste’molchilarning bir qismi qahvaga o‘tadi va qahvaga talab ortadi.',
          },
          {
            id: 'q3',
            obj: 'les-econ-uz-2',
            prompt: 'Qisqa muddatli taklif egri chizig‘i nega odatda yuqoriga yo‘nalgan bo‘ladi?',
            options: [
              'Ishlab chiqarish hajmi oshgani sari chekli xarajat ko‘tariladi',
              'Xaridorlar qimmat tovarni afzal ko‘radi',
              'Talab va taklif bir xil chiziqdir',
              'Soliqlar har doim nolga teng',
            ],
            correct: 0,
            explanation: 'Qo‘shimcha mahsulot birligining chekli xarajati oshgani uchun yuqori narx zarur bo‘ladi.',
          },
          {
            id: 'q4',
            obj: 'les-econ-uz-3',
            prompt: 'Qd = 100 - 5P va Qs = 20 + 5P bo‘lsa, muvozanat narx P* nechaga teng?',
            options: ['5', '8', '10', '12'],
            correct: 1,
            explanation: '100 - 5P = 20 + 5P → 80 = 10P → P* = 8.',
          },
          {
            id: 'q5',
            obj: 'les-econ-uz-3',
            prompt: 'Muvozanat narxidan pastda belgilangan majburiy narx shifti nimani keltirib chiqaradi?',
            options: [
              'Doimiy ortiqcha taklifni',
              'Doimiy taqchillikni (Qd > Qs)',
              'Bozor muvozanatini',
              'Xarajatlarning nolga tushishini',
            ],
            correct: 1,
            explanation: 'Past narxda xaridorlar talabi ishlab chiqaruvchilar taklifidan oshib ketadi va taqchillik yuzaga keladi.',
          },
        ]
      );

      await seedAssessment(
        'asmt-math-int-en',
        'ed-math-int-en-v1',
        'Applied Calculus & Optimization Assessment',
        'Up to 5 attempts per day. Passing threshold: 70%.',
        [
          {
            id: 'q1',
            obj: 'les-math-en-1',
            prompt: "Geometrically, what does f'(a) represent on the graph of y = f(x)?",
            options: [
              'The y-intercept of the function',
              'The slope of the tangent line at x = a',
              'The total area under the curve',
              'The average value over [0, a]',
            ],
            correct: 1,
            explanation: "The derivative f'(a) equals the slope of the line tangent to f at x = a.",
          },
          {
            id: 'q2',
            obj: 'les-math-en-2',
            prompt: 'If total cost C(q) = 50 + 6q + 2q^2, what is Marginal Cost MC(q)?',
            options: ['6 + 2q', '6 + 4q', '50 + 4q', '4q'],
            correct: 1,
            explanation: 'Differentiating term-by-term: d/dq(50)=0, d/dq(6q)=6, d/dq(2q^2)=4q.',
          },
          {
            id: 'q3',
            obj: 'les-math-en-2',
            prompt: 'Using the Chain Rule, find d/dx of (3x - 1)^4.',
            options: ['4(3x - 1)^3', '12(3x - 1)^3', '3(3x - 1)^4', '12x^3'],
            correct: 1,
            explanation: 'Outer derivative 4(3x - 1)^3 multiplied by inner derivative 3 gives 12(3x - 1)^3.',
          },
          {
            id: 'q4',
            obj: 'les-math-en-3',
            prompt: 'For π(q) = -q^2 + 20q - 40, at what quantity q* is profit maximized?',
            options: ['q* = 5', 'q* = 10', 'q* = 20', 'q* = 40'],
            correct: 1,
            explanation: "Setting π'(q) = -2q + 20 = 0 gives q* = 10, and π''(10) = -2 < 0 confirms a maximum.",
          },
          {
            id: 'q5',
            obj: 'les-math-en-3',
            prompt: "If f'(c) = 0 and f''(c) > 0, what is x = c?",
            options: ['A local minimum', 'A local maximum', 'Always zero', 'Undefined'],
            correct: 0,
            explanation: 'Positive second derivative indicates upward concavity, so the stationary point is a local minimum.',
          },
        ]
      );

      await seedAssessment(
        'asmt-math-int-uz',
        'ed-math-int-uz-v1',
        'Amaliy matematik analiz bo‘yicha yakuniy baholash',
        'Kuniga 5 urinishgacha ruxsat. O‘tish balli: 70%.',
        [
          {
            id: 'q1',
            obj: 'les-math-uz-1',
            prompt: "Geometrik jihatdan f'(a) nimani anglatadi?",
            options: [
              'Funksiya y-kesishmasini',
              'x = a nuqtadagi urinma burchak koeffitsientini',
              'Egri chiziq ostidagi yuzani',
              'O‘rtacha qiymatni',
            ],
            correct: 1,
            explanation: "Hosila f'(a) berilgan nuqtadagi urinma to‘g‘ri chiziqning og‘ish burchak koeffitsientiga teng.",
          },
          {
            id: 'q2',
            obj: 'les-math-uz-2',
            prompt: 'C(q) = 50 + 6q + 2q^2 bo‘lsa, marjinal xarajat MC(q) nechaga teng?',
            options: ['6 + 2q', '6 + 4q', '50 + 4q', '4q'],
            correct: 1,
            explanation: 'Hadma-had hosila: 0 + 6 + 4q = 6 + 4q.',
          },
          {
            id: 'q3',
            obj: 'les-math-uz-2',
            prompt: 'Zanjir qoidasiga ko‘ra (3x - 1)^4 funksiyasining hosilasini toping.',
            options: ['4(3x - 1)^3', '12(3x - 1)^3', '3(3x - 1)^4', '12x^3'],
            correct: 1,
            explanation: 'Tashqi hosila 4(3x - 1)^3 ni ichki hosila 3 ga ko‘paytirsak, 12(3x - 1)^3 chiqadi.',
          },
          {
            id: 'q4',
            obj: 'les-math-uz-3',
            prompt: 'π(q) = -q^2 + 20q - 40 foyda funksiyasi qaysi q* da maksimumga erishadi?',
            options: ['q* = 5', 'q* = 10', 'q* = 20', 'q* = 40'],
            correct: 1,
            explanation: "π'(q) = -2q + 20 = 0 dan q* = 10 kelib chiqadi; π''(10) = -2 < 0 maksimum ekanini tasdiqlaydi.",
          },
          {
            id: 'q5',
            obj: 'les-math-uz-3',
            prompt: "Agar f'(c) = 0 va f''(c) > 0 bo‘lsa, x = c nuqta nima?",
            options: ['Lokal minimum', 'Lokal maksimum', 'Har doim nol', 'Aniqlanmagan'],
            correct: 0,
            explanation: 'Ikkinchi hosila musbat bo‘lsa, grafik yuqoriga botiq bo‘lib, c nuqtada lokal minimum hosil qiladi.',
          },
        ]
      );

      await seedAssessment(
        'asmt-biz-adv-en',
        'ed-biz-adv-en-v1',
        'Unit Economics & Capital Allocation Capstone',
        'Up to 5 attempts per day. Passing requires 70%.',
        [
          {
            id: 'q1',
            obj: 'les-biz-en-1',
            prompt: 'A SaaS unit sells for $100/mo with $20/mo variable hosting & support cost. Fixed overhead is $40,000/mo. What is break-even unit volume?',
            options: ['400 units', '500 units', '600 units', '800 units'],
            correct: 1,
            explanation: 'Contribution margin is $100 - $20 = $80/unit. Break-even = $40,000 / $80 = 500 units.',
          },
          {
            id: 'q2',
            obj: 'les-biz-en-2',
            prompt: 'Monthly ARPA is $60, gross margin is 75%, and monthly churn is 5%. What is customer LTV?',
            options: ['$450', '$900', '$1,200', '$1,500'],
            correct: 1,
            explanation: 'Monthly gross profit = $60 × 0.75 = $45. Divided by 0.05 churn gives LTV = $900.',
          },
          {
            id: 'q3',
            obj: 'les-biz-en-2',
            prompt: 'If CAC is $270 and monthly gross-margin contribution per customer is $45, what is CAC payback?',
            options: ['3 months', '6 months', '9 months', '12 months'],
            correct: 1,
            explanation: 'Payback = $270 / $45 = 6 months.',
          },
          {
            id: 'q4',
            obj: 'les-biz-en-3',
            prompt: 'A company reports positive net income, yet cash falls sharply as receivables double. Why?',
            options: [
              'Accrual revenue was booked before cash was collected',
              'Fixed assets never require cash',
              'Churn dropped to zero',
              'Contribution margin exceeded 100%',
            ],
            correct: 0,
            explanation: 'Rising accounts receivable ties up working capital so operating cash flow lags accounting profit.',
          },
          {
            id: 'q5',
            obj: 'les-biz-en-1',
            prompt: 'What happens if a firm scales customer acquisition while unit contribution margin is negative?',
            options: [
              'Fixed costs vanish automatically',
              'Cash burn accelerates with every added customer',
              'CAC payback becomes instantaneous',
              'LTV turns infinite',
            ],
            correct: 1,
            explanation: 'Negative unit contribution means each added customer loses money before covering fixed overhead.',
          },
        ]
      );

      await seedAssessment(
        'asmt-biz-adv-uz',
        'ed-biz-adv-uz-v1',
        'Unit-iqtisodiyot va kapital taqsimoti yakuniy testi',
        'Kuniga 5 urinishgacha. O‘tish chegarasi: 70%.',
        [
          {
            id: 'q1',
            obj: 'les-biz-uz-1',
            prompt: 'Mahsulot narxi $100, o‘zgaruvchan xarajat $20, oylik doimiy xarajat $40,000. Zararsizlik hajmi qancha?',
            options: ['400 dona', '500 dona', '600 dona', '800 dona'],
            correct: 1,
            explanation: 'Hissa marjasi $100 - $20 = $80. Zararsizlik = $40,000 / $80 = 500 dona.',
          },
          {
            id: 'q2',
            obj: 'les-biz-uz-2',
            prompt: 'Oylik ARPA $60, yalpi marja 75%, oylik churn 5% bo‘lsa, LTV qancha?',
            options: ['$450', '$900', '$1,200', '$1,500'],
            correct: 1,
            explanation: 'Oylik yalpi foyda = $60 × 0.75 = $45. 0.05 churn ga bo‘linsa, LTV = $900.',
          },
          {
            id: 'q3',
            obj: 'les-biz-uz-2',
            prompt: 'CAC = $270 va mijozdan oylik yalpi foyda $45 bo‘lsa, qoplanish muddati necha oy?',
            options: ['3 oy', '6 oy', '9 oy', '12 oy'],
            correct: 1,
            explanation: '$270 / $45 = 6 oy.',
          },
          {
            id: 'q4',
            obj: 'les-biz-uz-3',
            prompt: 'Sof foyda ijobiy bo‘lsa-da, debitor qarzdorlik ikki barobar oshgani uchun naqd pul kamaydi. Sababi nima?',
            options: [
              'Daromad hisoblandi, lekin naqd pul hali kelib tushmadi',
              'Doimiy xarajatlar yo‘qoldi',
              'Churn nolga tushdi',
              'Marja 100% dan oshdi',
            ],
            correct: 0,
            explanation: 'Debitor qarzdorlikning o‘sishi aylanma kapitalni band qiladi va pul oqimini kechiktiradi.',
          },
          {
            id: 'q5',
            obj: 'les-biz-uz-1',
            prompt: 'Birlik hissa marjasi manfiy bo‘lgan holda mijozlar sonini tez ko‘paytirish nimaga olib keladi?',
            options: [
              'Doimiy xarajatlar yo‘qolishiga',
              'Har bir yangi mijoz naqd pul yo‘qotilishini tezlashtirishiga',
              'CAC ning nolga tushishiga',
              'LTV ning cheksiz o‘sishiga',
            ],
            correct: 1,
            explanation: 'Manfiy hissa marjasi sharoitida o‘sish zarar hajmini ko‘paytiradi.',
          },
        ]
      );
    }

    // 6. Seed Cohort Leaderboard Scholars & Current-Week Quiz Assessment Attempts
    if (shouldSeedCohort) {
      const insertUser = async (id: string, email: string, pw: string, role: string) => {
        await tx.execute(
          `INSERT INTO users (id, email, password_hash, role, created_at)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
          [id, email, hashPassword(pw), role, now]
        );
      };
      const insertProfile = async (
        userId: string,
        displayName: string,
        locale: string,
        ageBand: string,
        optIn: boolean,
        pseudo: string
      ) => {
        await tx.execute(
          `INSERT INTO learner_profiles (
            user_id, display_name, preferred_locale, timezone, age_band,
            leaderboard_opt_in, leaderboard_pseudonym, consent_accepted_at, consent_version
          ) VALUES ($1, $2, $3, 'Asia/Tashkent', $4, $5, $6, $7, 'v1')
          ON CONFLICT (user_id) DO NOTHING`,
          [userId, displayName, locale, ageBand, optIn, pseudo, now]
        );
      };

      await insertUser('user-dilnoza', 'dilnoza@econova.uz', 'EconovaLearn!2026', 'learner');
      await insertProfile('user-dilnoza', 'Dilnoza R.', 'en', 'university', true, 'TashkentScholar');

      await insertUser('user-azamat', 'azamat@econova.uz', 'EconovaPeer!2026', 'learner');
      await insertProfile('user-azamat', 'Azamat K.', 'uz', 'university', true, 'SamarkandQuant');

      await insertUser('user-malika', 'malika@econova.uz', 'EconovaPeer2!2026', 'learner');
      await insertProfile('user-malika', 'Malika T.', 'en', 'school', true, 'BukharaAnalyst');

      if (process.env.ENABLE_DEMO_SANDBOX === 'true') {
        await insertUser('user-editor', 'editor@econova.uz', 'EconovaStaff!2026', 'admin');
        await insertProfile('user-editor', 'Editorial Lead', 'en', 'independent', false, 'StaffEditorial');
      }

      await tx.execute(
        `INSERT INTO enrollments (id, user_id, course_id, locale, journey_status, enrolled_at)
         VALUES ('enr-dilnoza-econ', 'user-dilnoza', 'course-econ-beg', 'en', 'progressing', $1)
         ON CONFLICT (id) DO NOTHING`,
        [now]
      );
      await tx.execute(
        `INSERT INTO lesson_progress (id, user_id, lesson_id, edition_version, state, completion_evidence, updated_at)
         VALUES ('lp-dilnoza-1', 'user-dilnoza', 'les-econ-en-1', 1, 'completed', 'simulation_and_read', $1)
         ON CONFLICT (id) DO NOTHING`,
        [now]
      );
      await tx.execute(
        `INSERT INTO xp_ledger (id, user_id, event_type, reference_id, amount, status, idempotency_key, rule_version, description, created_at)
         VALUES ('xp-dilnoza-1', 'user-dilnoza', 'lesson_completed', 'les-econ-en-1', 25, 'valid', 'lesson:user-dilnoza:les-econ-en-1:v1', 'v1-non-cash', 'Completed Lesson 1: Why Prices Move (Economics Beginner)', $1)
         ON CONFLICT (id) DO NOTHING`,
        [now]
      );
      await tx.execute(
        `INSERT INTO xp_ledger (id, user_id, event_type, reference_id, amount, status, idempotency_key, rule_version, description, created_at)
         VALUES ('xp-azamat-1', 'user-azamat', 'course_completed', 'course-math-int', 175, 'valid', 'seed:azamat:1', 'v1-non-cash', 'Completed Applied Calculus modules', $1)
         ON CONFLICT (id) DO NOTHING`,
        [now]
      );
      await tx.execute(
        `INSERT INTO xp_ledger (id, user_id, event_type, reference_id, amount, status, idempotency_key, rule_version, description, created_at)
         VALUES ('xp-malika-1', 'user-malika', 'assessment_passed', 'asmt-econ-beg-en', 100, 'valid', 'seed:malika:1', 'v1-non-cash', 'Passed Economics foundations check', $1)
         ON CONFLICT (id) DO NOTHING`,
        [now]
      );
      await tx.execute(
        `INSERT INTO streak_records (user_id, current_streak, best_streak, last_activity_local_date, timezone)
         VALUES ('user-dilnoza', 2, 2, $1, 'Asia/Tashkent')
         ON CONFLICT (user_id) DO NOTHING`,
        [new Date().toISOString().slice(0, 10)]
      );
      await tx.execute(
        `INSERT INTO badge_awards (id, user_id, badge_key, title, criteria, awarded_at, idempotency_key)
         VALUES ('bdg-dilnoza-1', 'user-dilnoza', 'first_lesson', 'First Step in Economics', 'Complete your first reviewed lesson in any ECONOVA course.', $1, 'badge:user-dilnoza:first_lesson')
         ON CONFLICT (id) DO NOTHING`,
        [now]
      );
      await tx.execute(
        `INSERT INTO referral_codes (code, owner_user_id, created_at)
         VALUES ('ECO-DILNOZA', 'user-dilnoza', $1)
         ON CONFLICT (code) DO NOTHING`,
        [now]
      );

      // Seed current-week course assessment attempts for the Weekly Quiz Leaderboard
      const nowMs = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const insertWeeklyAttempt = async (
        id: string,
        userId: string,
        assessmentId: string,
        scorePercent: number,
        passed: boolean,
        daysAgo: number
      ) => {
        const createdAt = new Date(nowMs - daysAgo * dayMs).toISOString();
        await tx.execute(
          `INSERT INTO assessment_attempts (
            id, user_id, assessment_id, edition_version, responses_json, score_percent, passed, created_at
          ) VALUES ($1, $2, $3, 1, '{}'::jsonb, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET created_at = EXCLUDED.created_at, score_percent = EXCLUDED.score_percent`,
          [id, userId, assessmentId, scorePercent, passed, createdAt]
        );
      };

      await insertWeeklyAttempt('att-seed-math-azamat', 'user-azamat', 'asmt-math-int-en', 100, true, 1);
      await insertWeeklyAttempt('att-seed-econ-malika', 'user-malika', 'asmt-econ-beg-en', 100, true, 2);
      await insertWeeklyAttempt('att-seed-econ-dilnoza-1', 'user-dilnoza', 'asmt-econ-beg-en', 80, true, 3);
      await insertWeeklyAttempt('att-seed-econ-dilnoza-2', 'user-dilnoza', 'asmt-econ-beg-en', 94, true, 1);
      await insertWeeklyAttempt('att-seed-biz-azamat', 'user-azamat', 'asmt-biz-adv-en', 92, true, 2);
      await insertWeeklyAttempt('att-seed-math-malika', 'user-malika', 'asmt-math-int-en', 88, true, 3);
      await insertWeeklyAttempt('att-seed-biz-dilnoza', 'user-dilnoza', 'asmt-biz-adv-en', 84, true, 2);
    }
  });
}
