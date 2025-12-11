# Миграция с OpenRouter на Vertex AI

Данное руководство описывает переход с OpenRouter API на Google Vertex AI для использования Gemini моделей.

## Преимущества Vertex AI

- **Прямой доступ** к Google Gemini без посредников
- **Корпоративная надёжность** и SLA от Google Cloud
- **Гибкое ценообразование** (pay-as-you-go)
- **Интеграция** с другими сервисами Google Cloud

## Требования

1. Аккаунт Google Cloud с активным биллингом
2. Проект в Google Cloud Console
3. Включённый Vertex AI API
4. Установленный Google Cloud SDK (gcloud)

## Шаг 1: Настройка Google Cloud

### 1.1 Создание проекта

```bash
# Создать новый проект (или использовать существующий)
gcloud projects create YOUR_PROJECT_ID

# Установить проект по умолчанию
gcloud config set project YOUR_PROJECT_ID
```

### 1.2 Включение Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com
```

### 1.3 Настройка аутентификации

```bash
# Создать сервисный аккаунт
gcloud iam service-accounts create passx-service \
    --display-name="PASSX Service Account"

# Назначить роль Vertex AI User
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:passx-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# Создать и скачать ключ
gcloud iam service-accounts keys create credentials.json \
    --iam-account=passx-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## Шаг 2: Установка зависимостей

```bash
# Удалить старые зависимости (если есть)
pip uninstall openai

# Установить Google Gen AI SDK
pip install google-genai
```

Обновите `backend/requirements.txt`:

```txt
flask>=2.0.0
flask-cors>=3.0.0
python-dotenv>=1.0.0
Pillow>=10.0.0
pdf2image>=1.16.0
PyPDF2>=3.0.0
python-docx>=0.8.11
SQLAlchemy>=2.0.0
google-genai>=0.7.0
```

## Шаг 3: Настройка переменных окружения

Обновите `backend/.env`:

```bash
# Vertex AI Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=True

# Путь к файлу credentials.json (опционально, если используете gcloud auth)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

**Важно:** Если вы авторизованы через `gcloud auth application-default login`, файл credentials.json не нужен.

## Шаг 4: Изменения в коде

### 4.1 Обновление импортов в `backend/app.py`

**Было (OpenRouter):**
```python
import requests

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-2.5-flash-preview-09-2025"

def call_openrouter_api(messages, images):
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
        json={"model": MODEL, "messages": messages}
    )
    return response.json()
```

**Стало (Vertex AI):**
```python
from google import genai
from google.genai.types import HttpOptions, Part, Content

# Клиент инициализируется автоматически из переменных окружения
client = genai.Client(http_options=HttpOptions(api_version="v1"))
MODEL = "gemini-2.5-flash"

def call_vertex_ai(prompt, images):
    contents = [prompt]
    
    # Добавление изображений
    for img_base64 in images:
        contents.append(Part.from_bytes(
            data=base64.b64decode(img_base64),
            mime_type="image/jpeg"
        ))
    
    response = client.models.generate_content(
        model=MODEL,
        contents=contents
    )
    return response.text
```

### 4.2 Полный пример функции обработки

```python
from google import genai
from google.genai.types import HttpOptions, Part
import base64

# Инициализация клиента
client = genai.Client(http_options=HttpOptions(api_version="v1"))

def process_passport_with_vertex(images_base64: list, prompt: str) -> dict:
    """
    Обработка паспорта через Vertex AI Gemini.
    
    Args:
        images_base64: Список изображений в base64
        prompt: Промпт для анализа
    
    Returns:
        dict: Распознанные данные паспорта
    """
    # Формируем контент
    contents = [prompt]
    
    for img_b64 in images_base64:
        # Убираем префикс data:image/...;base64, если есть
        if ',' in img_b64:
            img_b64 = img_b64.split(',')[1]
        
        contents.append(Part.from_bytes(
            data=base64.b64decode(img_b64),
            mime_type="image/jpeg"
        ))
    
    # Вызов API
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents
    )
    
    # Парсинг JSON из ответа
    response_text = response.text
    
    # Очистка от markdown если есть
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]
    
    return json.loads(response_text)
```

## Шаг 5: Проверка

```bash
# Авторизация (если не используете сервисный аккаунт)
gcloud auth application-default login

# Запуск backend
cd backend
python app.py
```

## Локации Vertex AI

| Локация | Код |
|---------|-----|
| США (Айова) | `us-central1` |
| США (Южная Каролина) | `us-east4` |
| Европа (Нидерланды) | `europe-west4` |
| Азия (Токио) | `asia-northeast1` |
| Глобальная | `global` |

**Рекомендация:** Используйте `global` для автоматического выбора ближайшего региона.

## Сравнение цен (примерно)

| Провайдер | Модель | Input (1M tokens) | Output (1M tokens) |
|-----------|--------|-------------------|-------------------|
| OpenRouter | gemini-2.5-flash | ~$0.15 | ~$0.60 |
| Vertex AI | gemini-2.5-flash | ~$0.075 | ~$0.30 |

*Цены могут меняться. Проверяйте актуальные на официальных сайтах.*

## Откат на OpenRouter

Если нужно вернуться на OpenRouter, просто:

1. Верните старый код в `app.py`
2. Установите `OPENROUTER_API_KEY` в `.env`
3. Перезапустите сервер

## Troubleshooting

### Ошибка "Permission denied"

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="user:your-email@gmail.com" \
    --role="roles/aiplatform.user"
```

### Ошибка "API not enabled"

```bash
gcloud services enable aiplatform.googleapis.com
```

### Ошибка "Could not automatically determine credentials"

```bash
gcloud auth application-default login
```

Или укажите путь к credentials.json:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```
