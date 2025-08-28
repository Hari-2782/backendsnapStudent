# AI Study Helper Backend - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the AI Study Helper Backend with continuous integration and deployment (CI/CD) using GitHub Actions, Docker, and automated deployment scripts.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [GitHub Actions CI/CD](#github-actions-cicd)
5. [Docker Deployment](#docker-deployment)
6. [Server Deployment](#server-deployment)
7. [Monitoring & Maintenance](#monitoring--maintenance)

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **MongoDB**: 6.0 or higher
- **Redis**: 7.0 or higher (optional, for caching)
- **Git**: Latest version
- **Docker**: 20.10 or higher (for containerized deployment)
- **Nginx**: Latest version (for production server)

### Required Accounts & API Keys
- **GitHub Account**: For repository and CI/CD
- **OpenRouter API Key**: [Get from OpenRouter](https://openrouter.ai/keys)
- **Hugging Face API Key**: [Get from Hugging Face](https://huggingface.co/settings/tokens)
- **Cloudinary Account**: [Sign up for Cloudinary](https://cloudinary.com/)
- **MongoDB Atlas**: [Cloud MongoDB service](https://www.mongodb.com/atlas) (optional)

## Environment Setup

### 1. Create Environment File

First, create your `.env` file based on the example:

```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file with your actual values
nano .env
```

### 2. Required Environment Variables

Fill in these **required** variables in your `.env` file:

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
# OR for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-study-helper

# ========================================
# Security (Required)
# ========================================
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
```

### 3. Test Environment Configuration

Test that your environment is properly configured:

```bash
# Start the server
npm start

# Check the health endpoint
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

## Local Development

### 1. Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

**Available Services:**
- **App**: http://localhost:5000
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379
- **Mongo Express**: http://localhost:8081 (admin:admin123)
- **Redis Commander**: http://localhost:8082

### 2. Manual Setup

```bash
# Install dependencies
npm install

# Start MongoDB (if running locally)
mongod --dbpath /data/db

# Start the application
npm run dev
```

## GitHub Actions CI/CD

### 1. Repository Setup

1. **Push your code to GitHub**
2. **Set up GitHub Secrets** in your repository:
   - Go to `Settings` → `Secrets and variables` → `Actions`
   - Add the following secrets:

```bash
# Required Secrets
SNYK_TOKEN=your-snyk-token
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
OPENROUTER_API_KEY=your-openrouter-api-key
HF_API_KEY=your-hugging-face-api-key
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Optional Secrets
DEPLOY_SSH_KEY=your-server-ssh-private-key
DEPLOY_HOST=your-server-ip-or-domain
DEPLOY_USER=your-server-username
```

### 2. CI/CD Pipeline Features

The GitHub Actions workflow includes:

- ✅ **Code Quality**: ESLint, Prettier, security audits
- ✅ **Testing**: Unit tests, integration tests, coverage reports
- ✅ **Security**: Snyk vulnerability scanning, OWASP dependency check
- ✅ **Build**: Automated build and packaging
- ✅ **Deployment**: Staging (develop branch) and production (main branch)
- ✅ **Performance**: Performance testing and reporting
- ✅ **Monitoring**: Health checks and monitoring setup

### 3. Branch Strategy

```bash
# Development workflow
develop → staging deployment → testing → main → production deployment

# Feature development
feature/new-feature → develop (via pull request)
```

## Docker Deployment

### 1. Build Production Image

```bash
# Build production image
docker build --target production -t ai-study-helper:latest .

# Build development image
docker build --target development -t ai-study-helper:dev .
```

### 2. Run Production Container

```bash
# Run with environment variables
docker run -d \
  --name ai-study-helper \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e MONGO_URI=your-mongodb-uri \
  -e JWT_SECRET=your-jwt-secret \
  -e OPENROUTER_API_KEY=your-openrouter-key \
  -e HF_API_KEY=your-huggingface-key \
  -e CLOUDINARY_CLOUD_NAME=your-cloud-name \
  -e CLOUDINARY_API_KEY=your-api-key \
  -e CLOUDINARY_API_SECRET=your-api-secret \
  ai-study-helper:latest

# Or use environment file
docker run -d \
  --name ai-study-helper \
  -p 5000:5000 \
  --env-file .env \
  ai-study-helper:latest
```

### 3. Docker Compose Production

```bash
# Start production services
docker-compose --profile production up -d

# View logs
docker-compose --profile production logs -f
```

## Server Deployment

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y nodejs npm nginx mongodb redis-server

# Create application user
sudo useradd -r -s /bin/false nodejs
```

### 2. Automated Deployment

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Run deployment (as root)
sudo ./scripts/deploy.sh --user nodejs
```

### 3. Manual Deployment Steps

If you prefer manual deployment:

```bash
# 1. Create application directory
sudo mkdir -p /opt/ai-study-helper
sudo chown nodejs:nodejs /opt/ai-study-helper

# 2. Copy application files
sudo cp -r src/* /opt/ai-study-helper/
sudo cp package*.json /opt/ai-study-helper/
sudo cp .env /opt/ai-study-helper/

# 3. Install dependencies
cd /opt/ai-study-helper
sudo -u nodejs npm ci --only=production

# 4. Create systemd service
sudo nano /etc/systemd/system/ai-study-helper.service

# 5. Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable ai-study-helper
sudo systemctl start ai-study-helper
```

### 4. Nginx Configuration

The deployment script automatically creates Nginx configuration, but you can customize it:

```bash
# Edit Nginx configuration
sudo nano /etc/nginx/sites-available/ai-study-helper

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 5. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring & Maintenance

### 1. Health Monitoring

```bash
# Check application status
curl http://localhost:5000/health

# Check systemd service
sudo systemctl status ai-study-helper

# Check Nginx status
sudo systemctl status nginx
```

### 2. Logs

```bash
# Application logs
sudo journalctl -u ai-study-helper -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### 3. Performance Monitoring

```bash
# System resources
htop
iotop
nethogs

# Application metrics
curl http://localhost:5000/health
```

### 4. Backup & Recovery

```bash
# Database backup
mongodump --uri="your-mongodb-uri" --out=/backup/$(date +%Y%m%d)

# Application backup
sudo cp -r /opt/ai-study-helper /backup/app-$(date +%Y%m%d)

# Restore from backup
mongorestore --uri="your-mongodb-uri" /backup/20241220/
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   ```bash
   # Check .env file exists
   ls -la .env
   
   # Verify file permissions
   chmod 600 .env
   ```

2. **MongoDB Connection Issues**
   ```bash
   # Test MongoDB connection
   mongosh "your-mongodb-uri"
   
   # Check MongoDB service
   sudo systemctl status mongod
   ```

3. **Port Already in Use**
   ```bash
   # Check what's using port 5000
   sudo lsof -i :5000
   
   # Kill process if needed
   sudo kill -9 <PID>
   ```

4. **Permission Issues**
   ```bash
   # Fix ownership
   sudo chown -R nodejs:nodejs /opt/ai-study-helper
   
   # Fix permissions
   sudo chmod -R 755 /opt/ai-study-helper
   ```

### Getting Help

1. **Check logs**: `sudo journalctl -u ai-study-helper -f`
2. **Health endpoint**: `curl http://localhost:5000/health`
3. **GitHub Issues**: Create an issue in your repository
4. **Documentation**: Refer to API documentation and setup guides

## Security Considerations

### 1. Environment Variables
- Never commit `.env` files to version control
- Use strong, unique JWT secrets
- Rotate API keys regularly

### 2. Server Security
- Keep system packages updated
- Use firewall (UFW) to restrict access
- Enable fail2ban for SSH protection
- Use SSH keys instead of passwords

### 3. Application Security
- Validate all inputs
- Use HTTPS in production
- Implement rate limiting
- Regular security audits

## Next Steps

1. **Set up your environment variables**
2. **Test locally with Docker Compose**
3. **Push to GitHub and set up secrets**
4. **Deploy to staging environment**
5. **Test thoroughly before production**
6. **Set up monitoring and alerts**

Your AI Study Helper Backend is now ready for production deployment with full CI/CD automation! 🚀
