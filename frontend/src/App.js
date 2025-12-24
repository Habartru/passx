import React, { useState, useEffect } from 'react';
import { Upload, FileText, Plane, Stamp, X, ChevronLeft, ChevronRight, Trash2, FileJson } from 'lucide-react';
import axios from 'axios';
import './App.css';

// API URL для локальной разработки
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

// Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

// Pagination Component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft size={20} />
      </button>
      <span className="pagination-info">
        Страница {currentPage} из {totalPages || 1}
      </span>
      <button
        className="pagination-btn"
        disabled={currentPage === totalPages || totalPages === 0}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

// Documentation Modal Component
const DocsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content docs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header docs-modal__header">
          <h2>Руководство пользователя PASSX</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="modal-body docs-modal__body">
          <section className="docs-section">
            <h3>1. О системе</h3>
            <p>
              <strong>PASSX</strong> — это автоматизированная система для обработки, распознавания и перевода паспортных
              документов с использованием искусственного интеллекта. Сервис извлекает данные из сканов (PDF), переводит их
              на русский язык и формирует документы, готовые для нотариального заверения.
            </p>
          </section>

          <section className="docs-section">
            <h3>2. Процесс обработки (Пайплайн)</h3>
            <p>Каждый документ проходит два этапа:</p>
            <ul className="docs-list">
              <li>
                <strong>Этап 1: Распознавание (OCR).</strong> Нейросеть анализирует изображения страниц, определяет структуру
                документа (включая визы, штампы и MRZ) и извлекает данные на языке оригинала.
              </li>
              <li>
                <strong>Этап 2: Автоматический перевод.</strong> Сразу после распознавания данные отправляются на
                лингвистическую обработку. Имена транслитерируются, названия стран переводятся на русский язык, даты приводятся
                к единому формату.
              </li>
            </ul>
            <p className="docs-note">
              Примечание: весь процесс занимает 15–30 секунд. Дождитесь заполнения шкалы прогресса.
            </p>
          </section>

          <section className="docs-section">
            <h3>3. Работа с данными</h3>
            <p>После завершения обработки открывается <strong>Редактор</strong> с распознанными данными паспорта.</p>
            <ul className="docs-list">
              <li><strong>Биографические данные</strong> — ФИО, дата рождения, номер паспорта, гражданство и т.д.</li>
              <li><strong>MRZ</strong> — машиночитаемая зона (две строки кода).</li>
              <li><strong>Визы</strong> — список всех распознанных виз с датами и странами.</li>
              <li><strong>Штампы</strong> — отметки о пересечении границ.</li>
            </ul>
            <p className="docs-note">
              Все поля можно редактировать вручную. Нажмите «Сохранить» для применения изменений.
            </p>
          </section>

          <section className="docs-section">
            <h3>4. Экспорт и отчёты</h3>
            <p>В панели инструментов доступны следующие действия:</p>
            <div className="docs-grid">
              <div className="docs-card">
                <strong>📄 Скачать DOCX</strong>
                <span>Формирует переведённый документ в стиле «постраничного описания», готовый для нотариуса.</span>
              </div>
              <div className="docs-card">
                <strong>💾 Скачать JSON</strong>
                <span>Экспортирует распознанные данные в структурированном формате для интеграций.</span>
              </div>
              <div className="docs-card">
                <strong>📝 Заполнить XML</strong>
                <span>Автоматически подставляет данные в шаблоны (например, Узбекистан, Индия).</span>
              </div>
            </div>
          </section>

          <section className="docs-section">
            <h3>5. История</h3>
            <p>
              Все загруженные паспорта сохраняются в разделе «История». Оттуда можно повторно открыть документ, скачать отчёт,
              JSON или удалить запись.
            </p>
          </section>

          <section className="docs-section">
            <h3>6. API для интеграции</h3>
            <p>
              Базовый URL: <code className="docs-code">{API_BASE_URL}</code>. Авторизация не требуется, но сервер должен быть запущен
              (порт 5000). Ниже — основные методы:
            </p>
            <div className="docs-api">
              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--get">GET</span>
                  <code className="docs-code">/health</code>
                </div>
                <p>Проверка доступности сервера. Возвращает <code className="docs-code">{`{"status":"ok"}`}</code>.</p>
              </div>

              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--post">POST</span>
                  <code className="docs-code">/api/process</code>
                </div>
                <p>Загрузка PDF. Тело: <code className="docs-code">multipart/form-data</code> c полем <code className="docs-code">file</code>. В ответе — JSON с распознанными данными и <code className="docs-code">record_id</code>.</p>
              </div>

              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--get">GET</span>
                  <code className="docs-code">/api/passports?page=1&limit=10</code>
                </div>
                <p>Список загруженных паспортов с пагинацией.</p>
              </div>

              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--get">GET</span>
                  <code className="docs-code">/api/passports/&lt;id&gt;</code>
                </div>
                <p>Полные данные паспорта, включая JSON снапшот.</p>
              </div>

              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--put">PUT</span>
                  <code className="docs-code">/api/passports/&lt;id&gt;</code>
                </div>
                <p>Обновление данных. Тело: <code className="docs-code">{`{ "data": { ... } }`}</code>. Сервер нормализует строки и сохраняет JSON.</p>
              </div>

              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--delete">DELETE</span>
                  <code className="docs-code">/api/passports/&lt;id&gt;</code>
                </div>
                <p>Удаляет запись, JSON-файлы и переведённые данные.</p>
              </div>

              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--get">GET</span>
                  <code className="docs-code">/api/templates</code>
                </div>
                <p>Список XML-шаблонов (id, название, страна, плейсхолдеры).</p>
              </div>

              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--post">POST</span>
                  <code className="docs-code">/api/templates/&lt;id&gt;/fill</code>
                </div>
                <p>Тело: <code className="docs-code">{`{ "record_id": <id> }`}</code>. В ответе — base64 содержимое XML-файла.</p>
              </div>

              <div className="docs-endpoint">
                <div className="docs-endpoint__line">
                  <span className="docs-badge docs-badge--get">GET</span>
                  <code className="docs-code">/api/passports/&lt;id&gt;/report</code>
                </div>
                <p>
                  Скачивает DOCX-файл с готовым переводом паспорта. Если перевода ещё нет, сервер автоматически запускает второй
                  этап и отдаёт файл после завершения. Ответ приходит с заголовком
                  <code className="docs-code">application/vnd.openxmlformats-officedocument.wordprocessingml.document</code>.
                </p>
              </div>
            </div>

            <div className="docs-codeblock">
{`curl -o passport_report.docx ${API_BASE_URL}/api/passports/1/report`}
            </div>
          </section>
        </div>
        <div className="modal-footer docs-modal__footer">
          <button className="primary-btn" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [file, setFile] = useState(null);
  const [fileQueue, setFileQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [detailLoading, setDetailLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  
  // History & Pagination
  const [passports, setPassports] = useState([]);
  const [loadingPassports, setLoadingPassports] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  const [selectedPassportId, setSelectedPassportId] = useState(null);
  const [editJson, setEditJson] = useState('');
  const [editError, setEditError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [fillingTemplate, setFillingTemplate] = useState(false);
  const [templateStatus, setTemplateStatus] = useState(null);
  const [editableData, setEditableData] = useState(null);
  
  // Batch operations
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [batchDownloading, setBatchDownloading] = useState(false);

  const deepClone = (payload) => JSON.parse(JSON.stringify(payload ?? null));

  const syncStateFromPayload = (payload) => {
    const source = payload || {};
    setEditableData(deepClone(source));
    setEditJson(JSON.stringify(source, null, 2));
    setData(preparePreviewData(source));
  };

  const clearEditingState = () => {
    setEditableData(null);
    setEditJson('');
    setData(null);
  };

  const handleFieldChange = (path, value) => {
    if (!path || path.length === 0) return;
    setEditableData((prev) => {
      if (!prev) return prev;
      const updated = deepClone(prev);
      let current = updated;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        if (current[key] === undefined || current[key] === null) {
          current[key] = typeof path[i + 1] === 'number' ? [] : {};
        }
        current = current[key];
      }
      current[path[path.length - 1]] = value;
      setEditJson(JSON.stringify(updated, null, 2));
      setData(preparePreviewData(updated));
      setSaveStatus(null);
      setTemplateStatus(null);
      return updated;
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      setError('Выберите PDF файлы');
      return;
    }
    
    if (pdfFiles.length === 1) {
      setFile(pdfFiles[0]);
      setFileQueue([]);
    } else {
      setFile(null);
      setFileQueue(pdfFiles);
    }
    setError(null);
  };

  const processFileQueue = async () => {
    if (fileQueue.length === 0) return;
    
    setProcessing(true);
    setQueueProgress({ current: 0, total: fileQueue.length });
    
    for (let i = 0; i < fileQueue.length; i++) {
      const currentFile = fileQueue[i];
      setQueueProgress({ current: i + 1, total: fileQueue.length });
      setStatusMessage(`Обработка ${i + 1}/${fileQueue.length}: ${currentFile.name}`);
      
      const formData = new FormData();
      formData.append('file', currentFile);
      
      try {
        await axios.post(`${API_BASE_URL}/api/process`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } catch (err) {
        console.error(`Failed to process ${currentFile.name}:`, err);
      }
    }
    
    setProcessing(false);
    setFileQueue([]);
    setQueueProgress({ current: 0, total: 0 });
    setStatusMessage('Все файлы обработаны!');
    fetchPassports(1);
  };

  const fetchPassports = async (page = 1) => {
    try {
      setLoadingPassports(true);
      const response = await axios.get(`${API_BASE_URL}/api/passports`, {
        params: { page, limit: 10 }
      });
      
      // Handle new paginated response
      if (response.data.items) {
        setPassports(response.data.items);
        setPagination({
          page: response.data.page,
          limit: response.data.limit,
          total: response.data.total,
          pages: response.data.pages
        });
      } else {
        // Fallback for old format if API hasn't updated yet
        setPassports(response.data || []);
      }
    } catch (err) {
      console.error('Failed to load passports list', err);
    } finally {
      setLoadingPassports(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      setTemplatesError(null);
      const response = await axios.get(`${API_BASE_URL}/api/templates`);
      setTemplates(response.data || []);
      if (response.data && response.data.length && !selectedTemplateId) {
        setSelectedTemplateId(response.data[0].id);
      }
    } catch (err) {
      setTemplatesError('Не удалось загрузить шаблоны');
      console.error('Failed to load templates list', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchPassports(1);
    fetchTemplates();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (selectedPassportId && !saving) {
          handleSaveEditedPassport();
        }
      }
      // Escape to go back
      if (e.key === 'Escape' && selectedPassportId) {
        setSelectedPassportId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPassportId, saving, editJson]);

  const preparePreviewData = (payload) => {
    if (!payload) return null;
    const preview = { ...payload };
    return preview;
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setProcessing(true);
    setError(null);
    setData(null);
    setUploadProgress(5);
    setStatusMessage('Загрузка файла...');

    const formData = new FormData();
    formData.append('file', file);

    // Start progress simulation immediately
    let currentProgress = 5;
    const progressInterval = setInterval(() => {
      if (currentProgress < 90) {
        currentProgress += Math.random() * 3 + 1;
        if (currentProgress > 90) currentProgress = 90;
        setUploadProgress(Math.round(currentProgress));
        
        if (currentProgress > 10 && currentProgress < 40) {
          setStatusMessage('Загрузка файла...');
        } else if (currentProgress >= 40 && currentProgress < 70) {
          setStatusMessage('Анализ документа нейросетью...');
        } else if (currentProgress >= 70) {
          setStatusMessage('Извлечение данных...');
        }
      }
    }, 300);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/process`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setStatusMessage('Готово!');
      
      syncStateFromPayload(response.data);
      setSelectedPassportId(response.data.record_id || null);
      setSaveStatus(null);
      fetchPassports(1);
      setDeleteStatus(null);
      setTemplateStatus(null);
    } catch (err) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setStatusMessage('');
      setError(err.response?.data?.error || 'Failed to process passport');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectPassport = async (recordId) => {
    setSelectedPassportId(recordId);
    setEditError(null);
    setSaveStatus(null);
    setDeleteStatus(null);
    setTemplateStatus(null);
    setDetailLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/passports/${recordId}`);
      const snapshot = response.data?.data || {};
      syncStateFromPayload(snapshot);
      setIsHistoryModalOpen(false); // Close modal on select
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load passport data');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePreviewEditedPassport = () => {
    try {
      const parsed = JSON.parse(editJson || '{}');
      syncStateFromPayload(parsed);
      setEditError(null);
      setSaveStatus('Предпросмотр обновлён (без сохранения)');
    } catch (parseError) {
      setEditError('JSON некорректен: ' + parseError.message);
    }
  };

  const handleSaveEditedPassport = async () => {
    if (!selectedPassportId) {
      setEditError('Сначала выберите паспорт');
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(editJson || '{}');
      setEditError(null);
    } catch (parseError) {
      setEditError('JSON некорректен: ' + parseError.message);
      return;
    }

    setSaving(true);
    setSaveStatus(null);
    try {
      await axios.put(`${API_BASE_URL}/api/passports/${selectedPassportId}`, {
        data: parsed,
      });
      setSaveStatus('Изменения сохранены');
      setDeleteStatus(null);
      syncStateFromPayload(parsed);
      setTemplateStatus(null);
      fetchPassports(pagination.page); // Refresh current page
    } catch (err) {
      setEditError(err.response?.data?.error || 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePassport = async () => {
    if (!selectedPassportId) {
      setEditError('Сначала выберите паспорт');
      return;
    }

    const confirmed = window.confirm('Удалить выбранный паспорт и все данные?');
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setEditError(null);
    setSaveStatus(null);
    setDeleteStatus(null);
    try {
      await axios.delete(`${API_BASE_URL}/api/passports/${selectedPassportId}`);
      setDeleteStatus('Паспорт удалён');
      setSelectedPassportId(null);
      clearEditingState();
      fetchPassports(pagination.page);
      setTemplateStatus(null);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Не удалось удалить паспорт');
    } finally {
      setDeleting(false);
    }
  };

  const downloadBase64File = (base64, filename, contentType = 'application/octet-stream') => {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    const sliceSize = 512;
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i += 1) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    const blob = new Blob(byteArrays, { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleFillTemplate = async () => {
    if (!selectedTemplateId) {
      setTemplateStatus(null);
      setTemplatesError('Выберите шаблон');
      return;
    }
    if (!selectedPassportId) {
      setTemplateStatus(null);
      setTemplatesError('Сначала выберите паспорт');
      return;
    }

    setFillingTemplate(true);
    setTemplatesError(null);
    setTemplateStatus(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/templates/${selectedTemplateId}/fill`, {
        record_id: selectedPassportId,
      });
      downloadBase64File(
        response.data.content_base64,
        response.data.filename || 'template.xml',
        response.data.content_type || 'application/xml'
      );
      setTemplateStatus('Шаблон заполнен и скачан');
    } catch (err) {
      setTemplatesError(err.response?.data?.error || 'Не удалось заполнить шаблон');
    } finally {
      setFillingTemplate(false);
    }
  };

  const handleDeleteFromList = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Удалить этот паспорт из истории?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/passports/${id}`);
      fetchPassports(pagination.page);
    } catch (err) {
      console.error('Failed to delete', err);
      alert('Ошибка удаления');
    }
  };

  // Batch operations
  const toggleSelectId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === passports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(passports.map((p) => p.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить ${selectedIds.size} выбранных паспортов?`)) return;

    for (const id of selectedIds) {
      try {
        await axios.delete(`${API_BASE_URL}/api/passports/${id}`);
      } catch (err) {
        console.error(`Failed to delete ${id}`, err);
      }
    }
    
    // If currently selected passport was deleted, reset view
    if (selectedPassportId && selectedIds.has(selectedPassportId)) {
      setSelectedPassportId(null);
      setData(null);
      setEditableData(null);
    }
    
    setSelectedIds(new Set());
    fetchPassports(pagination.page);
  };

  const handleBatchDownloadDocx = async () => {
    if (selectedIds.size === 0) return;
    setBatchDownloading(true);
    
    for (const id of selectedIds) {
      window.open(`${API_BASE_URL}/api/passports/${id}/report`, '_blank');
      // Small delay to avoid browser blocking multiple downloads
      await new Promise((r) => setTimeout(r, 500));
    }
    setBatchDownloading(false);
  };

  // Filter passports by search query
  const filteredPassports = passports.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.full_name && item.full_name.toLowerCase().includes(q)) ||
      (item.passport_number && item.passport_number.toLowerCase().includes(q)) ||
      (item.filename && item.filename.toLowerCase().includes(q))
    );
  });

  const handleDownloadJson = async (id, filename, e) => {
    e.stopPropagation();
    try {
      const response = await axios.get(`${API_BASE_URL}/api/passports/${id}`);
      const data = response.data.data;
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.replace('.pdf', '.json') || `passport_${id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
      alert('Не удалось скачать JSON');
    }
  };

  const handleDownloadDocx = (id, e) => {
    e.stopPropagation();
    window.open(`${API_BASE_URL}/api/passports/${id}/report`, '_blank');
  };

  const jsonPlaceholder = '{\n  "biographical_page": { ... }\n}';

  const EditableInput = ({ label, value, onChange, multiline = false, fullWidth = false }) => (
    <label className={`editable-field ${fullWidth ? 'editable-field--full' : ''}`}>
      <span className="editable-field-label">{label}</span>
      {multiline ? (
        <textarea
          className="editable-input editable-input--multiline"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="editable-input"
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );

  const EditableSelect = ({ label, value, onChange, options, fullWidth = false }) => (
    <label className={`editable-field ${fullWidth ? 'editable-field--full' : ''}`}>
      <span className="editable-field-label">{label}</span>
      <select
        className="editable-input editable-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const VisaField = ({ label, value }) => {
    if (!value) return null;
    return (
      <div className="visa-field">
        <span className="visa-field-label">{label}:</span>
        <span className="visa-field-value">{value}</span>
      </div>
    );
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="header-logo">
            <div className="logo-icon">
              <FileText size={24} />
            </div>
            <h1>PASSX</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              Всего записей: {pagination.total}
            </span>
            <button 
              className="secondary-btn btn-sm"
              onClick={() => setIsHistoryModalOpen(true)}
            >
              История
            </button>
          </div>
        </header>

        {/* History Modal */}
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title="История паспортов"
        >
          <div className="history-modal-content">
            {/* Search and batch actions */}
            <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Поиск по ФИО, номеру или файлу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
              {selectedIds.size > 0 && (
                <>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Выбрано: {selectedIds.size}
                  </span>
                  <button
                    className="secondary-btn btn-sm"
                    onClick={handleBatchDownloadDocx}
                    disabled={batchDownloading}
                  >
                    {batchDownloading ? 'Скачивание...' : 'Скачать DOCX'}
                  </button>
                  <button
                    className="danger-btn btn-sm"
                    onClick={handleBatchDelete}
                  >
                    Удалить выбранные
                  </button>
                </>
              )}
            </div>
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.size === passports.length && passports.length > 0}
                        onChange={toggleSelectAll}
                        title="Выбрать все"
                      />
                    </th>
                    <th>ФИО / Имя файла</th>
                    <th>Номер документа</th>
                    <th>Дата загрузки</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPassports ? (
                    <tr><td colSpan="5" className="text-center">Загрузка...</td></tr>
                  ) : filteredPassports.length === 0 ? (
                    <tr><td colSpan="5" className="text-center">{searchQuery ? 'Ничего не найдено' : 'Нет записей'}</td></tr>
                  ) : (
                    filteredPassports.map((item) => (
                      <tr key={item.id} className={selectedPassportId === item.id ? 'selected-row' : ''}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelectId(item.id)}
                          />
                        </td>
                        <td>
                          <div className="cell-primary">{item.full_name || '—'}</div>
                          <div className="cell-secondary">{item.filename}</div>
                        </td>
                        <td>{item.passport_number || '—'}</td>
                        <td>{new Date(item.created_at).toLocaleDateString('ru-RU')}</td>
                        <td className="actions-cell" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            className="icon-btn"
                            title="Скачать JSON"
                            onClick={(e) => handleDownloadJson(item.id, item.filename, e)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                          >
                            <FileJson size={18} style={{ color: '#3b82f6' }} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Скачать DOCX (Отчет)"
                            onClick={(e) => handleDownloadDocx(item.id, e)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                          >
                            <FileText size={18} style={{ color: '#10b981' }} />
                          </button>
                          <button
                            className="icon-btn danger"
                            title="Удалить"
                            onClick={(e) => handleDeleteFromList(item.id, e)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                          >
                            <Trash2 size={18} style={{ color: '#ef4444' }} />
                          </button>
                          <button
                            className="secondary-btn btn-sm"
                            onClick={() => handleSelectPassport(item.id)}
                          >
                            Открыть
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="history-footer">
              <button className="refresh-btn" onClick={() => fetchPassports(pagination.page)} disabled={loadingPassports}>
                Обновить
              </button>
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={(page) => fetchPassports(page)}
              />
            </div>
          </div>
        </Modal>

        <div className="main-layout">
          {/* Global Progress Overlay */}
          {processing && (
            <div className="processing-overlay">
              <div className="processing-modal">
                <div className="processing-spinner"></div>
                <div className="processing-text">{statusMessage || 'Обработка...'}</div>
                <div className="processing-progress">
                  <div className="processing-progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <div className="processing-percent">{uploadProgress}%</div>
              </div>
            </div>
          )}
          
          {error && <div className="error-message" style={{ marginBottom: '2rem' }}>{error}</div>}
          {!selectedPassportId ? (
            <div className="empty-state">
              <div className="empty-state-content">
                <div className="upload-section-large">
                  <input
                    type="file"
                    id="file-input"
                    accept=".pdf"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="file-input" className="file-drop-zone">
                    <div className="drop-zone-icon">
                      <Upload size={48} />
                    </div>
                    <h3>Загрузите PDF с паспортом</h3>
                    <p>Можно выбрать несколько файлов для массовой обработки</p>
                    {file && <div className="selected-file-badge">{file.name}</div>}
                    {fileQueue.length > 0 && (
                      <div className="selected-file-badge">
                        Выбрано файлов: {fileQueue.length}
                      </div>
                    )}
                  </label>
                  {queueProgress.total > 0 && (
                    <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      Обработано: {queueProgress.current} / {queueProgress.total}
                    </div>
                  )}
                  {fileQueue.length > 0 ? (
                    <button
                      onClick={processFileQueue}
                      disabled={processing}
                      className="upload-btn-large"
                    >
                      {processing ? `Обработка ${queueProgress.current}/${queueProgress.total}...` : `Обработать ${fileQueue.length} файлов`}
                    </button>
                  ) : (
                    <button
                      onClick={handleUpload}
                      disabled={!file || processing}
                      className="upload-btn-large"
                    >
                      {processing ? 'Обработка...' : 'Распознать паспорт'}
                    </button>
                  )}
                </div>
                <div className="empty-state-divider">или</div>
                <button className="secondary-btn" onClick={() => setIsHistoryModalOpen(true)}>
                  Выбрать из истории
                </button>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="empty-state">
              <div className="empty-state-content">
                <p>Загрузка данных паспорта...</p>
              </div>
            </div>
          ) : (
            <div className="editor-layout">
              <div className="toolbar">
                <div className="toolbar-left">
                  <button className="back-btn" onClick={() => setSelectedPassportId(null)}>
                    ← Назад
                  </button>
                  <span className="toolbar-title">
                    {editableData?.biographical_page?.full_name || 'Редактирование'}
                  </span>
                </div>
                <div className="toolbar-actions">
                  <button
                    className="danger-btn"
                    onClick={handleDeletePassport}
                    disabled={deleting}
                  >
                    Удалить
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={() => window.open(`${API_BASE_URL}/api/passports/${selectedPassportId}/report`, '_blank')}
                  >
                    Скачать DOCX
                  </button>
                  <button
                    className="primary-btn"
                    onClick={handleSaveEditedPassport}
                    disabled={saving}
                  >
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}
              
              <div className="content-grid">
                <div className="form-column">
                  {/* Template Panel moved here for context */}
                  <div className="section card template-card">
                    <div className="card-header-small">
                      <h3>Экспорт в XML</h3>
                    </div>
                    <div className="template-row">
                      <select
                        className="template-select"
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                      >
                        {templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name} ({tpl.country})
                          </option>
                        ))}
                      </select>
                      <button
                        className="primary-btn btn-sm"
                        onClick={handleFillTemplate}
                        disabled={!selectedTemplateId || fillingTemplate || templates.length === 0}
                      >
                        {fillingTemplate ? '...' : 'Скачать XML'}
                      </button>
                    </div>
                    {templateStatus && <div className="success-message small">{templateStatus}</div>}
                    {templatesError && <div className="error-message small">{templatesError}</div>}
                  </div>

                  {editableData && (
                    <div className="dashboard-forms">
                      {editableData.biographical_page && (
                        <div className="section card card--form">
                          <div className="card-header">
                            <div>
                              <p className="card-eyebrow">Биостраница</p>
                              <h2>Основные данные</h2>
                            </div>
                          </div>
                          <div className="card-body">
                            <div className="data-grid editable-grid">
                              <EditableInput
                                label="ФИО (Full Name)"
                                value={editableData.biographical_page.full_name || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'full_name'], val)}
                                fullWidth
                              />
                              <EditableInput
                                label="Дата рождения"
                                value={editableData.biographical_page.date_of_birth || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'date_of_birth'], val)}
                              />
                              <EditableInput
                                label="Пол"
                                value={editableData.biographical_page.gender || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'gender'], val)}
                              />
                              <EditableInput
                                label="Место рождения"
                                value={editableData.biographical_page.place_of_birth || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'place_of_birth'], val)}
                                fullWidth
                              />
                              <EditableInput
                                label="Гражданство"
                                value={editableData.biographical_page.nationality || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'nationality'], val)}
                              />
                              <EditableInput
                                label="Номер паспорта"
                                value={editableData.biographical_page.passport_number || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'passport_number'], val)}
                              />
                              <EditableInput
                                label="Дата выдачи"
                                value={editableData.biographical_page.issue_date || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'issue_date'], val)}
                              />
                              <EditableInput
                                label="Дата окончания"
                                value={editableData.biographical_page.expiry_date || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'expiry_date'], val)}
                              />
                              <EditableInput
                                label="Орган выдачи"
                                value={editableData.biographical_page.issuing_authority || ''}
                                onChange={(val) => handleFieldChange(['biographical_page', 'issuing_authority'], val)}
                                fullWidth
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {editableData.mrz && (
                        <div className="section card card--form">
                          <div className="card-header">
                            <div>
                              <p className="card-eyebrow">Машиночитаемая зона</p>
                              <h2>MRZ</h2>
                            </div>
                          </div>
                          <div className="card-body">
                            <div className="data-grid editable-grid">
                              <EditableInput
                                label="Строка 1"
                                value={editableData.mrz.mrz_line1 || ''}
                                multiline
                                onChange={(val) => handleFieldChange(['mrz', 'mrz_line1'], val)}
                                fullWidth
                              />
                              <EditableInput
                                label="Строка 2"
                                value={editableData.mrz.mrz_line2 || ''}
                                multiline
                                onChange={(val) => handleFieldChange(['mrz', 'mrz_line2'], val)}
                                fullWidth
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {editableData.visas && editableData.visas.length > 0 && (
                        <div className="section">
                          <div className="section-heading">
                            <h2>Визы</h2>
                            <p className="section-subtitle">Найденные визы и разрешения</p>
                          </div>
                          {editableData.visas.map((visa, index) => (
                            <div key={index} className="visa-card">
                              <div className="visa-card-header">
                                <div className="visa-card-title">
                                  <Plane size={16} />
                                  <span>Виза {index + 1}</span>
                                  {visa.page_number && (
                                    <span className="visa-page-tag">Стр. {visa.page_number}</span>
                                  )}
                                </div>
                              </div>
                              <div className="visa-card-body">
                                <EditableInput
                                  label="Страна"
                                  value={visa.country || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'country'], val)}
                                />
                                <div className="mrz-code mrz-code--visa">
                                  <EditableInput
                                    label="MRZ Line 1"
                                    value={visa.mrz_line1 || ''}
                                    onChange={(val) => handleFieldChange(['visas', index, 'mrz_line1'], val)}
                                  />
                                  <EditableInput
                                    label="MRZ Line 2"
                                    value={visa.mrz_line2 || ''}
                                    onChange={(val) => handleFieldChange(['visas', index, 'mrz_line2'], val)}
                                  />
                                </div>
                                <EditableInput
                                  label="Тип визы"
                                  value={visa.visa_type || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'visa_type'], val)}
                                />
                                <EditableInput
                                  label="Подтип"
                                  value={visa.visa_subtype || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'visa_subtype'], val)}
                                />
                                <EditableInput
                                  label="Номер визы"
                                  value={visa.visa_number || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'visa_number'], val)}
                                />
                                <EditableInput
                                  label="Место выдачи"
                                  value={visa.place_of_issue || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'place_of_issue'], val)}
                                />
                                <EditableInput
                                  label="Дата выдачи"
                                  value={visa.issue_date || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'issue_date'], val)}
                                />
                                <EditableInput
                                  label="Дата окончания"
                                  value={visa.expiry_date || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'expiry_date'], val)}
                                />
                                <EditableInput
                                  label="Кол-во въездов"
                                  value={visa.entries_allowed || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'entries_allowed'], val)}
                                />
                                <EditableInput
                                  label="Срок пребывания"
                                  value={visa.stay_duration || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'stay_duration'], val)}
                                />
                                <EditableInput
                                  label="Примечания"
                                  value={visa.remarks || ''}
                                  onChange={(val) => handleFieldChange(['visas', index, 'remarks'], val)}
                                  multiline
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {editableData.registration_stamps && editableData.registration_stamps.length > 0 && (
                        <div className="section">
                          <div className="section-heading">
                            <h2>Штампы РВП/ВНЖ/Регистрации</h2>
                            <p className="section-subtitle">Разрешения на проживание и регистрация</p>
                          </div>
                          {editableData.registration_stamps.map((regStamp, index) => (
                            <div key={index} className="visa-card registration-stamp-card">
                              <div className="visa-card-header">
                                <div className="visa-card-title">
                                  <Stamp size={16} />
                                  <span>
                                    {regStamp.stamp_type === 'RVP' ? 'РВП' : 
                                     regStamp.stamp_type === 'VNZ' ? 'ВНЖ' : 
                                     regStamp.stamp_type === 'REGISTRATION' ? 'Регистрация' :
                                     regStamp.stamp_type === 'RESIDENCE_PERMIT' ? 'Вид на жительство' :
                                     'Штамп'} {index + 1}
                                  </span>
                                  {regStamp.page_number && (
                                    <span className="visa-page-tag">Стр. {regStamp.page_number}</span>
                                  )}
                                </div>
                              </div>
                              <div className="visa-card-body">
                                <EditableSelect
                                  label="Тип штампа"
                                  value={regStamp.stamp_type || ''}
                                  onChange={(val) => handleFieldChange(['registration_stamps', index, 'stamp_type'], val)}
                                  options={[
                                    { value: 'RVP', label: 'РВП (Разрешение на временное проживание)' },
                                    { value: 'VNZ', label: 'ВНЖ (Вид на жительство)' },
                                    { value: 'REGISTRATION', label: 'Регистрация / Миграционный учёт' },
                                    { value: 'RESIDENCE_PERMIT', label: 'Вид на жительство (другое)' },
                                    { value: 'OTHER', label: 'Другое' }
                                  ]}
                                />
                                <EditableInput
                                  label="Страна"
                                  value={regStamp.country || ''}
                                  onChange={(val) => handleFieldChange(['registration_stamps', index, 'country'], val)}
                                />
                                <EditableInput
                                  label="Дата выдачи"
                                  value={regStamp.issue_date || ''}
                                  onChange={(val) => handleFieldChange(['registration_stamps', index, 'issue_date'], val)}
                                />
                                <EditableInput
                                  label="Дата окончания"
                                  value={regStamp.expiry_date || ''}
                                  onChange={(val) => handleFieldChange(['registration_stamps', index, 'expiry_date'], val)}
                                />
                                <EditableInput
                                  label="Орган выдачи"
                                  value={regStamp.authority || ''}
                                  onChange={(val) => handleFieldChange(['registration_stamps', index, 'authority'], val)}
                                  fullWidth
                                />
                                <EditableInput
                                  label="Адрес регистрации"
                                  value={regStamp.address || ''}
                                  onChange={(val) => handleFieldChange(['registration_stamps', index, 'address'], val)}
                                  fullWidth
                                />
                                <EditableInput
                                  label="Примечания"
                                  value={regStamp.remarks || ''}
                                  onChange={(val) => handleFieldChange(['registration_stamps', index, 'remarks'], val)}
                                  multiline
                                  fullWidth
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {editableData.stamps && editableData.stamps.length > 0 && (
                        <div className="section card card--form">
                          <div className="card-header">
                            <div>
                              <p className="card-eyebrow">Пограничные отметки</p>
                              <h2>Штампы въезда/выезда</h2>
                            </div>
                          </div>
                          <div className="card-body">
                            <div className="stamps-grid">
                              {editableData.stamps.map((stamp, index) => (
                                <div key={index} className="stamp-card">
                                  <div className="stamp-icon">
                                    <Stamp size={20} />
                                    {stamp.page_number && (
                                      <span className="stamp-page-tag">Стр. {stamp.page_number}</span>
                                    )}
                                  </div>
                                  <div className="stamp-fields">
                                    <EditableInput
                                      label="Страна"
                                      value={stamp.country || ''}
                                      onChange={(val) => handleFieldChange(['stamps', index, 'country'], val)}
                                      fullWidth
                                    />
                                    <EditableInput
                                      label="Дата"
                                      value={stamp.date || ''}
                                      onChange={(val) => handleFieldChange(['stamps', index, 'date'], val)}
                                      fullWidth
                                    />
                                    <EditableSelect
                                      label="Тип"
                                      value={stamp.type || ''}
                                      onChange={(val) => handleFieldChange(['stamps', index, 'type'], val)}
                                      options={[
                                        { value: 'entry', label: 'Въезд' },
                                        { value: 'exit', label: 'Выезд' },
                                        { value: 'transit', label: 'Транзит' }
                                      ]}
                                      fullWidth
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '0.9rem', marginTop: 'auto' }}>
          <button 
            onClick={() => setIsDocsOpen(true)}
            style={{ background: 'none', border: 'none', color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Документация и Руководство пользователя
          </button>
        </footer>
      </div>

      <DocsModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </div>
  );
}

export default App;

