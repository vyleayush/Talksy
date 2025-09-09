#!/bin/bash

echo "========================================"
echo "   WorldChat Enhanced Installation"
echo "========================================"
echo

echo "[1/4] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Then run this script again."
    exit 1
fi

echo "[2/4] Installing dependencies..."
if ! npm install; then
    echo "ERROR: Failed to install dependencies!"
    exit 1
fi

echo "[3/4] Creating upload directories..."
mkdir -p public/uploads/images
mkdir -p public/uploads/videos
mkdir -p public/uploads/voice

echo "[4/4] Starting Enhanced WorldChat server..."
echo
echo "========================================"
echo "   WorldChat Enhanced is starting..."
echo "   🌍 Open your browser to: http://localhost:3000"
echo "   📸 Image sharing: Upload and share photos"
echo "   🎥 Video sharing: Share videos with built-in player"
echo "   🎤 Voice messages: Record and send voice notes"
echo "========================================"
echo
npm start
