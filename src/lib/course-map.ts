import { curveBumpY, line, linkHorizontal, linkVertical } from 'd3';
import type { AssessmentPublic, LessonPublic, LocaleCode } from '../shared/types';

export type CourseMapNodeKind = 'prerequisite' | 'lesson' | 'assessment';
export type CourseMapNodeStatus =
  | 'prerequisite'
  | 'completed'
  | 'active'
  | 'next_up'
  | 'upcoming';
export type CourseMapEdgeState = 'completed' | 'active' | 'upcoming';

export interface CourseMapNode {
  id: string;
  kind: CourseMapNodeKind;
  stageIndex: number;
  title: string;
  subtitle: string;
  prerequisitesList: string[];
  lessonIndex?: number;
  lessonId?: string;
  sequenceNum?: number;
  estimatedMinutes?: number;
  isRequired?: boolean;
  completed: boolean;
  status: CourseMapNodeStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
}

export interface CourseMapEdge {
  id: string;
  sourceId: string;
  targetId: string;
  state: CourseMapEdgeState;
  pathD: string;
}

export interface CourseMapGraph {
  nodes: CourseMapNode[];
  edges: CourseMapEdge[];
  canvasWidth: number;
  canvasHeight: number;
  orientation: 'horizontal' | 'vertical';
  completedMilestones: number;
  totalMilestones: number;
  progressPercent: number;
  nextRecommendedNodeId: string | null;
}

export interface BuildCourseMapParams {
  prerequisites: readonly string[];
  lessons: readonly LessonPublic[];
  assessment: AssessmentPublic | null;
  completedLessonIds: readonly string[];
  passedAssessment: boolean;
  activeLessonIndex: number | 'assessment';
  locale: LocaleCode;
  containerWidth?: number;
}

export function buildCourseMapGraph(params: BuildCourseMapParams): CourseMapGraph {
  const {
    prerequisites,
    lessons,
    assessment,
    completedLessonIds,
    passedAssessment,
    activeLessonIndex,
    locale,
    containerWidth = 960,
  } = params;

  const sortedLessons = [...lessons].sort((a, b) => a.sequenceNum - b.sequenceNum);
  const completedSet = new Set(completedLessonIds);

  const requiredLessons = sortedLessons.filter((l) => l.isRequired);
  const completedRequiredCount = requiredLessons.filter((l) => completedSet.has(l.id)).length;
  const allRequiredLessonsDone =
    requiredLessons.length === 0 || completedRequiredCount >= requiredLessons.length;

  let nextRecommendedNodeId: string | null = null;
  const firstIncompleteRequired = sortedLessons.find(
    (l) => l.isRequired && !completedSet.has(l.id)
  );
  if (firstIncompleteRequired) {
    nextRecommendedNodeId = `lesson-${firstIncompleteRequired.id}`;
  } else if (assessment && !passedAssessment && allRequiredLessonsDone) {
    nextRecommendedNodeId = 'assessment';
  } else {
    const firstOptionalIncomplete = sortedLessons.find((l) => !completedSet.has(l.id));
    if (firstOptionalIncomplete) {
      nextRecommendedNodeId = `lesson-${firstOptionalIncomplete.id}`;
    }
  }

  const totalMilestones = requiredLessons.length + (assessment ? 1 : 0);
  const completedMilestones =
    completedRequiredCount + (assessment && passedAssessment ? 1 : 0);
  const progressPercent =
    totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const prereqItems = prerequisites.map((p) => p.trim()).filter(Boolean);
  const rawNodes: Array<Omit<CourseMapNode, 'x' | 'y' | 'width' | 'height' | 'row' | 'col'>> = [];

  rawNodes.push({
    id: 'prereq',
    kind: 'prerequisite',
    stageIndex: 0,
    title: locale === 'uz' ? 'Boshlang‘ich talablar' : 'Prerequisites',
    subtitle:
      prereqItems.length > 0
        ? prereqItems[0]
        : locale === 'uz'
        ? 'Maxsus talab yo‘q'
        : 'Open entry · No prior coursework required',
    prerequisitesList: prereqItems,
    completed: completedSet.size > 0 || passedAssessment,
    status: 'prerequisite',
  });

  sortedLessons.forEach((lesson, idx) => {
    const isCompleted = completedSet.has(lesson.id);
    const isActive = activeLessonIndex === idx;
    const nodeId = `lesson-${lesson.id}`;
    const status: CourseMapNodeStatus = isActive
      ? 'active'
      : isCompleted
      ? 'completed'
      : nextRecommendedNodeId === nodeId
      ? 'next_up'
      : 'upcoming';

    const minSuffix = locale === 'uz' ? 'daq' : 'min';
    const reqText = lesson.isRequired
      ? locale === 'uz'
        ? 'Majburiy'
        : 'Required'
      : locale === 'uz'
      ? 'Ixtiyoriy'
      : 'Optional';

    rawNodes.push({
      id: nodeId,
      kind: 'lesson',
      stageIndex: idx + 1,
      title: lesson.title,
      subtitle: `${lesson.estimatedMinutes} ${minSuffix} · ${reqText}`,
      prerequisitesList: [],
      lessonIndex: idx,
      lessonId: lesson.id,
      sequenceNum: lesson.sequenceNum,
      estimatedMinutes: lesson.estimatedMinutes,
      isRequired: lesson.isRequired,
      completed: isCompleted,
      status,
    });
  });

  if (assessment) {
    const isActive = activeLessonIndex === 'assessment';
    const status: CourseMapNodeStatus = isActive
      ? 'active'
      : passedAssessment
      ? 'completed'
      : nextRecommendedNodeId === 'assessment'
      ? 'next_up'
      : 'upcoming';

    rawNodes.push({
      id: 'assessment',
      kind: 'assessment',
      stageIndex: sortedLessons.length + 1,
      title: locale === 'uz' ? 'Yakuniy baholash' : 'Final Assessment',
      subtitle:
        locale === 'uz'
          ? `O‘tish bali: ${assessment.passingScorePercent}%+`
          : `Pass threshold: ${assessment.passingScorePercent}%+`,
      prerequisitesList: [],
      completed: passedAssessment,
      status,
    });
  }

  const safeWidth = Math.max(280, Math.round(containerWidth));
  const orientation: 'horizontal' | 'vertical' = safeWidth < 680 ? 'vertical' : 'horizontal';

  let positionedNodes: CourseMapNode[] = [];
  let canvasHeight = 0;

  if (orientation === 'vertical') {
    const nodeWidth = safeWidth;
    const nodeHeight = 100;
    const gapY = 26;

    positionedNodes = rawNodes.map((n, i) => ({
      ...n,
      x: 0,
      y: i * (nodeHeight + gapY),
      width: nodeWidth,
      height: nodeHeight,
      row: i,
      col: 0,
    }));

    canvasHeight =
      positionedNodes.length > 0
        ? positionedNodes.length * nodeHeight + (positionedNodes.length - 1) * gapY
        : 100;
  } else {
    const cols = rawNodes.length <= 5 ? Math.max(1, rawNodes.length) : 4;
    const gapX = cols >= 5 ? 28 : 36;
    const gapY = 44;
    const nodeWidth = Math.floor((safeWidth - gapX * (cols - 1)) / cols);
    const nodeHeight = 124;

    positionedNodes = rawNodes.map((n, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      return {
        ...n,
        x: col * (nodeWidth + gapX),
        y: row * (nodeHeight + gapY),
        width: nodeWidth,
        height: nodeHeight,
        row,
        col,
      };
    });

    const totalRows = Math.max(1, Math.ceil(rawNodes.length / cols));
    canvasHeight = totalRows * nodeHeight + (totalRows - 1) * gapY;
  }

  const horizGen = linkHorizontal<
    { source: [number, number]; target: [number, number] },
    [number, number]
  >()
    .x((d) => d[0])
    .y((d) => d[1]);

  const vertGen = linkVertical<
    { source: [number, number]; target: [number, number] },
    [number, number]
  >()
    .x((d) => d[0])
    .y((d) => d[1]);

  const wrapCurveGen = line<[number, number]>().curve(curveBumpY);

  const edges: CourseMapEdge[] = [];
  for (let i = 0; i < positionedNodes.length - 1; i++) {
    const source = positionedNodes[i];
    const target = positionedNodes[i + 1];

    let pathD = '';
    if (orientation === 'vertical') {
      const sx = source.x + source.width / 2;
      const sy = source.y + source.height;
      const tx = target.x + target.width / 2;
      const ty = target.y - 4;
      pathD = vertGen({ source: [sx, sy], target: [tx, ty] }) || '';
    } else if (source.row === target.row) {
      const sx = source.x + source.width;
      const sy = source.y + source.height / 2;
      const tx = target.x - 4;
      const ty = target.y + target.height / 2;
      pathD = horizGen({ source: [sx, sy], target: [tx, ty] }) || '';
    } else {
      // Smooth multi-row wrap from end of row R down to start of row R+1
      const sx = source.x + source.width / 2;
      const sy = source.y + source.height;
      const midY = (source.y + source.height + target.y) / 2;
      const tx = target.x + target.width / 2;
      const ty = target.y - 4;
      pathD =
        wrapCurveGen([
          [sx, sy],
          [sx, midY],
          [tx, midY],
          [tx, ty],
        ]) || '';
    }

    let state: CourseMapEdgeState = 'upcoming';
    if (source.kind === 'prerequisite') {
      if (target.completed) {
        state = 'completed';
      } else if (target.status === 'active' || target.status === 'next_up') {
        state = 'active';
      }
    } else if (source.completed && target.completed) {
      state = 'completed';
    } else if (source.completed && (target.status === 'active' || target.status === 'next_up')) {
      state = 'active';
    }

    edges.push({
      id: `${source.id}->${target.id}`,
      sourceId: source.id,
      targetId: target.id,
      state,
      pathD,
    });
  }

  return {
    nodes: positionedNodes,
    edges,
    canvasWidth: safeWidth,
    canvasHeight,
    orientation,
    completedMilestones,
    totalMilestones,
    progressPercent,
    nextRecommendedNodeId,
  };
}
