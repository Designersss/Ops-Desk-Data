import type { RecordInput } from './model';

// Verified against the supplied worksheets (including the intentional duplicate and invalid facts).
export const initialRecords: RecordInput[] = [
 {section:'preparation',recordKey:'P-001',date:'2026-10-05',batchId:'LOT-01',employee:'Анна Соколова',plan:100,fact:90,need:null},
 {section:'preparation',recordKey:'P-002',date:'2026-10-06',batchId:'LOT-02',employee:'Анна Соколова',plan:100,fact:100,need:null},
 {section:'preparation',recordKey:'P-003',date:'2026-10-07',batchId:'LOT-03',employee:'Иван Морозов',plan:100,fact:1200,need:null},
 {section:'preparation',recordKey:'P-004',date:'2026-10-08',batchId:'LOT-04',employee:'Иван Морозов',plan:100,fact:-5,need:null},
 {section:'preparation',recordKey:'P-005',date:'2026-10-09',batchId:'LOT-05',employee:'Анна Соколова',plan:100,fact:80,need:null},
 {section:'preparation',recordKey:'P-005',date:'2026-10-09',batchId:'LOT-05',employee:'Анна Соколова',plan:100,fact:80,need:null},
 {section:'preparation',recordKey:'P-006',date:'2026-10-12',batchId:'LOT-06',employee:'Иван Морозов',plan:100,fact:0,need:null},
 {section:'preparation',recordKey:'P-007',date:'2026-10-13',batchId:'LOT-07',employee:'Анна Соколова',plan:100,fact:null,need:null},
 {section:'preparation',recordKey:'P-008',date:'2026-10-14',batchId:'LOT-08',employee:'Иван Морозов',plan:100,fact:100,need:null},
 {section:'welding',recordKey:'W-001',date:'2026-10-05',batchId:'LOT-01',employee:null,plan:null,fact:null,need:110},
 {section:'welding',recordKey:'W-002',date:'2026-10-06',batchId:'LOT-02',employee:null,plan:null,fact:null,need:90},
 {section:'welding',recordKey:'W-003',date:'2026-10-07',batchId:'LOT-03',employee:null,plan:null,fact:null,need:130},
 {section:'welding',recordKey:'W-004',date:'2026-10-08',batchId:'LOT-04',employee:null,plan:null,fact:null,need:100},
 {section:'welding',recordKey:'W-005',date:'2026-10-09',batchId:'LOT-05',employee:null,plan:null,fact:null,need:100},
 {section:'welding',recordKey:'W-006',date:'2026-10-12',batchId:'LOT-06',employee:null,plan:null,fact:null,need:20},
 {section:'welding',recordKey:'W-007',date:'2026-10-13',batchId:'LOT-07',employee:null,plan:null,fact:null,need:100},
 {section:'welding',recordKey:'W-008',date:'2026-10-14',batchId:'LOT-08',employee:null,plan:null,fact:null,need:100},
 {section:'documents',recordKey:'D-001',date:'2026-10-05',batchId:null,employee:'Мария Лебедева',plan:5,fact:4,need:null},
 {section:'documents',recordKey:'D-002',date:'2026-10-06',batchId:null,employee:'Олег Волков',plan:4,fact:4,need:null},
 {section:'documents',recordKey:'D-003',date:'2026-10-07',batchId:null,employee:'Мария Лебедева',plan:5,fact:3,need:null},
 {section:'documents',recordKey:'D-004',date:'2026-10-09',batchId:null,employee:'Олег Волков',plan:3,fact:2,need:null},
 {section:'documents',recordKey:'D-005',date:'2026-10-12',batchId:null,employee:'Мария Лебедева',plan:4,fact:0,need:null},
 {section:'documents',recordKey:'D-006',date:'2026-10-14',batchId:null,employee:'Олег Волков',plan:5,fact:5,need:null},
];
export const initialSources = [
 {section:'preparation' as const,fileName:'01_Заготовка.xlsx',count:9},
 {section:'welding' as const,fileName:'02_Потребность_сварки.xlsx',count:8},
 {section:'documents' as const,fileName:'03_Документация.xlsx',count:6}
];
