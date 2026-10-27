import type { Unit } from './types';
export interface QuestionPlan { targets: { slot: number; pointIndex: number; pageNumber: number; type: string; difficulty: number; answerIndex: number; intent: string }[]; targetQuestionCount: number; minimumQuestionCount: number; canGenerate: boolean; coveredPointCount: number; warnings: string[]; method: string; points: { pageNumber: number; text: string; complexity: number; reasons: string[] }[]; questionCount: number; choiceCount: number; blankCount: number; entryCount: number; difficultyCounts: number[] }
export interface ModelChoice { provider: string; model: string; label: string }
export interface SourceRef { documentId: string; pageNumber: number; quote: string }
export interface QuestionContent { type: 'choice' | 'fillBlank'; acceptedAnswers: string[] | null; stem: string; options: string[]; answerIndex: number; explanation: string; difficulty: number; sourceRef: SourceRef }
export interface EntryContent { title: string; text: string; illustration: string; sourceRef: SourceRef }
export type ReviewState = 'draft' | 'approved' | 'returned';
export interface Draft<T> { id: string; slot: number; revision: number; content: T; status: ReviewState; note: string; reviewedAt: string | null; versions: number; errors: string[] }
export type BatchStatus = 'queued' | 'generating' | 'review' | 'failed' | 'cancelled' | 'stale';
export interface BatchSummary { id: string; unitIndex: number; unitName: string; status: BatchStatus; progress: number; message: string; model: { provider: string; model: string }; createdAt: string }
export interface Batch extends BatchSummary { isPreview: boolean; generationStartedAt: string | null; generationCompletedAt: string | null; plan: QuestionPlan; targetCount: number; skippedQuestions: { slot: number; reason: string }[]; revision: number; error: string | null; sourceError: string | null; releaseErrors: string[]; canRelease: boolean; questions: Draft<QuestionContent>[]; entries: Draft<EntryContent>[] }
export const reviewNames: Record<ReviewState, string> = { draft: '待審核', approved: '已核准', returned: '已退回' };
export const batchBusy = (batch: BatchSummary | null) => batch?.status === 'queued' || batch?.status === 'generating';
export type EditorItem = { kind: 'questions'; draft: Draft<QuestionContent> } | { kind: 'entries'; draft: Draft<EntryContent> };
export type UnitWithIndex = Unit & { index: number };
