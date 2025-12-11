#!/bin/bash

# PASSX - Stop Script
# Останавливает все сервисы

echo "🛑 Stopping PASSX services..."

fuser -k 5001/tcp 2>/dev/null && echo "   ✅ Backend stopped" || echo "   ⚪ Backend was not running"
fuser -k 3001/tcp 2>/dev/null && echo "   ✅ Frontend stopped" || echo "   ⚪ Frontend was not running"

echo ""
echo "✅ All PASSX services stopped"
