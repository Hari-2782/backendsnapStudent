const express = require('express');
const cors = require('cors');
const connectDB = require('./utils/db');
const path = require('path');

// Load environment variables
// Try multiple possible paths for .env file
const possiblePaths = [
  path.join(__dirname, '..', '.env'),           // src/.env
  path.join(__dirname, '..', '..', '.env'),     // project root
  path.join(process.cwd(), '.env'),             // current working directory
  '.env'                                        // relative to current directory
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  if (require('fs').existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`✅ Loaded .env from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('⚠️  No .env file found. Looking for environment variables...');
  require('dotenv').config(); // Try default locations
}

// Validate required environment variables
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'OPENROUTER_API_KEY',
  'HF_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('\n📝 Please create a .env file based on env.example');
  console.error('💡 Copy env.example to .env and fill in your values');
  process.exit(1);
}

console.log('✅ All required environment variables are configured');

const app = express();

// Log CORS configuration
console.log('🌐 CORS Configuration:');
console.log('   Allowed Origins:', [
  'https://snapsstudy.netlify.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:8080'
].join(', '));
console.log('   Credentials:', 'enabled');
console.log('   Methods:', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://snapsstudy.netlify.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:8080'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],
  exposedHeaders: ['Content-Length', 'X-Total-Count'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://snapsstudy.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://snapsstudy.netlify.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/process', require('./routes/processRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/mindmap', require('./routes/mindmapRoutes'));
app.use('/api/quiz', require('./routes/quizRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/bookmarks', require('./routes/bookmarkRoutes'));
app.use('/api/calendar', require('./routes/calendarRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/evidence', require('./routes/evidenceRoutes'));

// Notes API routes
app.use('/api/notes', require('./routes/notesRoutes'));

// Direct mindmap endpoint for frontend compatibility
app.get('/mindmap', async (req, res) => {
  try {
    const Session = require('./models/Session');
    const latestSession = await Session.findOne(
      {},
      {},
      { sort: { createdAt: -1 } }
    );
    
    if (!latestSession) {
      return res.json([]); // Return empty array if no sessions
    }
    
    // Convert session nodes to mindmap format
    const mindmapNodes = latestSession.nodes.map(node => ({
      id: node.id,
      label: node.content,
      x: node.position.x,
      y: node.position.y,
      level: 0, // Will be computed by frontend
      children: [],
      parent: undefined
    }));
    
    // Add edges to create parent-child relationships
    latestSession.edges.forEach(edge => {
      const sourceNode = mindmapNodes.find(n => n.id === edge.source);
      const targetNode = mindmapNodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        sourceNode.children.push(targetNode.id);
        targetNode.parent = sourceNode.id;
      }
    });
    
    res.json(mindmapNodes);
  } catch (error) {
    console.error('Mindmap endpoint error:', error);
    res.status(500).json({ error: 'Failed to get mindmap data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Connect DB
connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'NOT SET'}`);
  console.log(`🌐 MongoDB: ${process.env.MONGO_URI ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`🤖 OpenRouter: ${process.env.OPENROUTER_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`🤗 Hugging Face: ${process.env.HF_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`🔑 OpenAI: ${process.env.DASHSCOPE_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
});

// Export for Vercel
module.exports = app;
