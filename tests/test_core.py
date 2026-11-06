"""Regression checks for uploaded Excel, calculations, quality, exports and persistence."""
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
import unittest

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT))
import server


class OpsDeskTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)/'ops.db'
        self.db = server.db_connect(self.path)
        server.init_db(self.db)
        examples = sorted((PROJECT/'examples').glob('*.xlsx'))
        files = {section: path.read_bytes() for section, path in zip(server.TABLES, examples)}
        self.assertEqual(server.import_all(self.db,files), {'prep':9,'weld':8,'docs':6})
    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_control_example_95_percent(self):
        result=server.overview(self.db,'2026-10-05','2026-10-06')
        self.assertEqual(result['metrics']['prep']['plan'], 200)
        self.assertEqual(result['metrics']['prep']['fact'], 190)
        self.assertEqual(result['metrics']['prep']['rate'], .95)

    def test_invalid_input_is_excluded_and_links_blocked(self):
        result=server.overview(self.db)
        self.assertEqual(result['quality']['bad_records'],5)
        self.assertEqual(result['metrics']['prep']['fact'],290)
        self.assertEqual(result['metrics']['prep']['plan'],400)
        self.assertEqual(result['metrics']['weld']['need'],750)
        self.assertEqual(result['metrics']['weld']['verified_links'],4)
        self.assertEqual(result['metrics']['weld']['unverified_links'],4)
        self.assertEqual(result['metrics']['weld']['shortage'],40)
        self.assertAlmostEqual(result['metrics']['weld']['coverage'], .875)

    def test_edited_prep_updates_link_not_docs(self):
        before=server.overview(self.db)
        original=next(r for r in server.list_rows(self.db,'prep') if r['record_id']=='P-003')
        edited={c:original[c] for c in server.TABLES['prep']}
        edited['fact_qty']=120
        server.update_record(self.db,'prep',original['id'],edited)
        self.db.commit()
        after=server.overview(self.db)
        self.assertEqual(after['metrics']['prep']['fact'],410)
        self.assertEqual(after['metrics']['prep']['plan'],500)
        self.assertEqual(after['metrics']['weld']['verified_links'],5)
        self.assertEqual(after['metrics']['weld']['unverified_links'],3)
        self.assertEqual(after['metrics']['weld']['linked_need'],450)
        self.assertEqual(after['metrics']['weld']['linked_covered'],400)
        self.assertEqual(after['metrics']['weld']['shortage'],50)
        self.assertEqual(after['metrics']['docs'],before['metrics']['docs'])

    def test_duplicate_repair_with_delete(self):
        dupes=[r for r in server.list_rows(self.db,'prep') if r['record_id']=='P-005']
        self.assertEqual(len(dupes),2)
        server.delete_record(self.db,'prep',dupes[1]['id'])
        self.db.commit()
        after=server.overview(self.db)
        self.assertEqual(after['quality']['bad_records'],3)
        self.assertEqual(after['metrics']['weld']['verified_links'],5)

    def test_bootstrap_once_after_removing_originals(self):
        db_path = Path(self.tmp.name) / 'fresh.db'
        other = server.db_connect(db_path)
        server.init_db(other)
        self.assertTrue(server.bootstrap_demo(other))
        self.assertEqual(len(server.list_rows(other, 'prep')), 9)
        prep = next(r for r in server.list_rows(other, 'prep') if r['record_id'] == 'P-003')
        edited = {key: prep[key] for key in server.TABLES['prep']}
        edited['fact_qty'] = 120
        server.update_record(other, 'prep', prep['id'], edited)
        other.commit()
        self.assertFalse(server.bootstrap_demo(other))
        other.close()
        reopened = server.db_connect(db_path)
        server.init_db(reopened)
        self.assertFalse(server.bootstrap_demo(reopened))
        self.assertEqual(server.overview(reopened)['metrics']['prep']['fact'], 410)
        reopened.close()

    def test_restart_persistence_and_csv(self):
        row=server.list_rows(self.db,'docs')[0]
        edited={k:row[k] for k in server.TABLES['docs']}
        edited['fact_docs']=5
        server.update_record(self.db,'docs',row['id'],edited)
        self.db.commit()
        self.db.close()
        self.db=server.db_connect(self.path)
        self.assertEqual(server.overview(self.db)['metrics']['docs']['fact'],19)
        report=server.create_csv(server.overview(self.db))
        self.assertTrue(report.startswith('\ufeff'))
        self.assertIn('СВЯЗЬ ЗАГОТОВКА → СВАРКА',report)
        self.assertIn('LOT-03',report)
        self.assertIn('Непроверено:',report)


if __name__=='__main__':
    unittest.main()
