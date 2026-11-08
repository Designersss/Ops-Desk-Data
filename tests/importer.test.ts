import {describe,it,expect} from 'vitest';
import ExcelJS from 'exceljs';
import {parseWorkbook} from '../src/lib/importer';

describe('Excel initial import',()=>{
 it('reads Excel serial dates and preserves intentional invalid fact values',async()=>{
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet('Данные');
  sheet.addRow(['record_id','date','batch_id','employee','plan_qty','fact_qty']);
  sheet.addRow(['P-001',46300,'LOT-01','Анна Соколова',100,90]);
  sheet.addRow(['P-003',46302,'LOT-03','Иван Морозов',100,1200]);
  const buffer=Buffer.from(await workbook.xlsx.writeBuffer());
  const rows=await parseWorkbook('preparation',buffer);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({date:'2026-10-05',fact:90,batchId:'LOT-01'});
  expect(rows[1].fact).toBe(1200);
 });
 it('rejects a wrong template rather than partially importing',async()=>{
  const workbook=new ExcelJS.Workbook();
  workbook.addWorksheet('Данные').addRow(['wrong','header']);
  await expect(parseWorkbook('welding',Buffer.from(await workbook.xlsx.writeBuffer()))).rejects.toThrow('Несовпадение колонок');
 });
});
