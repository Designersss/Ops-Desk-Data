import {describe,it,expect} from 'vitest';
import {OperationsAnalyzer} from '../src/lib/analytics';
import {initialRecords} from '../src/lib/seed-data';
import {reportCsv} from '../src/lib/report';
import type {ProductionRecord} from '../src/lib/model';

function fixture():ProductionRecord[]{
 return initialRecords.map((data,i)=>({...data,id:i+1,version:1}));
}
describe('PBS cross-section and data quality',()=>{
 it('matches initial control results and keeps independent documentation',()=>{
  const analysis=new OperationsAnalyzer().analyze(fixture());
  expect(analysis.metrics.preparation).toMatchObject({plan:400,fact:290,percent:72.5,confirmedCount:4,totalCount:9});
  expect(analysis.metrics.welding).toMatchObject({need:750,confirmedNeed:320,covered:280,shortage:40,percent:87.5,linkedCount:4,unconfirmedCount:4});
  expect(analysis.metrics.documents).toMatchObject({plan:26,fact:18,percent:69.23,totalCount:6});
  expect(analysis.metrics.quality.problemRows).toBe(5);
 });
 it('checks 05–06 October, 190/200=95%, as in the spreadsheet formulas',()=>{
  const {metrics}=new OperationsAnalyzer().analyze(fixture(),{from:'2026-10-05',to:'2026-10-06'});
  expect(metrics.preparation).toMatchObject({plan:200,fact:190,percent:95});
 });
 it('updates welding only for a corrected, uniquely linked preparation batch',()=>{
  const rows=fixture();
  const p003=rows.find(row=>row.recordKey==='P-003');
  if(!p003)throw new Error('P-003 missing');
  p003.fact=120;
  const {metrics,rows:result}=new OperationsAnalyzer().analyze(rows);
  expect(metrics.preparation).toMatchObject({plan:500,fact:410,percent:82});
  expect(metrics.welding).toMatchObject({linkedCount:5,confirmedNeed:450,covered:400,shortage:50});
  expect(metrics.quality.problemRows).toBe(4);
  expect(result.find(row=>row.recordKey==='W-003')?.coverage).toMatchObject({confirmedFact:120,covered:120,shortage:10});
  expect(metrics.documents).toMatchObject({plan:26,fact:18,percent:69.23});
 });
 it('detects duplicate original rows; removing a duplicate makes remaining valid',()=>{
  const rows=fixture();
  const duplicate=rows.filter(row=>row.recordKey==='P-005');
  expect(duplicate).toHaveLength(2);
  const before=new OperationsAnalyzer().analyze(rows);
  expect(before.rows.filter(row=>row.recordKey==='P-005').every(row=>!row.confirmed)).toBe(true);
  const after=new OperationsAnalyzer().analyze(rows.filter(row=>row.id!==duplicate[1].id));
  expect(after.rows.find(row=>row.id===duplicate[0].id)?.confirmed).toBe(true);
  expect(after.metrics.preparation.fact).toBe(370);
  expect(after.metrics.welding.linkedCount).toBe(5);
 });
 it('does not misrepresent missing days as zero',()=>{
  const {metrics}=new OperationsAnalyzer().analyze(fixture());
  expect(metrics.days.find(day=>day.date==='2026-10-09')?.fact).toBeNull();
  expect(metrics.days.find(day=>day.date==='2026-10-07')?.plan).toBeNull();
 });
 it('creates UTF-8 BOM CSV with updated data and no Excel formula execution',()=>{
  const rows=fixture();
  const result=reportCsv(rows,{from:'2026-10-05',to:'2026-10-06'});
  expect(result.startsWith('\ufeff')).toBe(true);
  expect(result).toContain('95');
  expect(result).toContain('P-001');
  expect(result).not.toContain('P-003');
  rows[0].employee='=HYPERLINK("evil")';
  const safe=reportCsv(rows,{});
  expect(safe).toContain("'=HYPERLINK");
 });
});
