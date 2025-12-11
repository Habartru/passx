#!/bin/bash

# PASSX - Startup Script (Local)
# Запускает backend и frontend локально

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=5001
FRONTEND_PORT=3001

echo "🚀 PASSX Startup Script"
echo "========================"

# Остановить старые процессы
echo "🛑 Stopping old processes..."
fuser -k $BACKEND_PORT/tcp 2>/dev/null || true
fuser -k $FRONTEND_PORT/tcp 2>/dev/null || true
sleep 1

# Запустить Backend
echo "🔧 Starting Backend (port $BACKEND_PORT)..."
cd "$PROJECT_DIR/backend"
export PORT=$BACKEND_PORT
nohup python3 app.py > "$PROJECT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Подождать пока backend запустится
sleep 3
if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend failed to start. Check backend.log"
    exit 1
fi

# Запустить Frontend
echo "⚛️  Starting Frontend (port $FRONTEND_PORT)..."
cd "$PROJECT_DIR/frontend"
PORT=$FRONTEND_PORT BROWSER=none nohup npm start > "$PROJECT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

# Подождать пока frontend скомпилируется
echo "   Waiting for frontend to compile..."
for i in {1..30}; do
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo "   ✅ Frontend is running"
        break
    fi
    sleep 2
done

cd "$PROJECT_DIR"

echo ""
echo "════════════════════════════════════════════════"
echo "🌍 PASSX is running!"
echo "════════════════════════════════════════════════"
echo ""
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "📁 Logs:"
echo "   Backend:  $PROJECT_DIR/backend.log"
echo "   Frontend: $PROJECT_DIR/frontend.log"
echo ""
echo "Press Ctrl+C to stop watching logs (services continue running)"
echo "To stop all services: ./stop.sh"
echo ""

# Показать логи
tail -f "$PROJECT_DIR/backend.log" 2>/dev/null || true
