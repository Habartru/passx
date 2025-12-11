import unittest
import sys
import os
import json
from pathlib import Path

# Add backend directory to path to import app
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import normalize_value, normalize_dict_section, extract_placeholder_payload, app, engine, Base, SessionLocal, PassportRecord

class TestPassportHelpers(unittest.TestCase):
    def test_normalize_value_string(self):
        self.assertEqual(normalize_value("test"), "test")

    def test_normalize_value_dict(self):
        data = {"en": "Name", "ru": "Имя"}
        self.assertEqual(normalize_value(data), "Name / Имя")

    def test_normalize_value_list(self):
        data = ["Item 1", "Item 2"]
        self.assertEqual(normalize_value(data), "Item 1, Item 2")

    def test_normalize_dict_section(self):
        section = {
            "field1": "value1",
            "field2": {"a": "1", "b": "2"}
        }
        normalized = normalize_dict_section(section)
        self.assertEqual(normalized["field1"], "value1")
        self.assertEqual(normalized["field2"], "1 / 2")

    def test_extract_placeholder_payload(self):
        data = {
            "biographical_page": {
                "passport_number": "12345",
                "full_name": "DOE JOHN",
                "date_of_birth": "01.01.1990"
            },
            "mrz": {
                "mrz_line1": "L1",
                "mrz_line2": "L2"
            }
        }
        payload = extract_placeholder_payload(data)
        self.assertEqual(payload["documentNumber"], "12345")
        self.assertEqual(payload["surname"], "DOE")
        self.assertEqual(payload["givenNames"], "JOHN")
        self.assertEqual(payload["mrzLine1"], "L1")

class TestDatabase(unittest.TestCase):
    def setUp(self):
        # Use in-memory database for testing
        app.config['TESTING'] = True
        self.app = app.test_client()
        
        # Re-create tables in the actual engine (or mock it, but here we rely on the imported engine)
        # Ideally we'd swap the engine but for simplicity we just add a record and rollback or clean up
        Base.metadata.create_all(engine)
        self.session = SessionLocal()

    def tearDown(self):
        # In a real app we might drop tables or use a separate test db file
        # Here we just delete what we created
        self.session.query(PassportRecord).filter(PassportRecord.filename == "test_passport.pdf").delete()
        self.session.commit()
        self.session.close()

    def test_create_record(self):
        record = PassportRecord(
            filename="test_passport.pdf",
            full_name="TEST USER",
            passport_number="A000000",
            data={"test": "data"}
        )
        self.session.add(record)
        self.session.commit()

        saved = self.session.query(PassportRecord).filter_by(passport_number="A000000").first()
        self.assertIsNotNone(saved)
        self.assertEqual(saved.full_name, "TEST USER")

if __name__ == '__main__':
    unittest.main()
