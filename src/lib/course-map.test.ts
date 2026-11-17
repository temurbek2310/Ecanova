import test from 'node:test';
import assert from 'node:assert/strict';
import type { AssessmentPublic, LessonPublic } from '../shared/types';
import { buildCourseMapGraph } from './course-map';

function makeLesson(seq: number, isRequired = true): LessonPublic {
  return {
    id: `les-${seq}`,
    editionId: 'ed-1',
    sequenceNum: seq,
    title: `Lesson ${seq} Title`,
    summary: `Summary ${seq}`,
    objectives: [],
    bodyBlocks: [],
    keyTerms: [],
    simulationType: 'none',
    videoUrl: null,
    captionsVtt: null,
    transcript: '',
    estimatedMinutes: 15,
    isRequired,
    provenance: null,
  };
}

const sampleAssessment: AssessmentPublic = {
  id: 'assess-1',
  editionId: 'ed-1',
  title: 'Final Exam',
  passingScorePercent: 70,
  maxAttemptsPerDay: 5,
  retryPolicyText: '5 tries',
  version: 1,
  questions: [],
};

test('buildCourseMapGraph creates prerequisite -> lessons -> assessment flow with D3 edge paths', () => {
  const graph = buildCourseMapGraph({
    prerequisites: ['Basic algebra'],
    lessons: [makeLesson(2), makeLesson(1), makeLesson(3)],
    assessment: sampleAssessment,
    completedLessonIds: ['les-1'],
    passedAssessment: false,
    activeLessonIndex: 1,
    locale: 'en',
    containerWidth: 960,
  });

  assert.equal(graph.orientation, 'horizontal');
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ['prereq', 'lesson-les-1', 'lesson-les-2', 'lesson-les-3', 'assessment']
  );

  // Node statuses reflect progress path accurately
  assert.equal(graph.nodes[0].status, 'prerequisite');
  assert.equal(graph.nodes[1].status, 'completed');
  assert.equal(graph.nodes[2].status, 'active'); // activeLessonIndex=1 -> les-2
  assert.equal(graph.nodes[3].status, 'upcoming');
  assert.equal(graph.nodes[4].status, 'upcoming');
  assert.equal(graph.nextRecommendedNodeId, 'lesson-les-2');

  // Edges contain valid SVG path strings from D3 link generators
  assert.equal(graph.edges.length, 4);
  for (const edge of graph.edges) {
    assert.ok(edge.pathD.startsWith('M'), `Expected valid SVG path, got: ${edge.pathD}`);
  }
  assert.equal(graph.edges[0].state, 'completed'); // prereq -> completed lesson 1
  assert.equal(graph.edges[1].state, 'active'); // completed lesson 1 -> active lesson 2
  assert.equal(graph.edges[2].state, 'upcoming');

  assert.equal(graph.completedMilestones, 1);
  assert.equal(graph.totalMilestones, 4); // 3 required lessons + 1 assessment
  assert.equal(graph.progressPercent, 25);
});

test('buildCourseMapGraph switches to vertical flow on mobile widths and advances nextRecommendedNodeId to assessment', () => {
  const graph = buildCourseMapGraph({
    prerequisites: [],
    lessons: [makeLesson(1), makeLesson(2)],
    assessment: sampleAssessment,
    completedLessonIds: ['les-1', 'les-2'],
    passedAssessment: false,
    activeLessonIndex: 0,
    locale: 'uz',
    containerWidth: 340,
  });

  assert.equal(graph.orientation, 'vertical');
  assert.equal(graph.nodes[0].subtitle, 'Maxsus talab yo‘q');
  assert.equal(graph.nextRecommendedNodeId, 'assessment');
  assert.equal(graph.nodes[3].status, 'next_up');
  assert.equal(graph.edges[2].state, 'active');
  assert.equal(graph.progressPercent, 67);
});

test('buildCourseMapGraph supports multi-row wrapping when course has more than 4 lessons', () => {
  const lessons = [1, 2, 3, 4, 5].map((n) => makeLesson(n));
  const graph = buildCourseMapGraph({
    prerequisites: ['Intro microeconomics'],
    lessons,
    assessment: sampleAssessment,
    completedLessonIds: [],
    passedAssessment: false,
    activeLessonIndex: 0,
    locale: 'en',
    containerWidth: 960,
  });

  assert.equal(graph.nodes.length, 7);
  assert.equal(graph.nodes[3].row, 0);
  assert.equal(graph.nodes[4].row, 1);
  // Row-wrap edge exists and produces valid SVG path
  assert.equal(graph.edges[3].sourceId, graph.nodes[3].id);
  assert.equal(graph.edges[3].targetId, graph.nodes[4].id);
  assert.ok(graph.edges[3].pathD.startsWith('M'));
});
