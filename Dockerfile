# ========================================
# AI Study Helper Backend - Dockerfile
# ========================================
# Multi-stage build for production deployment
# ========================================

# ========================================
# Stage 1: Dependencies
# ========================================
FROM node:18-alpine AS deps

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# ========================================
# Stage 2: Build
# ========================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Build application (if you have a build script)
RUN npm run build || echo "No build script found, skipping build step"

# ========================================
# Stage 3: Production
# ========================================
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy necessary files
COPY --chown=nodejs:nodejs .env.example ./
COPY --chown=nodejs:nodejs README.md ./
COPY --chown=nodejs:nodejs render.yaml ./

# Create necessary directories
RUN mkdir -p logs uploads temp

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]

# ========================================
# Stage 4: Development (optional)
# ========================================
FROM node:18-alpine AS development

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start development server
CMD ["npm", "run", "dev"]
