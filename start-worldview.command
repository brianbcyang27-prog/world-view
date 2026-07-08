#!/bin/bash

# WorldView One-Click Startup Script
# Run this script to start both servers and open the application

echo "🌍 Starting WorldView..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/worldview-app"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Kill any existing processes on ports 3001 and 5174
echo "🔍 Checking for existing processes on ports 3001 and 5174..."
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true

# Start the proxy server in background
echo "🚀 Starting proxy server on port 3001..."
npm run server > /tmp/worldview-proxy.log 2>&1 &
PROXY_PID=$!
echo "Proxy server started (PID: $PROXY_PID)"

# Wait for proxy to start
sleep 3

# Start the dev server in background
echo "🚀 Starting dev server on port 5173..."
npm run dev > /tmp/worldview-dev.log 2>&1 &
DEV_PID=$!
echo "Dev server started (PID: $DEV_PID)"

# Wait for dev server to start
sleep 4

# Open browser
echo "🌐 Opening WorldView in browser..."
open http://localhost:5173

echo ""
echo "✅ WorldView is now running!"
echo "   - Proxy API: http://localhost:3001"
echo "   - Dev Server: http://localhost:5173"
echo ""
echo "To stop the servers, run: kill $PROXY_PID $DEV_PID"
echo "Or run: lsof -ti :3001,:5173 | xargs kill"

# Save PIDs to file for cleanup
echo "$PROXY_PID $DEV_PID" > /tmp/worldview.pids