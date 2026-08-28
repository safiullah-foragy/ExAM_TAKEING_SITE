#!/bin/bash

# Store absolute project root
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting ExamSite..."
echo "📁 Project root: $ROOT_DIR"

# Kill any existing processes on ports 5000 and 5173
echo "🔄 Clearing ports..."
fuser -k 5000/tcp 2>/dev/null && echo "  Cleared port 5000"
fuser -k 5173/tcp 2>/dev/null && echo "  Cleared port 5173"
sleep 1

# Check if using local MongoDB or MongoDB Atlas
if [[ "$MONGO_URI" == *"mongodb+srv"* ]] || [[ "$MONGO_URI" == *"mongodb.net"* ]]; then
  echo "☁️ Connected to MongoDB Atlas Cloud Database"
else
  mkdir -p /tmp/mongodata
  if ! pgrep -x "mongod" > /dev/null; then
    echo "▶ Starting local MongoDB..."
    mongod --dbpath /tmp/mongodata --port 27017 --fork --logpath /tmp/mongod.log 2>/dev/null || true
    sleep 2
  else
    echo "✅ Local MongoDB already running"
  fi
fi

# Start Backend
echo "▶ Starting Backend on port 5000..."
cd "$ROOT_DIR/backend"
npm run dev &
BACKEND_PID=$!
sleep 4

# Start Frontend (keeps terminal alive)
echo "▶ Starting Frontend on port 5173..."
cd "$ROOT_DIR/frontend"
npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT
