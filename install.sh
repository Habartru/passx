#!/bin/bash

# ============================================================
# PASSX Installation Script
# Автоматическая установка и настройка системы
# ============================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Директория проекта
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Функции вывода
print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ============================================================
# Проверка системных требований
# ============================================================

check_requirements() {
    print_header "Проверка системных требований"
    
    local errors=0
    
    # Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
        print_success "Python: $PYTHON_VERSION"
    else
        print_error "Python 3 не установлен"
        errors=$((errors + 1))
    fi
    
    # pip
    if command -v pip3 &> /dev/null || command -v pip &> /dev/null; then
        print_success "pip установлен"
    else
        print_error "pip не установлен"
        errors=$((errors + 1))
    fi
    
    # Node.js (минимум v14, рекомендуется v18+)
    local need_node_install=false
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d'.' -f1)
        
        if [ "$NODE_MAJOR" -lt 14 ]; then
            print_error "Node.js: $NODE_VERSION (УСТАРЕЛ! Требуется v14+)"
            need_node_install=true
        elif [ "$NODE_MAJOR" -lt 18 ]; then
            print_warning "Node.js: $NODE_VERSION (работает, но рекомендуется v18+)"
        else
            print_success "Node.js: $NODE_VERSION"
        fi
    else
        print_error "Node.js не установлен"
        need_node_install=true
    fi
    
    if [ "$need_node_install" = true ]; then
        echo ""
        read -p "Установить Node.js 18 автоматически? (y/n): " install_node
        if [[ "$install_node" =~ ^[Yy]$ ]]; then
            print_info "Установка Node.js 18..."
            
            # Ждём освобождения apt если занят
            while sudo fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
                print_warning "apt заблокирован другим процессом, ждём..."
                sleep 3
            done
            
            if command -v apt-get &> /dev/null; then
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                sudo apt-get install -y nodejs
            elif command -v brew &> /dev/null; then
                brew install node@20
            else
                print_error "Не удалось определить пакетный менеджер"
                print_info "Установите вручную: https://nodejs.org/"
                errors=$((errors + 1))
            fi
            
            # Проверяем что установка прошла успешно
            NEW_NODE_VERSION=$(node --version 2>/dev/null)
            NEW_NODE_MAJOR=$(echo "$NEW_NODE_VERSION" | sed 's/v//' | cut -d'.' -f1)
            if [ "$NEW_NODE_MAJOR" -ge 18 ] 2>/dev/null; then
                print_success "Node.js установлен: $NEW_NODE_VERSION"
            else
                print_error "Установка не удалась! Текущая версия: $NEW_NODE_VERSION"
                print_info "Установите вручную: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
                errors=$((errors + 1))
            fi
        else
            print_warning "Node.js не обновлён. Возможны проблемы с React."
            errors=$((errors + 1))
        fi
    fi
    
    # npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm: $NPM_VERSION"
    else
        print_error "npm не установлен"
        errors=$((errors + 1))
    fi
    
    # poppler-utils (для pdf2image)
    if command -v pdftoppm &> /dev/null; then
        print_success "poppler-utils установлен"
    else
        print_warning "poppler-utils не установлен (требуется для обработки PDF)"
        echo ""
        read -p "Установить poppler-utils? (y/n): " install_poppler
        if [[ "$install_poppler" =~ ^[Yy]$ ]]; then
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y poppler-utils
                print_success "poppler-utils установлен"
            elif command -v brew &> /dev/null; then
                brew install poppler
                print_success "poppler установлен"
            else
                print_error "Не удалось определить пакетный менеджер"
                print_info "Установите вручную: sudo apt-get install poppler-utils"
                errors=$((errors + 1))
            fi
        else
            errors=$((errors + 1))
        fi
    fi
    
    if [ $errors -gt 0 ]; then
        print_error "Обнаружены проблемы с зависимостями ($errors)"
        echo ""
        read -p "Продолжить установку? (y/n): " continue_install
        if [[ ! "$continue_install" =~ ^[Yy]$ ]]; then
            echo "Установка прервана"
            exit 1
        fi
    else
        print_success "Все системные требования выполнены"
    fi
}

# ============================================================
# Установка Backend
# ============================================================

install_backend() {
    print_header "Установка Backend (Python)"
    
    cd "$PROJECT_DIR/backend"
    
    # Создание виртуального окружения (опционально)
    read -p "Создать виртуальное окружение Python? (y/n): " create_venv
    if [[ "$create_venv" =~ ^[Yy]$ ]]; then
        if [ ! -d "venv" ]; then
            python3 -m venv venv
            print_success "Виртуальное окружение создано"
        else
            print_info "Виртуальное окружение уже существует"
        fi
        source venv/bin/activate
        print_success "Виртуальное окружение активировано"
    fi
    
    # Установка зависимостей
    print_info "Установка Python зависимостей..."
    pip install --upgrade pip
    pip install -r requirements.txt
    print_success "Python зависимости установлены"
    
    # Настройка .env
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Создан файл .env из примера"
            print_warning "ВАЖНО: Отредактируйте .env и добавьте ваш API ключ!"
        else
            print_error "Файл .env.example не найден"
        fi
    else
        print_info "Файл .env уже существует"
    fi
    
    cd "$PROJECT_DIR"
}

# ============================================================
# Установка Frontend
# ============================================================

install_frontend() {
    print_header "Установка Frontend (React)"
    
    cd "$PROJECT_DIR/frontend"
    
    # Установка зависимостей
    print_info "Установка npm зависимостей..."
    npm install
    print_success "npm зависимости установлены"
    
    # Настройка .env
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Создан файл .env"
        fi
    else
        print_info "Файл .env уже существует"
    fi
    
    cd "$PROJECT_DIR"
}

# ============================================================
# Настройка API ключа
# ============================================================

configure_api_key() {
    print_header "Настройка API ключа"
    
    ENV_FILE="$PROJECT_DIR/backend/.env"
    
    if [ -f "$ENV_FILE" ]; then
        # Проверяем, заполнен ли ключ
        if grep -q "your-api-key-here" "$ENV_FILE" || grep -q "OPENROUTER_API_KEY=$" "$ENV_FILE"; then
            echo ""
            print_warning "API ключ не настроен!"
            echo ""
            echo "Выберите провайдер AI:"
            echo "  1) OpenRouter (рекомендуется для начала)"
            echo "  2) Vertex AI (Google Cloud)"
            echo "  3) Настрою позже"
            echo ""
            read -p "Ваш выбор (1/2/3): " provider_choice
            
            case $provider_choice in
                1)
                    echo ""
                    print_info "Получите ключ на https://openrouter.ai/keys"
                    read -p "Введите OPENROUTER_API_KEY: " api_key
                    if [ -n "$api_key" ]; then
                        sed -i "s|OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=$api_key|" "$ENV_FILE"
                        print_success "API ключ сохранён"
                    fi
                    ;;
                2)
                    print_info "Смотрите docs/VERTEX_AI_MIGRATION.md для настройки Vertex AI"
                    ;;
                3)
                    print_warning "Не забудьте настроить API ключ в backend/.env"
                    ;;
            esac
        else
            print_success "API ключ уже настроен"
        fi
    fi
}

# ============================================================
# Создание необходимых директорий
# ============================================================

create_directories() {
    print_header "Создание директорий"
    
    mkdir -p "$PROJECT_DIR/backend/records"
    mkdir -p "$PROJECT_DIR/pdf"
    
    print_success "Директории созданы"
}

# ============================================================
# Проверка установки
# ============================================================

verify_installation() {
    print_header "Проверка установки"
    
    local errors=0
    
    # Backend
    if [ -f "$PROJECT_DIR/backend/app.py" ]; then
        print_success "Backend: app.py найден"
    else
        print_error "Backend: app.py не найден"
        errors=$((errors + 1))
    fi
    
    if [ -f "$PROJECT_DIR/backend/.env" ]; then
        print_success "Backend: .env настроен"
    else
        print_error "Backend: .env отсутствует"
        errors=$((errors + 1))
    fi
    
    # Frontend
    if [ -d "$PROJECT_DIR/frontend/node_modules" ]; then
        print_success "Frontend: node_modules установлены"
    else
        print_error "Frontend: node_modules не найдены"
        errors=$((errors + 1))
    fi
    
    # Проверка импортов Python
    print_info "Проверка Python зависимостей..."
    cd "$PROJECT_DIR/backend"
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    python3 -c "
import sys
try:
    import flask
    import flask_cors
    import PIL
    import pdf2image
    import PyPDF2
    import docx
    import sqlalchemy
    print('OK')
except ImportError as e:
    print(f'MISSING: {e}')
    sys.exit(1)
" 2>/dev/null && print_success "Python зависимости: OK" || { print_error "Некоторые Python зависимости отсутствуют"; errors=$((errors + 1)); }
    
    cd "$PROJECT_DIR"
    
    if [ $errors -eq 0 ]; then
        print_success "Установка завершена успешно!"
    else
        print_warning "Установка завершена с предупреждениями ($errors)"
    fi
    
    return $errors
}

# ============================================================
# Тестовый запуск
# ============================================================

test_run() {
    print_header "Запуск системы"
    
    echo "Выберите действие:"
    echo "  1) Запустить систему (backend + frontend)"
    echo "  2) Только проверить работоспособность"
    echo "  3) Пропустить"
    echo ""
    read -p "Ваш выбор (1/2/3): " run_choice
    
    case $run_choice in
        1)
            # Полноценный запуск через start.sh
            print_info "Запуск системы..."
            cd "$PROJECT_DIR"
            exec ./start.sh
            ;;
        2)
            # Тестовый запуск
            fuser -k 5001/tcp 2>/dev/null || true
            sleep 1
            
            cd "$PROJECT_DIR/backend"
            if [ -f "venv/bin/activate" ]; then
                source venv/bin/activate
            fi
            
            print_info "Тестовый запуск backend..."
            PORT=5001 python3 app.py > /tmp/passx_test.log 2>&1 &
            BACKEND_PID=$!
            
            local attempts=0
            while [ $attempts -lt 10 ]; do
                if curl -s http://localhost:5001/health > /dev/null 2>&1; then
                    break
                fi
                sleep 1
                attempts=$((attempts + 1))
            done
            
            if curl -s http://localhost:5001/health > /dev/null 2>&1; then
                print_success "Backend работает"
                kill $BACKEND_PID 2>/dev/null
                wait $BACKEND_PID 2>/dev/null || true
                print_success "Тест пройден"
            else
                print_error "Backend не отвечает. Лог: /tmp/passx_test.log"
                kill $BACKEND_PID 2>/dev/null || true
            fi
            cd "$PROJECT_DIR"
            ;;
        *)
            print_info "Пропущено"
            ;;
    esac
}

# ============================================================
# Финальные инструкции
# ============================================================

print_final_instructions() {
    print_header "Установка завершена!"
    
    echo "Для запуска системы используйте:"
    echo ""
    echo -e "  ${GREEN}./start.sh${NC}"
    echo ""
    echo "Для остановки:"
    echo ""
    echo -e "  ${GREEN}./stop.sh${NC}"
    echo ""
    echo "Документация:"
    echo "  - README.md - общая информация"
    echo "  - API_DOCUMENTATION_RU.md - API документация"
    echo "  - docs/VERTEX_AI_MIGRATION.md - миграция на Vertex AI"
    echo ""
    
    if [ -f "$PROJECT_DIR/backend/.env" ]; then
        if grep -q "your-api-key-here" "$PROJECT_DIR/backend/.env"; then
            print_warning "Не забудьте настроить API ключ в backend/.env!"
        fi
    fi
}

# ============================================================
# Главная функция
# ============================================================

main() {
    clear
    echo -e "${BLUE}"
    echo "  ██████╗  █████╗ ███████╗███████╗██╗  ██╗"
    echo "  ██╔══██╗██╔══██╗██╔════╝██╔════╝╚██╗██╔╝"
    echo "  ██████╔╝███████║███████╗███████╗ ╚███╔╝ "
    echo "  ██╔═══╝ ██╔══██║╚════██║╚════██║ ██╔██╗ "
    echo "  ██║     ██║  ██║███████║███████║██╔╝ ██╗"
    echo "  ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝"
    echo -e "${NC}"
    echo "  Passport Processing System - Установка"
    echo ""
    
    check_requirements
    install_backend
    install_frontend
    create_directories
    configure_api_key
    verify_installation
    test_run
    print_final_instructions
}

# Запуск
main "$@"
