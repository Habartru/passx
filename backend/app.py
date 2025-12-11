#!/usr/bin/env python3
"""
Flask backend for passport processing web service
"""

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import base64
import requests
import json
import io
import os
from dotenv import load_dotenv
from pathlib import Path
from report_generator import generate_passport_report
import datetime
from werkzeug.utils import secure_filename
import PyPDF2
from pdf2image import convert_from_bytes
from PIL import Image
import re
from html import escape
import hashlib
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError

# Frontend build path
FRONTEND_BUILD_PATH = Path(__file__).resolve().parent.parent / 'frontend' / 'build'

app = Flask(__name__, 
            static_folder=str(FRONTEND_BUILD_PATH / 'static'),
            static_url_path='/static')
CORS(app)

# Load environment variables
load_dotenv()

# Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-2.5-flash-preview-09-2025"

DATABASE_URL = "sqlite:///passports.db"

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)
Base = declarative_base()


class PassportRecord(Base):
    __tablename__ = "passport_records"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    filename = Column(String(255))
    full_name = Column(String(255))
    passport_number = Column(String(64))
    file_hash = Column(String(64))
    data = Column(JSON)


Base.metadata.create_all(engine)

def ensure_schema_updates():
    """Add file_hash column if missing (simple migration)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE passport_records ADD COLUMN file_hash VARCHAR(64)"))
            print("Added column 'file_hash' to passport_records")
        except Exception:
            # Column likely exists or table not created yet
            pass

ensure_schema_updates()


PROJECT_ROOT = Path(__file__).resolve().parents[1]

STANDARD_PLACEHOLDERS = [
    'documentNumber',
    'surname',
    'givenNames',
    'patronymic',
    'birthDate',
    'sex',
    'placeOfBirth',
    'issueDate',
    'expiryDate',
    'authority',
    'mrzLine1',
    'mrzLine2'
]

TEMPLATE_BLUEPRINTS = [
    {
        'id': 'UZB',
        'name': 'Uzbekistan passport page',
        'country': 'UZ',
        'path': PROJECT_ROOT / 'UZB.xml'
    },
    {
        'id': 'IND',
        'name': 'India visa page',
        'country': 'IN',
        'path': PROJECT_ROOT / 'IND.xml'
    }
]

PLACEHOLDER_PATTERN = re.compile(r'{([A-Za-z0-9_]+)}')


def detect_template_placeholders(path: Path):
    if not path.exists():
        print(f"Template file not found: {path}")
        return []
    try:
        content = path.read_text(encoding='utf-8')
    except Exception as exc:
        print(f"Failed to read template {path}: {exc}")
        return []
    return sorted(set(PLACEHOLDER_PATTERN.findall(content)))


def build_template_registry():
    registry = {}
    for item in TEMPLATE_BLUEPRINTS:
        placeholders = detect_template_placeholders(item['path'])
        unknown = [p for p in placeholders if p not in STANDARD_PLACEHOLDERS]
        if unknown:
            print(f"Template {item['id']} contains unknown placeholders: {unknown}")
        registry[item['id']] = {
            'id': item['id'],
            'name': item['name'],
            'country': item['country'],
            'path': item['path'],
            'placeholders': placeholders
        }
    return registry


TEMPLATES = build_template_registry()

RECORDS_DIR = Path(__file__).parent / "records"
RECORDS_DIR.mkdir(parents=True, exist_ok=True)


def record_json_path(record_id: int) -> Path:
    return RECORDS_DIR / f"passport_{record_id}.json"


def translated_json_path(record_id: int) -> Path:
    return RECORDS_DIR / f"passport_{record_id}_translated.json"


def save_passport_json(record_id: int, passport_data: dict):
    """Persist full recognized data to JSON file for audit/editing."""
    try:
        snapshot = json.loads(json.dumps(passport_data, ensure_ascii=False))
        snapshot['record_id'] = record_id
        with record_json_path(record_id).open('w', encoding='utf-8') as handle:
            json.dump(snapshot, handle, ensure_ascii=False, indent=2)
        print(f"Passport JSON saved to {record_json_path(record_id)}")
    except Exception as exc:
        print(f"Failed to save passport JSON backup: {exc}")


def save_translated_json(record_id: int, passport_data: dict):
    """Persist translated data to JSON file."""
    try:
        snapshot = json.loads(json.dumps(passport_data, ensure_ascii=False))
        with translated_json_path(record_id).open('w', encoding='utf-8') as handle:
            json.dump(snapshot, handle, ensure_ascii=False, indent=2)
        print(f"Translated JSON saved to {translated_json_path(record_id)}")
    except Exception as exc:
        print(f"Failed to save translated JSON: {exc}")


def load_passport_json(record_id: int):
    path = record_json_path(record_id)
    if not path.exists():
        return None
    try:
        with path.open('r', encoding='utf-8') as handle:
            return json.load(handle)
    except Exception as exc:
        print(f"Failed to load passport JSON backup: {exc}")
        return None


def load_translated_json(record_id: int):
    path = translated_json_path(record_id)
    if not path.exists():
        return None
    try:
        with path.open('r', encoding='utf-8') as handle:
            return json.load(handle)
    except Exception as exc:
        print(f"Failed to load translated JSON: {exc}")
        return None


def delete_passport_json(record_id: int):
    path = record_json_path(record_id)
    if path.exists():
        try:
            path.unlink()
            print(f"Passport JSON removed: {path}")
        except Exception as exc:
            print(f"Failed to delete passport JSON: {exc}")
            
    path_trans = translated_json_path(record_id)
    if path_trans.exists():
        try:
            path_trans.unlink()
            print(f"Translated JSON removed: {path_trans}")
        except Exception:
            pass



def normalize_value(value):
    """Convert nested dicts/lists into flat string representations."""
    if isinstance(value, dict):
        parts = [str(v).strip() for v in value.values() if v not in (None, '')]
        return ' / '.join(part for part in parts if part)
    if isinstance(value, list):
        parts = [str(v).strip() for v in value if v not in (None, '')]
        return ', '.join(part for part in parts if part)
    return value


def normalize_dict_section(section):
    """Ensure no nested structures remain inside a dict section."""
    if not isinstance(section, dict):
        return section
    for key, value in list(section.items()):
        section[key] = normalize_value(value)
    return section


def normalize_list_of_dicts(items):
    """Normalize a list of dictionaries (e.g., visas, stamps)."""
    if not isinstance(items, list):
        return []
    normalized = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        normalized_entry = {}
        for key, value in entry.items():
            normalized_entry[key] = normalize_value(value)
        normalized.append(normalized_entry)
    return normalized


def validate_date_format(date_str):
    """Check if date string looks valid and try to normalize common issues."""
    if not date_str or not isinstance(date_str, str):
        return date_str
    
    # Fix common OCR errors in dates
    date_str = date_str.strip()
    
    # Check for obviously invalid patterns like "07.3.01" 
    parts = re.split(r'[./-]', date_str)
    if len(parts) == 3:
        # If middle part (month) is single digit without leading zero, it might be OCR error
        # but we keep it as-is since we can't be sure of the correct value
        pass
    
    return date_str


def validate_passport_data(passport_data: dict) -> list:
    """Validate passport data and return list of warnings."""
    warnings = []
    
    bio = passport_data.get('biographical_page', {})
    
    # Check gender field for extra characters
    gender = bio.get('gender', '')
    if gender and len(gender) > 1 and '/' in gender:
        # Gender like "K/M" should be just "M" or "F"
        clean_gender = gender.split('/')[-1].strip()
        if clean_gender in ('M', 'F', 'М', 'Ж'):
            warnings.append(f"Gender field contains extra characters: '{gender}' -> suggested: '{clean_gender}'")
    
    # Check visas for date logic
    for i, visa in enumerate(passport_data.get('visas', [])):
        issue = visa.get('issue_date', '')
        expiry = visa.get('expiry_date', '')
        if issue and expiry:
            # Simple check: if both dates exist and expiry looks earlier (basic string comparison for same format)
            # This is a heuristic, not a full date parser
            warnings.append(f"Visa {i+1}: verify dates - issue: {issue}, expiry: {expiry}")
    
    return warnings


def extract_placeholder_payload(passport_data: dict):
    bio = passport_data.get('biographical_page') or {}
    mrz = passport_data.get('mrz') or {}

    full_name = bio.get('full_name') or ''
    surname = bio.get('surname') or ''
    given_names = bio.get('given_names') or ''
    patronymic = bio.get('patronymic') or ''

    if not surname and full_name:
        parts = full_name.replace(' / ', ' ').split()
        if len(parts) >= 1:
            surname = parts[0]
        if len(parts) >= 2:
            given_names = ' '.join(parts[1:])

    payload = {
        'documentNumber': bio.get('passport_number'),
        'surname': surname,
        'givenNames': given_names,
        'patronymic': patronymic,
        'birthDate': bio.get('date_of_birth'),
        'sex': bio.get('gender'),
        'placeOfBirth': bio.get('place_of_birth'),
        'issueDate': bio.get('issue_date'),
        'expiryDate': bio.get('expiry_date'),
        'authority': bio.get('issuing_authority'),
        'mrzLine1': mrz.get('mrz_line1'),
        'mrzLine2': mrz.get('mrz_line2')
    }

    return payload


def translate_payload_for_template(payload: dict):
    if not payload:
        return payload

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Passport Template Translator"
    }

    json_text = json.dumps(payload, ensure_ascii=False)
    messages = [
        {
            "role": "system",
            "content": "You translate JSON values to Russian while keeping the same structure and keys."
        },
        {
            "role": "user",
            "content": (
                "Translate all values in the following JSON to Russian. "
                "Keep the same keys and return only JSON without comments or code fences:\n"
                f"{json_text}"
            )
        }
    ]

    payload_request = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 2000
    }

    try:
        response = requests.post(url, headers=headers, json=payload_request, timeout=60)
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        if '```json' in content:
            start = content.find('```json') + 7
            end = content.find('```', start)
            content = content[start:end].strip()
        elif '```' in content:
            start = content.find('```') + 3
            end = content.find('```', start)
            content = content[start:end].strip()
        translated = json.loads(content)
        return translated
    except Exception as exc:
        print(f"Translation failed, using original payload: {exc}")
        return payload


def render_template(template_id: str, data: dict):
    template = TEMPLATES.get(template_id)
    if not template:
        raise ValueError('Unknown template')

    payload = extract_placeholder_payload(data)
    payload = translate_payload_for_template(payload)

    try:
        content = template['path'].read_text(encoding='utf-8')
    except Exception as exc:
        raise RuntimeError(f'Failed to read template {template_id}: {exc}')

    def replacement(match):
        key = match.group(1)
        val = str(payload.get(key) or '')
        # Escape XML entities to ensure validity
        return escape(val)

    filled = PLACEHOLDER_PATTERN.sub(replacement, content)
    return filled


def save_passport_record(filename: str, passport_data: dict, file_hash: str = None) -> PassportRecord:
    session = SessionLocal()
    try:
        record = PassportRecord(
            filename=filename,
            full_name=passport_data.get('biographical_page', {}).get('full_name'),
            passport_number=passport_data.get('biographical_page', {}).get('passport_number'),
            file_hash=file_hash,
            data=passport_data
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return record
    except SQLAlchemyError as exc:
        session.rollback()
        print(f"Failed to save record: {exc}")
        raise
    finally:
        session.close()


def get_record_by_hash(file_hash: str) -> PassportRecord | None:
    session = SessionLocal()
    try:
        return session.query(PassportRecord).filter(PassportRecord.file_hash == file_hash).first()
    finally:
        session.close()


def list_passport_records(page: int = 1, limit: int = 50):
    session = SessionLocal()
    try:
        offset = (page - 1) * limit
        query = session.query(PassportRecord).order_by(PassportRecord.created_at.desc())
        
        total = query.count()
        records = query.offset(offset).limit(limit).all()
        
        return {
            'items': records,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }
    finally:
        session.close()


def get_passport_record(record_id: int) -> PassportRecord | None:
    session = SessionLocal()
    try:
        return session.get(PassportRecord, record_id)
    finally:
        session.close()


def delete_passport_record(record_id: int) -> bool:
    session = SessionLocal()
    try:
        record = session.get(PassportRecord, record_id)
        if not record:
            return False
        session.delete(record)
        session.commit()
        return True
    except SQLAlchemyError as exc:
        session.rollback()
        print(f"Failed to delete record: {exc}")
        raise
    finally:
        session.close()

PROMPT = """Analyze this passport document and extract ALL information in structured JSON format.
CRITICAL: Pay special attention to VISA stickers, RESIDENCE PERMITS, and STAMPS.

Extract the following data:
1. BIOGRAPHICAL PAGE:
   - full_name: string (combine all language variants into one string, e.g. "IVANOV IVAN / ИВАНОВ ИВАН")
   - date_of_birth: string (DD.MM.YYYY)
   - place_of_birth: string
   - gender: string (M/F)
   - nationality: string (COUNTRY NAME, not ethnicity! e.g. "ITALY" not "ITALIAN", "GERMANY" not "GERMAN", "TAJIKISTAN" not "TAJIK")
   - passport_number: string
   - issue_date: string (DD.MM.YYYY)
   - expiry_date: string (DD.MM.YYYY)
   - issuing_authority: string

2. MRZ (Machine Readable Zone):
   - mrz_line1: string (first line of MRZ)
   - mrz_line2: string (second line of MRZ)

3. VISAS (array):
   Extract all VISAS, RESIDENCE PERMITS, and WORK PERMITS.
   For each item found:
   - page_number: integer (page that contains the visa)
   - country: string (Issuing country. For Residence Permits, it's the host country)
   - visa_type: string (e.g. "VISA", "RESIDENCE PERMIT", "WORK PERMIT")
   - visa_subtype: string (Look for "CATEGORY", "TYPE", or codes like "D", "C", "Tier 4")
   - visa_number: string (Look for distinct red or black numbers, often top right)
   - place_of_issue: string (City or Authority code, e.g. "MOSCOW", "07")
   - issue_date: string (DD.MM.YYYY preferred)
   - expiry_date: string (DD.MM.YYYY preferred)
   - entries_allowed: string (Look for "ENTRIES", "01", "02", "MULT". IF RESIDENCE PERMIT AND NOT FOUND -> RETURN "MULTIPLE")
   - stay_duration: string (Look for "DAYS", "XX DAYS". IF RESIDENCE PERMIT AND NOT FOUND -> RETURN "UNTIL EXPIRY")
   - remarks: string (Extract ANY additional text notes, observations, or annotations)
   - mrz_line1: string (Look for machine readable lines at bottom of sticker if present)
   - mrz_line2: string (second MRZ line if present)
   - full_text: string (REQUIRED: Complete OCR text of the sticker area)

4. STAMPS (array):
   - page_number: integer (page that contains the stamp)
   - country: string
   - date: string (DD.MM.YYYY)
   - type: string (entry/exit)

IMPORTANT: 
- All fields must be strings or numbers (not nested objects or arrays)
- full_name should be a single string with all language variants separated by " / "
- Return ONLY valid JSON without markdown code blocks

Structure:
{
  "biographical_page": {...},
  "mrz": {...},
  "visas": [...],
  "stamps": [...]
}
"""

TRANSLATION_PROMPT = """You are a sworn translator preparing a FULL notarized Russian translation of every passport page.
Identify the original language of each value (passports may mix Azerbaijani, English, Arabic, Turkish, Georgian, Uzbek, etc.) and translate all content to Russian, preserving the full structure.

Rules:
1. Translate or transliterate EVERY value to Russian Cyrillic. If source already Cyrillic, keep as is.
2. Personal names and places from Latin script MUST be transliterated (JOHN SMITH -> ДЖОН СМИТ).
3. Preserve page annotations: if input contains markers like "[Page 4: Visa]" or "[Стр. 10]", keep them (translated) to reflect original order. Do not skip repeated sections.
4. MRZ lines remain untouched.
5. Dates -> DD.MM.YYYY (e.g., 2024/11/14 -> 14.11.2024).
6. Arrays such as visas/stamps must include every element from source JSON; nothing may be dropped.
7. Keep JSON keys unchanged and return ONLY valid JSON (no markdown fences or commentary).

Before returning, double-check that counts of visas and stamps match the input arrays and that no page descriptions were omitted.
"""

# Extracted photo helper functions removed



def extract_pages_from_pdf(pdf_bytes):
    """Extract all pages from passport PDF"""
    try:
        # Convert all pages to images
        images = convert_from_bytes(pdf_bytes, dpi=150)
        
        if not images:
            return []
        
        pages = []
        for i, page_image in enumerate(images):
            # Convert to JPEG for web display
            img_byte_arr = io.BytesIO()
            page_image.save(img_byte_arr, format='JPEG', quality=80)
            img_byte_arr.seek(0)
            
            # Store image data for display
            pages.append({
                'page_number': i + 1,
                'image': base64.b64encode(img_byte_arr.read()).decode('utf-8')
            })
        
        return pages
    except Exception as e:
        print(f"Error extracting pages: {e}")
        return []


def call_gemini_via_openrouter(pdf_base64, prompt):
    """Call Gemini model via OpenRouter API with PDF"""
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Passport Web Service"
    }
    
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "file",
                        "file": {
                            "filename": "passport.pdf",
                            "file_data": f"data:application/pdf;base64,{pdf_base64}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0,
        "max_tokens": 16000,
        "plugins": [
            {
                "id": "file-parser",
                "pdf": {
                    "engine": "native"
                }
            }
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)
    except requests.exceptions.Timeout:
        raise Exception("API request timed out after 120 seconds")
    except requests.exceptions.RequestException as e:
        raise Exception(f"API request failed: {e}")
    
    if response.status_code != 200:
        raise Exception(f"API request failed: {response.status_code} - {response.text}")
    
    return response.json()


def translate_passport_data(data: dict) -> dict:
    """Translate full passport data structure to Russian using LLM"""
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Passport Translator"
    }

    # Prepare lightweight payload (remove large fields if any)
    clean_data = json.loads(json.dumps(data))
    if 'pages' in clean_data:
        del clean_data['pages']
    
    messages = [
        {
            "role": "system",
            "content": TRANSLATION_PROMPT
        },
        {
            "role": "user",
            "content": json.dumps(clean_data, ensure_ascii=False)
        }
    ]

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 4000
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content']
        
        if '```json' in content:
            start = content.find('```json') + 7
            end = content.find('```', start)
            content = content[start:end].strip()
        elif '```' in content:
            start = content.find('```') + 3
            end = content.find('```', start)
            content = content[start:end].strip()
            
        return json.loads(content)
    except Exception as e:
        print(f"Translation failed: {e}")
        return data  # Fallback to original


@app.route('/api/process', methods=['POST'])
def process_passport():
    """Process uploaded passport PDF"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Only PDF files allowed'}), 400
        
        # Read PDF bytes
        pdf_bytes = file.read()
        
        # Limit file size to 50MB
        MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
        if len(pdf_bytes) > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large. Maximum size is 50MB'}), 400
        
        # Validate file content (magic bytes for PDF: %PDF)
        if not pdf_bytes.startswith(b'%PDF'):
             return jsonify({'error': 'Invalid PDF file content'}), 400
        
        # Encode PDF to base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        # Calculate file hash to prevent duplicates
        file_hash = hashlib.sha256(pdf_bytes).hexdigest()
        
        # Check if already exists
        existing_record = get_record_by_hash(file_hash)
        if existing_record:
            print(f"♻️ File already processed (hash: {file_hash[:8]}). Returning existing record.")
            passport_data = dict(existing_record.data) if existing_record.data else {}
            passport_data['record_id'] = existing_record.id
            
            # If filename is different, maybe update it? For now, keep original record.
            return jsonify(passport_data), 200
        
        # Extract all pages from PDF
        pages = extract_pages_from_pdf(pdf_bytes)
        
        # Call Gemini API
        result = call_gemini_via_openrouter(pdf_base64, PROMPT)
        
        # Extract response
        if 'choices' not in result or len(result['choices']) == 0:
            return jsonify({'error': 'No response from API'}), 500
        
        content = result['choices'][0]['message']['content']

        # Parse JSON from response
        try:
            # Remove markdown code blocks if present
            if '```json' in content:
                json_start = content.find('```json') + 7
                json_end = content.find('```', json_start)
                json_str = content[json_start:json_end].strip()
            elif '```' in content:
                json_start = content.find('```') + 3
                json_end = content.find('```', json_start)
                json_str = content[json_start:json_end].strip()
            else:
                json_str = content
            
            passport_data = json.loads(json_str)

            # Log the parsed data for debugging
            print("=" * 80)
            print("📦 PARSED DATA FROM GEMINI:")
            print(json.dumps(passport_data, ensure_ascii=False, indent=2))
            print("=" * 80)
            
            # Normalize data to keep strings flat while preserving detail
            if 'biographical_page' in passport_data:
                passport_data['biographical_page'] = normalize_dict_section(passport_data['biographical_page'])

            if 'mrz' in passport_data:
                passport_data['mrz'] = normalize_dict_section(passport_data['mrz'])

            if 'visas' in passport_data:
                passport_data['visas'] = normalize_list_of_dicts(passport_data['visas'])
            else:
                passport_data['visas'] = []

            if 'stamps' in passport_data:
                passport_data['stamps'] = normalize_list_of_dicts(passport_data['stamps'])
            else:
                passport_data['stamps'] = []
            
            # Pages images not included in JSON to save space

            # Persist record in database (store reduced data without page images)
            stored_passport_data = dict(passport_data)
            stored_passport_data['pages'] = [
                {
                    'page_number': page['page_number']
                }
                for page in pages
            ] if pages else []

            record = save_passport_record(file.filename, stored_passport_data, file_hash)
            save_passport_json(record.id, passport_data)
            passport_data['record_id'] = record.id

            # Validate extracted data
            validation_warnings = validate_passport_data(passport_data)
            if validation_warnings:
                print("⚠️ Validation warnings:")
                for warning in validation_warnings:
                    print(f"   - {warning}")
            
            print(f"✅ Passport data extracted successfully")
            print(f"📄 Total pages: {len(pages)}")
            
            # Start immediate translation
            print("🌍 Starting automatic translation...")
            translated_data = translate_passport_data(passport_data)
            save_translated_json(record.id, translated_data)
            print("✅ Translation completed and saved")
            
            return jsonify(passport_data), 200
            
        except json.JSONDecodeError as e:
            return jsonify({
                'error': 'Failed to parse response',
                'raw_response': content
            }), 500
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200


@app.route('/api/passports', methods=['GET'])
def list_passports():
    """Return list of processed passport records"""
    page = request.args.get('page', default=1, type=int)
    limit = request.args.get('limit', default=10, type=int)
    
    result = list_passport_records(page, limit)
    
    items_data = [
        {
            'id': record.id,
            'created_at': record.created_at.isoformat() + 'Z',
            'filename': record.filename,
            'full_name': record.full_name,
            'passport_number': record.passport_number
        }
        for record in result['items']
    ]
    
    response = {
        'items': items_data,
        'total': result['total'],
        'page': result['page'],
        'limit': result['limit'],
        'pages': result['pages']
    }
    return jsonify(response), 200


@app.route('/api/passports/<int:record_id>', methods=['GET', 'PUT', 'DELETE'])
def passport_detail(record_id: int):
    """Return or update stored passport record details"""
    if request.method == 'GET':
        record = get_passport_record(record_id)
        if not record:
            return jsonify({'error': 'Record not found'}), 404

        snapshot = load_passport_json(record_id) or record.data
        response = {
            'id': record.id,
            'created_at': record.created_at.isoformat() + 'Z',
            'filename': record.filename,
            'full_name': record.full_name,
            'passport_number': record.passport_number,
            'json_path': str(record_json_path(record_id)) if record_json_path(record_id).exists() else None,
            'data': snapshot
        }
        return jsonify(response), 200

    if request.method == 'DELETE':
        try:
            deleted = delete_passport_record(record_id)
        except SQLAlchemyError:
            return jsonify({'error': 'Failed to delete record'}), 500

        if not deleted:
            return jsonify({'error': 'Record not found'}), 404

        delete_passport_json(record_id)
        return jsonify({'status': 'deleted'}), 200

    # PUT branch
    payload = request.get_json(silent=True) or {}
    if 'data' not in payload:
        return jsonify({'error': 'Missing data payload'}), 400

    if not isinstance(payload['data'], dict):
        return jsonify({'error': 'Data must be an object'}), 400

    cleaned = json.loads(json.dumps(payload['data'], ensure_ascii=False))
    cleaned.pop('record_id', None)

    if 'biographical_page' in cleaned:
        cleaned['biographical_page'] = normalize_dict_section(cleaned['biographical_page'])
    if 'mrz' in cleaned:
        cleaned['mrz'] = normalize_dict_section(cleaned['mrz'])

    cleaned['visas'] = normalize_list_of_dicts(cleaned.get('visas', []))
    cleaned['stamps'] = normalize_list_of_dicts(cleaned.get('stamps', []))

    session = SessionLocal()
    try:
        record = session.get(PassportRecord, record_id)
        if not record:
            session.close()
            return jsonify({'error': 'Record not found'}), 404

        record.data = cleaned
        bio = cleaned.get('biographical_page') or {}
        record.full_name = bio.get('full_name')
        record.passport_number = bio.get('passport_number')

        session.commit()
    except SQLAlchemyError as exc:
        session.rollback()
        return jsonify({'error': f'Failed to update record: {exc}'}), 500
    finally:
        session.close()

    save_passport_json(record_id, cleaned)
    
    # Clear translation cache so next report generation will use fresh data
    trans_path = translated_json_path(record_id)
    if trans_path.exists():
        try:
            trans_path.unlink()
            print(f"Cleared translation cache for record {record_id}")
        except Exception as e:
            print(f"Failed to clear translation cache: {e}")
    
    return jsonify({'status': 'updated', 'data': cleaned}), 200


@app.route('/api/templates', methods=['GET'])
def list_templates_api():
    response = [
        {
            'id': tpl['id'],
            'name': tpl['name'],
            'country': tpl['country'],
            'placeholders': tpl['placeholders']
        }
        for tpl in TEMPLATES.values()
    ]
    return jsonify(response), 200


@app.route('/api/templates/<template_id>/fill', methods=['POST'])
def fill_template_api(template_id: str):
    template = TEMPLATES.get(template_id)
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    payload = request.get_json(silent=True) or {}

    record_data = None
    if 'record_id' in payload:
        snapshot = load_passport_json(payload['record_id'])
        if snapshot:
            record_data = snapshot
        else:
            record = get_passport_record(payload['record_id'])
            record_data = record.data if record else None
        if not record_data:
            return jsonify({'error': 'Record not found'}), 404
    elif 'data' in payload and isinstance(payload['data'], dict):
        record_data = payload['data']
    else:
        return jsonify({'error': 'Provide record_id or data'}), 400

    try:
        filled_xml = render_template(template_id, record_data)
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500

    encoded = base64.b64encode(filled_xml.encode('utf-8')).decode('utf-8')
    filename = f"{template_id.lower()}_filled.xml"

    return jsonify({
        'template_id': template_id,
        'filename': filename,
        'content_type': 'application/xml',
        'content_base64': encoded
    }), 200


@app.route('/api/passports/<int:record_id>/report', methods=['GET'])
def generate_report_api(record_id: int):
    record = get_passport_record(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404

    # First try to load already translated data (cached)
    translated_snapshot = load_translated_json(record_id)
    
    if not translated_snapshot:
        # Fall back to original and translate on-the-fly
        snapshot = load_passport_json(record_id) or record.data
        if not snapshot:
            return jsonify({'error': 'No data for record'}), 404
        
        try:
            translated_snapshot = translate_passport_data(snapshot)
            # Cache for next time
            save_translated_json(record_id, translated_snapshot)
        except Exception as e:
            print(f"Translation failed, using original: {e}")
            translated_snapshot = snapshot

    try:
        docx_file = generate_passport_report(translated_snapshot)
        filename = f"passport_dossier_{record_id}.docx"
        
        return send_file(
            docx_file,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Serve React frontend index.html
@app.route('/')
def serve_index():
    """Serve React index.html."""
    return send_from_directory(str(FRONTEND_BUILD_PATH), 'index.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
