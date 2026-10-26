export type Status = 'queued' | 'extracting' | 'classifying' | 'needsPages' | 'needsReview' | 'ready' | 'failed';
export interface Summary { id: string; title: string; status: Status; progress: number; message: string; createdAt: string; updatedAt: string }
export interface SourcePage { number: number; text: string; method: string; confidence: number; fileId: string; section: string | null }
export interface Unit { name: string; startPage: number; endPage: number; lowConfidence: boolean }
export interface Classification { school: string; grade: number | null; subject: string; publisher: string; confidence: number; provider: string; evidence: string[] }
export interface Confirmation { school: string; grade: number; subject: string; publisher: string; units: Unit[] }
export interface Document extends Summary { revision: number; coverPage: number; tocPage: number; error: string | null; pages: SourcePage[]; units: Unit[]; chunks: { id: string; heading: string; startPage: number; endPage: number; text: string; lowConfidence: boolean }[]; classification: Classification | null; confirmation: Confirmation | null; confirmedAt: string | null; history: { at: string; message: string }[]; replacements: Record<string, unknown> }
export interface Health { version: string; mode: string; ocrProvider: string; classificationProvider: string; ocrReady: boolean; maxUploadBytes: number; schools: string[]; subjects: string[] }
export const statusNames: Record<Status, string> = { queued: '等待處理', extracting: '擷取中', classifying: '歸類中', needsPages: '需要補頁', needsReview: '待家長確認', ready: '擷取與歸類完成', failed: '處理未完成' };
export const busy = (status: Status) => ['queued', 'extracting', 'classifying'].includes(status);
