<div align="center">

# 🛂 PASSX

### Intelligent Passport Processing System

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-green.svg)](https://flask.palletsprojects.com)
[![AI](https://img.shields.io/badge/AI-Gemini%202.5-orange.svg)](https://openrouter.ai)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AI-powered passport document recognition and data extraction system**

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [API](#-api) • [Configuration](#%EF%B8%8F-configuration)

</div>

---

## 📋 Overview

PASSX is a web-based system for automated passport document processing using state-of-the-art AI vision models. It extracts biographical data, visa information, residence permits, work permits, and entry/exit stamps from scanned passport PDFs.

**Current AI Backend:** [OpenRouter](https://openrouter.ai) with Gemini 2.5 Flash model

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📄 **PDF Processing** | Upload passport scans in PDF format, automatic page detection |
| 🔍 **AI Recognition** | Extract biographical data, MRZ, photos using Gemini 2.5 Flash |
| 🛂 **Visa Detection** | Recognize visas, residence permits, work permits with all details |
| 🔖 **Stamp Analysis** | Detect entry/exit stamps with dates, countries, and page numbers |
| ✏️ **Manual Editing** | Review and correct extracted data through intuitive UI |
| 📊 **DOCX Reports** | Generate professional reports with Russian translation |
| 🗂️ **History & Storage** | SQLite database for all processed documents |
| 📦 **Batch Processing** | Process multiple passport files at once |

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  Flask Backend  │────▶│  OpenRouter AI  │
│  (Port 3001)    │     │  (Port 5001)    │     │  Gemini 2.5     │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │                 │
                        │  SQLite + JSON  │
                        │  Storage        │
                        │                 │
                        └─────────────────┘
```

## 📁 Project Structure

```
PASSX/
├── backend/
│   ├── app.py                 # Flask API server
│   ├── report_generator.py    # DOCX report generation
│   ├── requirements.txt       # Python dependencies
│   ├── .env.example          # Environment template
│   └── records/              # JSON data storage
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   └── App.css           # Styles
│   ├── public/
│   └── package.json
├── docs/
│   └── VERTEX_AI_MIGRATION.md # Guide for Vertex AI setup
├── install.sh                 # Automated installer
├── start.sh                   # Start all services
├── stop.sh                    # Stop all services
└── README.md
```

## 🚀 Installation

### Prerequisites

- **Python** 3.9+
- **Node.js** 18+ (will be installed automatically if missing)
- **poppler-utils** (for PDF processing)

### Quick Install (Recommended)

```bash
git clone https://github.com/Habartru/passx.git
cd passx
./install.sh
```

The installer will:
- Check and install system dependencies
- Install Node.js 18+ if needed
- Set up Python virtual environment
- Install all npm packages
- Configure environment files
- Optionally start the system

### Manual Installation

<details>
<summary>Click to expand manual steps</summary>

**1. Install system dependencies:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y poppler-utils python3-pip

# macOS
brew install poppler
```

**2. Backend setup:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
```

**3. Frontend setup:**

```bash
cd frontend
npm install
```

</details>

## ▶️ Usage

### Start the System

```bash
./start.sh
```

This starts:
- Backend API on `http://localhost:5001`
- Frontend UI on `http://localhost:3001`

### Stop the System

```bash
./stop.sh
```

### Access the Application

Open [http://localhost:3001](http://localhost:3001) in your browser.

**Workflow:**
1. Upload PDF passport scan (single or multiple files)
2. Wait for AI processing (progress indicator shown)
3. Review extracted data
4. Edit if necessary
5. Download DOCX report

## 📡 API

Full API documentation: [API_DOCUMENTATION_RU.md](API_DOCUMENTATION_RU.md)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/process` | Process PDF passport |
| `GET` | `/api/passports` | List all passports (paginated) |
| `GET` | `/api/passports/:id` | Get passport details |
| `PUT` | `/api/passports/:id` | Update passport data |
| `DELETE` | `/api/passports/:id` | Delete passport record |
| `GET` | `/api/passports/:id/report` | Download DOCX report |
| `GET` | `/api/templates` | List available templates |
| `GET` | `/health` | Health check |

### Example Request

```bash
curl -X POST http://localhost:5001/api/process \
  -F "file=@passport.pdf"
```

## ⚙️ Configuration

### Environment Variables

**Backend (`backend/.env`):**

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | API key from [openrouter.ai](https://openrouter.ai/keys) |
| `PORT` | No | Server port (default: 5001) |

### AI Provider Options

#### Current: OpenRouter (Default)

The system uses [OpenRouter](https://openrouter.ai) as the AI gateway to access Gemini 2.5 Flash model.

**Setup:**
1. Get API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Add to `backend/.env`: `OPENROUTER_API_KEY=your-key-here`

**Pricing:** ~$0.15/1M input tokens, ~$0.60/1M output tokens

#### Alternative: Google Vertex AI

For direct Google Cloud integration with potentially lower costs.

**Benefits:**
- Direct access to Google AI models
- Better SLA and enterprise support
- Pay-as-you-go pricing

**Migration guide:** [docs/VERTEX_AI_MIGRATION.md](docs/VERTEX_AI_MIGRATION.md)

## 🛠️ Tech Stack

**Backend:**
- Python 3.9+
- Flask 3.0
- SQLAlchemy (SQLite)
- pdf2image, Pillow
- python-docx

**Frontend:**
- React 18
- Axios
- Lucide React Icons
- CSS3 (custom, no frameworks)

**AI:**
- Gemini 2.5 Flash (via OpenRouter or Vertex AI)

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with ❤️ for document processing automation**

</div>
