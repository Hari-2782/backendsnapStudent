# 🚀 Quick Start Guide

## Fix Environment Variables Issue

The server is looking for a `.env` file but can't find it. Here's how to fix it:

### Option 1: Use the Setup Script (Recommended)

```bash
# Run the setup script to create .env file
npm run setup
```

This will:
- ✅ Create `.env` file from `env.example`
- ✅ Show you what needs to be configured
- ✅ Guide you through the setup process

### Option 2: Manual Setup

```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file with your actual values
nano .env
```

### Option 3: Quick Test with Docker

```bash
# Start with Docker Compose (includes MongoDB)
docker-compose up -d

# Check if it's working
curl http://localhost:5000/health
```

## Required Environment Variables

You need to fill in these values in your `.env` file:

```bash
# ========================================
# API Keys (Required)
# ========================================
OPENROUTER_API_KEY=sk-or-your-actual-openrouter-api-key
HF_API_KEY=hf-your-actual-hugging-face-api-key

# ========================================
# Cloudinary Configuration (Required)
# ========================================
CLOUDINARY_CLOUD_NAME=your-actual-cloud-name
CLOUDINARY_API_KEY=your-actual-api-key
CLOUDINARY_API_SECRET=your-actual-api-secret

# ========================================
# Database Configuration (Required)
# ========================================
MONGO_URI=mongodb://localhost:27017/ai-study-helper

# ========================================
# Security (Required)
# ========================================
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
```

## Get Your API Keys

1. **OpenRouter API Key**: [Get from OpenRouter](https://openrouter.ai/keys)
2. **Hugging Face API Key**: [Get from Hugging Face](https://huggingface.co/settings/tokens)
3. **Cloudinary Account**: [Sign up for Cloudinary](https://cloudinary.com/)

## Test Your Setup

After creating the `.env` file:

```bash
# Start the server
npm start

# Or for development with auto-restart
npm run dev

# Test the health endpoint
curl http://localhost:5000/health
```

You should see:
```json
{
  "status": "OK",
  "timestamp": "2024-12-20T10:00:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

## Quick Docker Setup

If you want to test everything quickly with Docker:

```bash
# Start all services (MongoDB, Redis, etc.)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## Next Steps

1. ✅ **Create `.env` file** with your API keys
2. ✅ **Test the server** starts without errors
3. ✅ **Test the health endpoint** returns OK
4. 🚀 **Start developing** or deploy to production

## Troubleshooting

### "Missing required environment variables" Error

This means your `.env` file is missing or has empty values. Run:

```bash
npm run setup
```

### "Cannot find module" Error

Install dependencies:

```bash
npm install
```

### Port Already in Use

```bash
# Check what's using port 5000
lsof -i :5000

# Kill the process if needed
kill -9 <PID>
```

### MongoDB Connection Issues

For local development, start MongoDB:

```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Ubuntu/Debian
sudo systemctl start mongod

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:6.0
```

Your AI Study Helper Backend should now be ready to run! 🎉
