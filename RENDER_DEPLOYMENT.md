# 🚀 Render Deployment Guide

## Overview

This guide will walk you through deploying the AI Study Helper Backend to Render.com, a modern cloud platform that offers a generous free tier.

## Prerequisites

- **GitHub Account**: Your code must be in a GitHub repository
- **Render Account**: Sign up at [render.com](https://render.com)
- **API Keys**: OpenRouter, Hugging Face, Cloudinary
- **MongoDB Atlas**: Cloud database (free tier available)

## Step 1: Prepare Your Repository

### 1.1 Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Add your GitHub repository as remote
git remote add origin https://github.com/yourusername/ai-study-helper-backend.git
git push -u origin main
```

### 1.2 Verify Required Files

Ensure these files are in your repository:

- ✅ `package.json` - Dependencies and scripts
- ✅ `src/server.js` - Main server file
- ✅ `render.yaml` - Render configuration
- ✅ `.gitignore` - Git ignore rules
- ✅ `env.example` - Environment template

## Step 2: Set Up MongoDB Atlas

### 2.1 Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Sign up for a free account
3. Create a new cluster (free tier)

### 2.2 Configure Database

1. **Create Database User**:
   - Go to Database Access
   - Add new database user
   - Choose "Password" authentication
   - Set username and password
   - Grant "Read and write to any database"

2. **Configure Network Access**:
   - Go to Network Access
   - Add IP Address: `0.0.0.0/0` (allow all)
   - Or add specific IPs for security

3. **Get Connection String**:
   - Go to Clusters
   - Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string

## Step 3: Get API Keys

### 3.1 OpenRouter API Key

1. Go to [OpenRouter](https://openrouter.ai/keys)
2. Sign up and create an account
3. Generate a new API key
4. Copy the key (starts with `sk-or-`)

### 3.2 Hugging Face API Key

1. Go to [Hugging Face](https://huggingface.co/settings/tokens)
2. Sign in to your account
3. Create a new token
4. Copy the token (starts with `hf_`)

### 3.3 Cloudinary Credentials

1. Go to [Cloudinary](https://cloudinary.com/)
2. Sign up for a free account
3. Go to Dashboard
4. Copy:
   - Cloud Name
   - API Key
   - API Secret

## Step 4: Deploy to Render

### 4.1 Connect Repository

1. **Sign in to Render**:
   - Go to [render.com](https://render.com)
   - Sign in with GitHub

2. **Create New Web Service**:
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository
   - Choose the repository

### 4.2 Configure Service

1. **Basic Settings**:
   ```
   Name: ai-study-helper-backend
   Environment: Node
   Region: Choose closest to you
   Branch: main
   Root Directory: (leave empty)
   ```

2. **Build & Deploy Settings**:
   ```
   Build Command: npm install
   Start Command: npm start
   ```

### 4.3 Set Environment Variables

In the Render dashboard, add these environment variables:

#### Required Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `10000` | Server port (Render requirement) |
| `MONGO_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | `your-super-secret-key` | Strong random string for JWT |
| `OPENROUTER_API_KEY` | `sk-or-...` | Your OpenRouter API key |
| `HF_API_KEY` | `hf_...` | Your Hugging Face API key |
| `CLOUDINARY_CLOUD_NAME` | `your-cloud-name` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | `your-api-key` | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | `your-api-secret` | Your Cloudinary API secret |

#### Optional Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `FRONTEND_URL` | `https://your-frontend.onrender.com` | Frontend URL for CORS |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limiting window (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

### 4.4 Deploy

1. **Click "Create Web Service"**
2. **Monitor the deployment**:
   - Watch the build logs
   - Check for any errors
   - Wait for "Live" status

## Step 5: Verify Deployment

### 5.1 Health Check

```bash
# Test the health endpoint
curl https://your-app-name.onrender.com/health

# Expected response
{
  "status": "OK",
  "timestamp": "2024-12-20T10:00:00.000Z",
  "environment": "production",
  "version": "1.0.0"
}
```

### 5.2 Test API Endpoints

```bash
# Test authentication
curl -X POST https://your-app-name.onrender.com/api/auth/dev-login

# Test image upload (if you have a test image)
curl -X POST https://your-app-name.onrender.com/api/upload \
  -F "image=@test-image.jpg"
```

## Step 6: Configure Custom Domain (Optional)

### 6.1 Add Custom Domain

1. Go to your service in Render dashboard
2. Click "Settings"
3. Scroll to "Custom Domains"
4. Add your domain
5. Configure DNS records as instructed

### 6.2 SSL Certificate

- Render automatically provides SSL certificates
- No additional configuration needed

## Troubleshooting

### Common Issues

#### 1. Build Failures

**Problem**: Build fails during deployment

**Solutions**:
```bash
# Check package.json has correct scripts
{
  "scripts": {
    "start": "node src/server.js"
  }
}

# Verify all dependencies are in package.json
npm install --save express mongoose dotenv
```

#### 2. Environment Variables

**Problem**: "Missing required environment variables"

**Solutions**:
- Double-check all required variables are set in Render
- Verify variable names match exactly (case-sensitive)
- Check for extra spaces in values

#### 3. MongoDB Connection

**Problem**: Cannot connect to MongoDB

**Solutions**:
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Check connection string format
- Ensure database user has correct permissions

#### 4. Port Issues

**Problem**: Service won't start

**Solutions**:
- Ensure `PORT` is set to `10000` in Render
- Check that server listens on `process.env.PORT`

### Debugging

#### View Logs

1. Go to your service in Render dashboard
2. Click "Logs" tab
3. Check for error messages
4. Look for startup issues

#### Test Locally

```bash
# Test with production environment
NODE_ENV=production npm start

# Test with Render environment variables
PORT=10000 npm start
```

## Monitoring & Maintenance

### Health Monitoring

- Render automatically monitors your service
- Health checks run every 30 seconds
- Service restarts automatically if health check fails

### Performance

- Free tier includes 750 hours/month
- Service sleeps after 15 minutes of inactivity
- First request after sleep may be slow (cold start)

### Scaling

- Free tier: 1 instance
- Paid plans: Auto-scaling available
- Upgrade when you need more resources

## Security Best Practices

### 1. Environment Variables

- Never commit `.env` files to git
- Use strong, unique JWT secrets
- Rotate API keys regularly

### 2. Database Security

- Use MongoDB Atlas with authentication
- Restrict IP access when possible
- Regular database backups

### 3. API Security

- Implement rate limiting
- Validate all inputs
- Use HTTPS (automatic with Render)

## Cost Optimization

### Free Tier Limits

- **750 hours/month** (enough for 24/7 uptime)
- **512 MB RAM**
- **Shared CPU**
- **Sleep after 15 minutes inactivity**

### When to Upgrade

- **High traffic**: More than 100 requests/minute
- **Memory issues**: Out of memory errors
- **Performance**: Slow response times
- **Uptime**: Need 24/7 without sleep

## Next Steps

1. **Test thoroughly** with your frontend
2. **Monitor performance** and logs
3. **Set up alerts** for downtime
4. **Configure backups** for MongoDB
5. **Plan for scaling** as you grow

## Support

- **Render Documentation**: [docs.render.com](https://docs.render.com)
- **MongoDB Atlas**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **GitHub Issues**: Create issues in your repository

---

**Your AI Study Helper Backend is now live on Render! 🎉**
