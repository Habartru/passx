# Документация API системы PASSX

**Базовый URL:** `http://localhost:5000`  
**Протокол:** HTTP/1.1  
**Формат данных:** JSON  

---

## 1. Обработка документов

### Загрузка и распознавание паспорта
Загружает PDF файл, распознает его с помощью AI, извлекает фото, данные и сохраняет в базу.

*   **URL:** `/api/process`
*   **Метод:** `POST`
*   **Content-Type:** `multipart/form-data`
*   **Параметры тела:**
    *   `file`: (Файл, обязательно) PDF файл паспорта.

**Пример успешного ответа (200 OK):**
```json
{
  "record_id": 1,
  "biographical_page": {
    "full_name": "IVANOV IVAN",
    "passport_number": "AA1234567",
    "date_of_birth": "01.01.1990"
  },
  "mrz": {
    "mrz_line1": "P<RUSIVANOV<<IVAN<<<<<<<<<<<<<",
    "mrz_line2": "AA12345678RUS9001015M2901015"
  },
  "visas": [
    {
      "country": "USA",
      "visa_type": "B1/B2",
      "issue_date": "10.10.2020"
    }
  ],
  "stamps": [
    {
      "country": "TURKEY",
      "date": "15.05.2023",
      "type": "entry"
    }
  ],
  "pages": [
    { "page_number": 1, "image": "data:image/jpeg;base64,..." }
  ]
}
```

---

## 2. Управление записями (Паспорта)

### Получить список всех паспортов
Возвращает краткий список сохраненных паспортов.

*   **URL:** `/api/passports`
*   **Метод:** `GET`
*   **Параметры запроса (Query):**
    *   `limit`: (Число, опционально) Лимит записей, по умолчанию 50.

**Пример ответа:**
```json
[
  {
    "id": 1,
    "created_at": "2025-11-30T12:00:00Z",
    "filename": "scan.pdf",
    "full_name": "IVANOV IVAN",
    "passport_number": "AA1234567"
  }
]
```

### Получить полные данные паспорта
Возвращает всю информацию о паспорте, включая фото и технические данные.

*   **URL:** `/api/passports/<record_id>`
*   **Метод:** `GET`
*   **Параметры пути:** `record_id` (ID записи)

### Обновить данные паспорта
Сохраняет отредактированные пользователем данные.

*   **URL:** `/api/passports/<record_id>`
*   **Метод:** `PUT`
*   **Content-Type:** `application/json`
*   **Тело запроса:**
```json
{
  "data": {
    "biographical_page": { "full_name": "IVANOV IVAN CHANGED" },
    "visas": [...],
    "stamps": [...]
  }
}
```

### Удалить паспорт
Удаляет запись из базы данных и связанный JSON файл.

*   **URL:** `/api/passports/<record_id>`
*   **Метод:** `DELETE`

---

## 3. Шаблоны и Генерация

### Получить список шаблонов
Возвращает список доступных XML шаблонов для генерации анкет (например, для Узбекистана).

*   **URL:** `/api/templates`
*   **Метод:** `GET`

**Пример ответа:**
```json
[
  {
    "id": "UZB",
    "name": "Uzbekistan passport page",
    "country": "UZ",
    "placeholders": ["surname", "givenNames", "passportNumber"]
  }
]
```

### Заполнить шаблон (Генерация XML)
Берет данные паспорта, переводит их на русский язык (через AI) и вставляет в XML шаблон.

*   **URL:** `/api/templates/<template_id>/fill`
*   **Метод:** `POST`
*   **Content-Type:** `application/json`
*   **Тело запроса (Вариант 1 - по ID):**
    ```json
    { "record_id": 1 }
    ```
*   **Тело запроса (Вариант 2 - прямые данные):**
    ```json
    { "data": { ...полные данные паспорта... } }
    ```

**Пример ответа:**
```json
{
  "template_id": "UZB",
  "filename": "uzb_filled.xml",
  "content_type": "application/xml",
  "content_base64": "PD94bW..."
}
```
