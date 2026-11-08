import { z } from 'zod';

export const SECTIONS = ['preparation', 'welding', 'documents'] as const;
export const sectionSchema = z.enum(SECTIONS);
export type Section = z.infer<typeof sectionSchema>;
export type Role = Section | 'director';
export type IssueCode = 'missing_fact' | 'negative_fact' | 'over_300_percent' | 'duplicate_key' | 'duplicate_batch' | 'invalid_plan' | 'invalid_need' | 'missing_employee' | 'negative_docs_fact';
export type Severity = 'warning' | 'error';

export interface ProductionRecord {
  id: number;
  section: Section;
  recordKey: string;
  date: string;
  batchId: string | null;
  employee: string | null;
  plan: number | null;
  fact: number | null;
  need: number | null;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}
export type RecordInput = Pick<ProductionRecord,'section'|'recordKey'|'date'|'batchId'|'employee'|'plan'|'fact'|'need'>;
export interface Issue {
  id: number;
  section: Section;
  recordKey: string;
  code: IssueCode;
  severity: Severity;
  message: string;
}
export interface RecordView extends ProductionRecord {
  issues: Issue[];
  confirmed: boolean;
  status: 'confirmed' | 'attention' | 'unconfirmed' | 'shortage' | 'covered';
  coverage: { confirmedFact: number | null; covered: number | null; shortage: number | null; percent: number | null } | null;
}
export interface Range { from?: string; to?: string }
export interface DashboardMetrics {
  preparation: { plan: number; fact: number; percent: number | null; confirmedCount: number; totalCount: number };
  welding: { need: number; confirmedNeed: number; covered: number; shortage: number; percent: number | null; linkedCount: number; totalCount: number; unconfirmedCount: number };
  documents: { plan: number; fact: number; percent: number | null; totalCount: number };
  quality: { problemRows: number; linkedUnconfirmed: number; issues: Issue[] };
  days: Array<{ date: string; plan: number | null; fact: number | null; percent: number | null }>;
}
export interface ImportStatus { section: Section; fileName: string; count: number; importedAt: string }
export interface AppState {
  role: Role;
  rows: RecordView[];
  metrics: DashboardMetrics | null;
  imports: ImportStatus[];
  range: Range;
}
const dateString = z.iso.date();
const base = z.object({
  recordKey: z.string().trim().min(1).max(100),
  date: dateString,
});
const nullableFact = z.number().int().safe().nullable();
const preparationSchema = base.extend({
  section: z.literal('preparation'),
  batchId: z.string().trim().min(1).max(100),
  employee: z.string().trim().min(1).max(200),
  plan: z.number().int().min(1).max(1_000_000_000),
  fact: nullableFact,
});
const weldingSchema = base.extend({
  section: z.literal('welding'),
  batchId: z.string().trim().min(1).max(100),
  employee: z.string().trim().max(200).nullable().optional(),
  need: z.number().int().min(0).max(1_000_000_000),
});
const documentsSchema = base.extend({
  section: z.literal('documents'),
  employee: z.string().trim().min(1).max(200),
  plan: z.number().int().min(1).max(1_000_000_000),
  fact: nullableFact,
});
export const createSchema = z.discriminatedUnion('section', [preparationSchema, weldingSchema, documentsSchema]);
export const updateSchema = z.object({
  version: z.number().int().positive(),
  record: createSchema,
});
export function normalizeInput(raw: z.infer<typeof createSchema>): RecordInput {
  if(raw.section === 'preparation') return {...raw, need:null};
  if(raw.section === 'welding') return {...raw, employee:raw.employee||null,plan:null,fact:null};
  return {...raw,batchId:null,need:null};
}
export function parseRange(params: URLSearchParams): Range {
  const from=params.get('from')||undefined;
  const to=params.get('to')||undefined;
  if(from && !dateString.safeParse(from).success) throw new Error('Некорректная дата начала');
  if(to && !dateString.safeParse(to).success) throw new Error('Некорректная дата окончания');
  if(from && to && from>to) throw new Error('Дата начала позже даты окончания');
  return {from,to};
}
