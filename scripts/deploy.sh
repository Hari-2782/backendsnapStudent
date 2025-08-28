#!/bin/bash

# ========================================
# AI Study Helper Backend - Deployment Script
# ========================================
# Automated deployment script for production servers
# ========================================

set -e  # Exit on any error

# ========================================
# Configuration
# ========================================
APP_NAME="ai-study-helper"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/opt/backups/$APP_NAME"
LOG_DIR="/var/log/$APP_NAME"
SERVICE_NAME="$APP_NAME.service"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
NGINX_ENABLED="/etc/nginx/sites-enabled/$APP_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================
# Functions
# ========================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

check_dependencies() {
    log_info "Checking system dependencies..."
    
    # Check if required commands exist
    local missing_deps=()
    
    for cmd in systemctl nginx pm2 node npm git; do
        if ! command -v $cmd &> /dev/null; then
            missing_deps+=($cmd)
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies first"
        exit 1
    fi
    
    log_success "All dependencies are available"
}

create_directories() {
    log_info "Creating application directories..."
    
    mkdir -p $APP_DIR
    mkdir -p $BACKUP_DIR
    mkdir -p $LOG_DIR
    mkdir -p $APP_DIR/uploads
    mkdir -p $APP_DIR/logs
    
    # Set proper permissions
    chown -R $APP_USER:$APP_USER $APP_DIR
    chmod -R 755 $APP_DIR
    
    log_success "Directories created successfully"
}

backup_current() {
    if [ -d "$APP_DIR/current" ]; then
        log_info "Creating backup of current deployment..."
        
        local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
        local backup_path="$BACKUP_DIR/$backup_name"
        
        cp -r $APP_DIR/current $backup_path
        
        # Keep only last 5 backups
        cd $BACKUP_DIR
        ls -t | tail -n +6 | xargs -r rm -rf
        
        log_success "Backup created: $backup_name"
    fi
}

deploy_application() {
    log_info "Deploying application..."
    
    local deploy_dir="$APP_DIR/current"
    local temp_dir="$APP_DIR/temp"
    
    # Clean temp directory
    rm -rf $temp_dir
    mkdir -p $temp_dir
    
    # Copy application files
    cp -r src/* $temp_dir/
    cp package*.json $temp_dir/
    cp .env $temp_dir/
    cp ecosystem.config.js $temp_dir/ 2>/dev/null || true
    
    # Install production dependencies
    cd $temp_dir
    npm ci --only=production
    
    # Move to current directory
    if [ -d "$deploy_dir" ]; then
        rm -rf $deploy_dir
    fi
    mv $temp_dir $deploy_dir
    
    # Set proper permissions
    chown -R $APP_USER:$APP_USER $deploy_dir
    chmod -R 755 $deploy_dir
    
    log_success "Application deployed successfully"
}

setup_environment() {
    log_info "Setting up environment variables..."
    
    if [ ! -f "$APP_DIR/.env" ]; then
        log_error "Environment file not found at $APP_DIR/.env"
        log_info "Please create the .env file with proper configuration"
        exit 1
    fi
    
    # Validate required environment variables
    local required_vars=(
        "MONGO_URI"
        "JWT_SECRET"
        "OPENROUTER_API_KEY"
        "HF_API_KEY"
        "CLOUDINARY_CLOUD_NAME"
        "CLOUDINARY_API_KEY"
        "CLOUDINARY_API_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$APP_DIR/.env"; then
            log_warning "Missing environment variable: $var"
        fi
    done
    
    log_success "Environment setup completed"
}

setup_systemd_service() {
    log_info "Setting up systemd service..."
    
    local service_file="/etc/systemd/system/$SERVICE_NAME"
    
    cat > $service_file << EOF
[Unit]
Description=AI Study Helper Backend
After=network.target mongod.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/current
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    
    log_success "Systemd service configured"
}

setup_nginx() {
    log_info "Setting up Nginx configuration..."
    
    # Create Nginx configuration
    cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;  # Replace with your domain
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:5000;
        access_log off;
    }
    
    # Static files (if any)
    location /static/ {
        alias $APP_DIR/current/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable site
    ln -sf $NGINX_CONF $NGINX_ENABLED
    
    # Test Nginx configuration
    nginx -t
    
    log_success "Nginx configuration completed"
}

restart_services() {
    log_info "Restarting services..."
    
    # Restart application service
    systemctl restart $SERVICE_NAME
    
    # Reload Nginx
    systemctl reload nginx
    
    log_success "Services restarted successfully"
}

health_check() {
    log_info "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:5000/health > /dev/null 2>&1; then
            log_success "Application is healthy and responding"
            return 0
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 5 seconds..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

rollback() {
    log_warning "Rolling back to previous deployment..."
    
    if [ -d "$APP_DIR/current" ]; then
        rm -rf $APP_DIR/current
    fi
    
    # Find latest backup
    local latest_backup=$(ls -t $BACKUP_DIR | head -n1)
    
    if [ -n "$latest_backup" ]; then
        cp -r $BACKUP_DIR/$latest_backup $APP_DIR/current
        chown -R $APP_USER:$APP_USER $APP_DIR/current
        log_success "Rollback completed to: $latest_backup"
    else
        log_error "No backup found for rollback"
        exit 1
    fi
}

# ========================================
# Main Deployment Process
# ========================================
main() {
    log_info "Starting deployment process..."
    
    # Check if running as root
    check_root
    
    # Check dependencies
    check_dependencies
    
    # Create directories
    create_directories
    
    # Setup environment
    setup_environment
    
    # Backup current deployment
    backup_current
    
    # Deploy application
    deploy_application
    
    # Setup systemd service
    setup_systemd_service
    
    # Setup Nginx
    setup_nginx
    
    # Restart services
    restart_services
    
    # Health check
    if health_check; then
        log_success "Deployment completed successfully!"
    else
        log_error "Deployment failed health check, rolling back..."
        rollback
        restart_services
        exit 1
    fi
}

# ========================================
# Script Execution
# ========================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Set default values
    APP_USER=${APP_USER:-"nodejs"}
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --user)
                APP_USER="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--user USERNAME]"
                echo "  --user USERNAME  Set the user to run the application (default: nodejs)"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    main "$@"
fi
