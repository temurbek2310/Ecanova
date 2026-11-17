import React, { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Route,
} from 'lucide-react';
import type { AssessmentPublic, LessonPublic, LocaleCode } from '../shared/types';
import { buildCourseMapGraph, type CourseMapEdge, type CourseMapNode } from '../lib/course-map';
import { t } from '../lib/i18n';

interface CourseMapProps {
  courseId: string;
  prerequisites: string[];
  lessons: LessonPublic[];
  assessment: AssessmentPublic | null;
  completedLessonIds: string[];
  passedAssessment: boolean;
  activeLessonIndex: number | 'assessment';
  locale: LocaleCode;
  onSelectLesson: (lessonIndex: number) => void;
  onSelectAssessment: () => void;
}

export const CourseMap: React.FC<CourseMapProps> = ({
  courseId,
  prerequisites,
  lessons,
  assessment,
  completedLessonIds,
  passedAssessment,
  activeLessonIndex,
  locale,
  onSelectLesson,
  onSelectAssessment,
}) => {
  const strings = t(locale);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(960);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) {
        setContainerWidth(next);
      }
    };

    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const graph = useMemo(
    () =>
      buildCourseMapGraph({
        prerequisites,
        lessons,
        assessment,
        completedLessonIds,
        passedAssessment,
        activeLessonIndex,
        locale,
        containerWidth,
      }),
    [
      prerequisites,
      lessons,
      assessment,
      completedLessonIds,
      passedAssessment,
      activeLessonIndex,
      locale,
      containerWidth,
    ]
  );

  // Render directed flow paths and markers cleanly via D3 selection & data join
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = select(svgEl);
    svg
      .attr('viewBox', `0 0 ${graph.canvasWidth} ${graph.canvasHeight}`)
      .attr('width', graph.canvasWidth)
      .attr('height', graph.canvasHeight);

    const defs = svg
      .selectAll<SVGDefsElement, null>('defs')
      .data([null])
      .join('defs');

    const markerConfigs = [
      { id: `cm-arrow-completed-${courseId}`, color: 'var(--econova-success)' },
      { id: `cm-arrow-active-${courseId}`, color: 'var(--econova-teal)' },
      { id: `cm-arrow-upcoming-${courseId}`, color: 'var(--econova-line-strong)' },
      { id: `cm-arrow-focus-${courseId}`, color: 'var(--econova-accent)' },
    ];

    defs
      .selectAll<SVGMarkerElement, (typeof markerConfigs)[number]>('marker')
      .data(markerConfigs, (d) => d.id)
      .join('marker')
      .attr('id', (d) => d.id)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 8)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .selectAll('path')
      .data((d) => [d])
      .join('path')
      .attr('d', 'M 0 1.5 L 8.5 5 L 0 8.5 z')
      .attr('fill', (d) => d.color);

    const edgeGroup = svg
      .selectAll<SVGGElement, null>('g.cm-edges')
      .data([null])
      .join('g')
      .attr('class', 'cm-edges');

    const isHighlighted = (edge: CourseMapEdge) =>
      Boolean(
        hoveredNodeId && (edge.sourceId === hoveredNodeId || edge.targetId === hoveredNodeId)
      );

    edgeGroup
      .selectAll<SVGPathElement, CourseMapEdge>('path.cm-edge')
      .data(graph.edges, (d) => d.id)
      .join('path')
      .attr('class', 'cm-edge')
      .attr('data-edge-state', (d) => d.state)
      .attr('fill', 'none')
      .attr('d', (d) => d.pathD)
      .attr('stroke-linecap', 'round')
      .attr('stroke-width', (d) => (isHighlighted(d) ? 3 : d.state === 'upcoming' ? 1.75 : 2.5))
      .attr('stroke-dasharray', (d) =>
        isHighlighted(d) ? 'none' : d.state === 'upcoming' ? '5 4' : 'none'
      )
      .attr('stroke', (d) => {
        if (isHighlighted(d)) return 'var(--econova-accent)';
        if (d.state === 'completed') return 'var(--econova-success)';
        if (d.state === 'active') return 'var(--econova-teal)';
        return 'var(--econova-line-strong)';
      })
      .attr('marker-end', (d) => {
        if (isHighlighted(d)) return `url(#cm-arrow-focus-${courseId})`;
        if (d.state === 'completed') return `url(#cm-arrow-completed-${courseId})`;
        if (d.state === 'active') return `url(#cm-arrow-active-${courseId})`;
        return `url(#cm-arrow-upcoming-${courseId})`;
      });
  }, [graph, hoveredNodeId, courseId]);

  const statusLabel = (node: CourseMapNode): string => {
    switch (node.status) {
      case 'prerequisite':
        return strings.courseMap.legendPrereq;
      case 'completed':
        return strings.courseMap.legendCompleted;
      case 'active':
        return strings.courseMap.legendActive;
      case 'next_up':
        return strings.courseMap.legendNextUp;
      default:
        return strings.courseMap.legendUpcoming;
    }
  };

  const inspectedNode = useMemo(() => {
    if (hoveredNodeId) {
      const match = graph.nodes.find((n) => n.id === hoveredNodeId);
      if (match) return match;
    }
    return (
      graph.nodes.find((n) => n.status === 'active') ||
      graph.nodes.find((n) => n.status === 'next_up') ||
      graph.nodes[0] ||
      null
    );
  }, [graph.nodes, hoveredNodeId]);

  const inspectedPrereqText = useMemo(() => {
    if (!inspectedNode) return '';
    if (inspectedNode.kind === 'prerequisite') {
      return prerequisites.length > 0
        ? prerequisites.join(' · ')
        : locale === 'uz'
        ? 'Maxsus oldingi bilim talab qilinmaydi'
        : 'No prior course prerequisites required';
    }
    if (inspectedNode.kind === 'lesson' && typeof inspectedNode.lessonIndex === 'number') {
      if (inspectedNode.lessonIndex === 0) {
        return prerequisites.length > 0
          ? `${locale === 'uz' ? 'Kirish talabi:' : 'Prerequisite:'} ${prerequisites.join(' · ')}`
          : locale === 'uz'
          ? 'Kirish darsi — darhol boshlash mumkin'
          : 'Foundational entry lesson — ready to start';
      }
      const prevLesson = lessons[inspectedNode.lessonIndex - 1];
      const prevDone = prevLesson ? completedLessonIds.includes(prevLesson.id) : false;
      return prevLesson
        ? `${locale === 'uz' ? 'Oldingi bosqich:' : 'Prerequisite step:'} ${prevLesson.sequenceNum}. ${prevLesson.title} (${
            prevDone
              ? locale === 'uz'
                ? 'Yakunlangan'
                : 'Completed'
              : locale === 'uz'
              ? 'Tavsiya etiladi'
              : 'Recommended first'
          })`
        : '';
    }
    const remainingReq = lessons.filter(
      (l) => l.isRequired && !completedLessonIds.includes(l.id)
    ).length;
    return remainingReq === 0
      ? locale === 'uz'
        ? 'Barcha majburiy darslar yakunlangan — yakuniy baholashga tayyor!'
        : 'All required lessons completed — ready for final assessment!'
      : locale === 'uz'
      ? `Yakuniy baholashdan oldin yana ${remainingReq} ta majburiy darsni yakunlash tavsiya etiladi.`
      : `Complete ${remainingReq} remaining required lesson(s) before taking the final assessment.`;
  }, [inspectedNode, prerequisites, lessons, completedLessonIds, locale]);

  return (
    <section
      aria-labelledby="course-map-heading"
      data-testid="course-map-section"
      className="rounded-xl border-2 border-slate-500 bg-white/40 p-5 sm:p-6 shadow-[8px_8px_0px_#000000] backdrop-blur-2xl dark:border-[#222B3D] dark:bg-[#101522]/40"
    >
      <div className="flex flex-col gap-3 border-b-2 border-slate-500 dark:border-[#222B3D] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="course-map-heading"
            className="flex items-center gap-2 text-base font-bold text-ink"
          >
            <Route className="h-4 w-4 text-theme-cyan shrink-0" aria-hidden="true" />
            <span>{strings.courseMap.title}</span>
          </h2>
          <p className="mt-1 text-xs text-muted">{strings.courseMap.subtitle}</p>
        </div>

        <div className="flex flex-col items-start gap-1.5 sm:items-end shrink-0">
          <div
            className="font-mono text-xs font-medium tabular-nums text-ink"
            data-testid="course-map-progress-summary"
          >
            {graph.completedMilestones} / {graph.totalMilestones} {strings.courseMap.milestonesLabel} ·{' '}
            <span className="text-teal">{graph.progressPercent}%</span>
          </div>
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted"
            aria-label="Course Map Legend"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              <span>{strings.courseMap.legendCompleted}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              <span>{strings.courseMap.legendActive}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal" aria-hidden="true" />
              <span>{strings.courseMap.legendNextUp}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-line-strong bg-chrome" aria-hidden="true" />
              <span>{strings.courseMap.legendUpcoming}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Responsive D3 Graph Canvas + Synchronized Interactive Nodes */}
      <div
        ref={containerRef}
        className="relative mt-5 w-full max-w-full overflow-hidden select-none"
        data-testid="course-map-canvas"
        data-orientation={graph.orientation}
        style={{ height: `${graph.canvasHeight}px` }}
      >
        <svg
          ref={svgRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        />

        {graph.nodes.map((node) => {
          const basePosStyle: React.CSSProperties = {
            left: `${node.x}px`,
            top: `${node.y}px`,
            width: `${node.width}px`,
            height: `${node.height}px`,
          };

          if (node.kind === 'prerequisite') {
            return (
              <div
                key={node.id}
                style={basePosStyle}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                data-testid="course-map-node-prereq"
                className="absolute flex flex-col justify-between gap-1 overflow-hidden rounded-lg border border-dashed border-line-strong bg-chrome/90 p-3 text-left"
              >
                <div className="flex items-center justify-between gap-1.5 text-[11px] font-medium text-muted">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <Compass className="h-3.5 w-3.5 text-warning shrink-0" aria-hidden="true" />
                    <span className="truncate">{node.title}</span>
                  </span>
                </div>
                <p
                  className="line-clamp-2 text-xs font-medium leading-snug text-ink"
                  title={
                    node.prerequisitesList.length > 0
                      ? node.prerequisitesList.join(' · ')
                      : node.subtitle
                  }
                >
                  {node.subtitle}
                </p>
                <div className="text-[11px] text-muted truncate">
                  {node.prerequisitesList.length > 1
                    ? `+${node.prerequisitesList.length - 1} ${locale === 'uz' ? 'qo‘shimcha' : 'more'}`
                    : locale === 'uz'
                    ? 'Kirish bosqichi'
                    : 'Entry baseline'}
                </div>
              </div>
            );
          }

          const isActive = node.status === 'active';
          const isCompleted = node.completed;
          const isNextUp = node.status === 'next_up';

          const stateBorderClass = isActive
            ? 'border-accent bg-elevated ring-2 ring-accent/35'
            : isCompleted
            ? 'border-success/60 bg-chrome hover:border-success'
            : isNextUp
            ? 'border-teal/70 bg-chrome hover:border-teal'
            : 'border-line bg-chrome hover:border-line-strong';

          const handleClick = () => {
            if (node.kind === 'lesson' && typeof node.lessonIndex === 'number') {
              onSelectLesson(node.lessonIndex);
            } else if (node.kind === 'assessment') {
              onSelectAssessment();
            }
          };

          const headerTag =
            node.kind === 'lesson'
              ? `${strings.courseMap.lessonPrefix} ${node.sequenceNum}`
              : node.title;

          return (
            <button
              key={node.id}
              type="button"
              style={basePosStyle}
              onClick={handleClick}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onFocus={() => setHoveredNodeId(node.id)}
              onBlur={() => setHoveredNodeId(null)}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`${headerTag}: ${node.title} — ${statusLabel(node)} (${node.subtitle})`}
              data-testid={
                node.kind === 'assessment'
                  ? 'course-map-node-assessment'
                  : `course-map-node-lesson-${node.sequenceNum}`
              }
              data-node-status={node.status}
              className={`absolute flex flex-col justify-between rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${stateBorderClass}`}
            >
              <div className="flex w-full items-center justify-between gap-1.5 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums truncate ${
                    isActive
                      ? 'text-accent'
                      : isCompleted
                      ? 'text-success'
                      : isNextUp
                      ? 'text-teal'
                      : 'text-muted'
                  }`}
                >
                  {node.kind === 'assessment' ? (
                    <ClipboardCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{headerTag}</span>
                </span>

                {isCompleted ? (
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0 text-success"
                    aria-hidden="true"
                  />
                ) : isNextUp ? (
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 text-teal"
                    aria-hidden="true"
                  />
                ) : null}
              </div>

              <div className="line-clamp-2 w-full text-xs font-semibold leading-snug text-ink">
                {node.kind === 'assessment'
                  ? assessment?.title || node.title
                  : node.title}
              </div>

              <div className="flex w-full items-center justify-between gap-2 text-[11px] text-muted">
                <span className="truncate">{node.subtitle}</span>
                {(isActive || isNextUp) && (
                  <span
                    className={`shrink-0 font-medium ${
                      isActive ? 'text-accent' : 'text-teal'
                    }`}
                  >
                    {isActive
                      ? strings.courseMap.legendActive
                      : strings.courseMap.legendNextUp}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Prerequisite & Lesson Readiness Inspector Bar */}
      {inspectedNode && (
        <div
          data-testid="course-map-inspector"
          className="mt-4 flex flex-col gap-2 rounded-lg border-2 border-theme-border bg-theme-base p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-semibold text-ink">
              <span className="font-mono text-[11px] text-theme-cyan">
                {statusLabel(inspectedNode)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{inspectedNode.title}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted">{inspectedPrereqText}</p>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-muted">
            {strings.courseMap.selectHint}
          </span>
        </div>
      )}
    </section>
  );
};

