#!/bin/bash

echo "🚀 Setting up GitHub Actions for Vercel Auto-Deployment"
echo "=================================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
else
    echo "✅ Vercel CLI already installed"
fi

echo ""
echo "🔑 Getting Vercel credentials..."
echo "--------------------------------"

# Get Vercel token
echo "📋 Your Vercel Token:"
vercel whoami

echo ""
echo "🏢 Getting Organization ID..."
vercel teams ls 2>/dev/null || echo "Personal account (no teams)"

echo ""
echo "📁 Getting Project ID..."
vercel projects ls

echo ""
echo "📝 Next Steps:"
echo "=============="
echo "1. Copy the values above"
echo "2. Go to your GitHub repository"
echo "3. Settings → Secrets and variables → Actions"
echo "4. Add these secrets:"
echo "   - VERCEL_TOKEN: [your token]"
echo "   - ORG_ID: [your org ID]"
echo "   - PROJECT_ID: [your project ID]"
echo ""
echo "5. Push your changes to trigger first auto-deployment"
echo "6. Check GitHub Actions tab for deployment status"
echo ""
echo "🎉 After setup, every push to main will auto-deploy!"
