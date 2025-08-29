# AI Study Helper Backend

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18.2-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **AI-powered study assistant with vision processing, semantic search, and advanced learning tools**

## 🚀 Features

- **🔍 Vision Processing**: Extract text and understand images using OCR and AI
- **📄 PDF Processing**: Extract text and analyze content from PDF documents
- **🔄 AI Fallbacks**: DashScope Qwen-VL integration for OCR and RAG fallbacks
- **🧠 Semantic Search**: Advanced search with context understanding
- **🗺️ Mind Mapping**: Generate interactive mind maps from content
- **📝 Quiz Generation**: Create quizzes from study materials
- **💬 RAG Chat**: Context-aware chat with retrieved information
- **📚 Session Management**: Organize and track study sessions
- **🔖 Bookmarks**: Save and organize important content
- **📅 Calendar Integration**: Schedule and manage study sessions
- **📝 Notes**: Create and manage study notes
- **🔐 Authentication**: Secure user authentication with JWT

## 🏗️ Architecture

```
AI Study Helper Backend
├── 📁 src/
│   ├── 🎯 controllers/     # Request handlers
│   ├── 🛡️ middleware/      # Authentication & validation
│   ├── 📊 models/          # Database models
│   ├── 🛣️ routes/          # API routes
│   ├── 🔧 services/        # Business logic
│   ├── 🛠️ utils/           # Utilities & helpers
│   └── 🖥️ server.js        # Main server file
├── 🐳 Dockerfile           # Container configuration
├── 🐙 docker-compose.yml   # Local development setup
├── ⚙️ render.yaml          # Render deployment config
└── 📋 package.json         # Dependencies & scripts
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **MongoDB** 6.0 or higher
- **API Keys**: OpenRouter, Hugging Face, Cloudinary

### 1. Clone & Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-study-helper-backend

# Install dependencies
npm install

# Setup environment variables
npm run setup
```

### 2. Configure Environment

Edit the `.env` file with your API keys:

```bash
# Required API Keys
OPENROUTER_API_KEY=sk-or-your-actual-key
HF_API_KEY=hf-your-actual-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Database
MONGO_URI=mongodb://localhost:27017/ai-study-helper

# Security
JWT_SECRET=your-super-secret-jwt-key
```

### 3. Start Development

```bash
# Start with auto-restart
npm run dev

# Or start production
npm start
```

### 4. Test the API

```bash
# Health check
curl http://localhost:5000/health

# Expected response
{
  "status": "OK",
  "timestamp": "2024-12-20T10:00:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

## 🐳 Docker Development

### Quick Start with Docker Compose

```bash
# Start all services (MongoDB, Redis, etc.)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Available Services

| Service | URL | Description |
|---------|-----|-------------|
| **App** | http://localhost:5000 | Main API server |
| **MongoDB** | localhost:27017 | Database |
| **Redis** | localhost:6379 | Cache |
| **Mongo Express** | http://localhost:8081 | Database admin (admin:admin123) |
| **Redis Commander** | http://localhost:8082 | Cache admin |

## 🌐 Deployment

### Render Deployment

This project is configured for easy deployment on Render.com.

#### 1. Connect to Render

1. **Fork/Clone** this repository to your GitHub account
2. **Connect** your repository to Render
3. **Create** a new Web Service

#### 2. Configure Environment Variables

In your Render dashboard, add these environment variables:

```bash
# Required
NODE_ENV=production
PORT=10000
MONGO_URI=your-mongodb-atlas-uri
JWT_SECRET=your-super-secret-jwt-key
OPENROUTER_API_KEY=sk-or-your-actual-key
HF_API_KEY=hf-your-actual-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Optional
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### 3. Build Configuration

Render will automatically detect the configuration from `render.yaml`:

```yaml
services:
  - type: web
    name: ai-study-helper-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

#### 4. Deploy

1. **Push** your code to GitHub
2. **Render** will automatically build and deploy
3. **Monitor** the deployment logs
4. **Test** your live API

### Other Deployment Options

#### Docker Deployment

```bash
# Build production image
docker build --target production -t ai-study-helper:latest .

# Run container
docker run -d \
  --name ai-study-helper \
  -p 5000:5000 \
  --env-file .env \
  ai-study-helper:latest
```

#### Server Deployment

```bash
# Use the automated deployment script
chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh --user nodejs
```

## 📚 API Documentation

### Base URL
```
Production: https://your-app-name.onrender.com
Development: http://localhost:5000
```

### Authentication
```bash
# Get token
curl -X POST http://localhost:5000/api/auth/dev-login

# Use token
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/auth/me
```

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/auth/register` | User registration |
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/upload` | Upload image |
| `POST` | `/api/process` | Process image |
| `GET` | `/api/chat/history` | Get chat history |
| `POST` | `/api/chat/rag` | Chat with RAG |
| `GET` | `/api/search/semantic` | Semantic search |

### Complete API Reference

📖 **[Full API Documentation](API_DOCUMENTATION.md)**

## 🔧 Development

### Project Structure

```
src/
├── controllers/          # Request handlers
│   ├── authController.js
│   ├── chatController.js
│   ├── processController.js
│   └── ...
├── middleware/           # Middleware functions
│   ├── auth.js
│   └── ...
├── models/              # Database models
│   ├── User.js
│   ├── Session.js
│   └── ...
├── routes/              # API routes
│   ├── authRoutes.js
│   ├── chatRoutes.js
│   └── ...
├── services/            # Business logic
│   ├── embedService.js
│   ├── nlpService.js
│   └── ...
├── utils/               # Utilities
│   ├── db.js
│   ├── apiResponse.js
│   └── ...
└── server.js            # Main server file
```

### Available Scripts

```bash
# Development
npm run dev              # Start with nodemon
npm run setup            # Setup environment

# Testing
npm test                 # Run tests
npm run test:openrouter  # Test OpenRouter integration
npm run test:vision      # Test vision processing

# Production
npm start                # Start production server
npm run build            # Build for production
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key |
| `DASHSCOPE_API_KEY` | ❌ | DashScope API key (fallback for OCR/RAG) |
| `HF_API_KEY` | ✅ | Hugging Face API key |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `PORT` | ❌ | Server port (default: 5000) |
| `NODE_ENV` | ❌ | Environment (default: development) |

## 🧪 Testing

### Run Tests

```bash
# All tests
npm test

# Specific tests
npm run test:openrouter
npm run test:vision
npm run test:config
npm run test:dashscope
```

### Test API Endpoints

Use the provided Postman collection:
- **Import**: `AI_Study_Helper_API.postman_collection.json`
- **Setup**: Configure environment variables
- **Test**: Run through the collection

## 🔒 Security

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Built-in request rate limiting
- **Input Validation**: Comprehensive input sanitization
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers middleware
- **Environment Variables**: Secure configuration management

## 📊 Monitoring

### Health Check

```bash
curl https://your-app.onrender.com/health
```

### Logs

```bash
# Render logs
render logs

# Docker logs
docker-compose logs -f app

# Local logs
npm run dev
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

### Development Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation
- Use conventional commits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help

1. **Check** the [Quick Start Guide](QUICK_START.md)
2. **Read** the [Deployment Guide](DEPLOYMENT_GUIDE.md)
3. **Review** the [API Documentation](API_DOCUMENTATION.md)
4. **Open** an issue on GitHub

### Common Issues

- **Environment Variables**: Use `npm run setup`
- **MongoDB Connection**: Check your connection string
- **API Keys**: Verify all required keys are set
- **Port Issues**: Check if port 5000 is available

## 🎯 Roadmap

- [ ] **Real-time Chat**: WebSocket support
- [x] **File Upload**: Support for PDFs and documents
- [ ] **Analytics**: User progress tracking
- [ ] **Mobile API**: Optimized for mobile apps
- [ ] **Multi-language**: Internationalization support
- [ ] **Advanced AI**: More sophisticated AI models

---

**Built with ❤️ for better learning experiences**
