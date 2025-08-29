#!/bin/bash

echo "🚀 Deploying to Vercel..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Deploy to Vercel
echo "📤 Deploying..."
vercel --prod

echo "✅ Deployment complete!"
echo "🔍 Check your Vercel dashboard for the new URL"
