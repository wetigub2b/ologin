#!/bin/bash

# OAuth Login Demo - Deployment Script
# This script deploys the Node.js application to the WEB_ROOT directory

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_info "Please copy .env.example to .env and configure it first:"
    echo "    cp .env.example .env"
    exit 1
fi

# Load environment variables from .env
print_info "Loading environment variables from .env..."
export $(grep -v '^#' .env | grep -v '^$' | xargs)

# Check if WEB_ROOT is defined
if [ -z "$WEB_ROOT" ]; then
    print_error "WEB_ROOT is not defined in .env file!"
    exit 1
fi

print_info "Deployment target: $WEB_ROOT"

# Run build/preparation steps
print_info "Running build preparation..."

# Install/update dependencies
print_info "Installing dependencies..."
npm install --production=false

# Run any build scripts (if they exist)
if npm run build --if-present 2>/dev/null; then
    print_success "Build completed"
else
    print_info "No build script found, skipping..."
fi

# Create WEB_ROOT directory if it doesn't exist
if [ ! -d "$WEB_ROOT" ]; then
    print_info "Creating deployment directory: $WEB_ROOT"
    mkdir -p "$WEB_ROOT"
fi

# Create a list of files to exclude from deployment
print_info "Preparing deployment package..."

# Temporary directory for staging
STAGING_DIR=$(mktemp -d)
print_info "Staging directory: $STAGING_DIR"

# Copy files to staging, excluding unnecessary files
print_info "Copying application files..."
rsync -av \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude '.env.*' \
    --exclude '*.log' \
    --exclude '.DS_Store' \
    --exclude 'deploy.sh' \
    --exclude '*.p8' \
    --exclude 'tmp' \
    --exclude 'temp' \
    ./ "$STAGING_DIR/"

# Copy .env.example for reference (but not .env with secrets)
cp .env.example "$STAGING_DIR/"

print_success "Files copied to staging area"

# Install production dependencies in staging
print_info "Installing production dependencies..."
cd "$STAGING_DIR"
npm install --production

# Copy from staging to WEB_ROOT
print_info "Deploying to $WEB_ROOT..."
rsync -av --delete "$STAGING_DIR/" "$WEB_ROOT/"

# Copy .env file separately (if it exists in WEB_ROOT, keep it; otherwise prompt)
if [ -f "$WEB_ROOT/.env" ]; then
    print_warning ".env already exists in deployment directory - keeping existing configuration"
else
    print_warning "No .env file found in deployment directory"
    read -p "Do you want to copy the current .env file? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env "$WEB_ROOT/.env"
        print_success ".env file copied to deployment directory"
        print_warning "Remember to update OAuth callback URLs for production!"
    else
        print_info "You'll need to manually create $WEB_ROOT/.env before starting the app"
    fi
fi

# Copy any .p8 private keys if they exist (for Apple Sign In)
if ls *.p8 1> /dev/null 2>&1; then
    print_info "Copying Apple Sign In private keys..."
    cp *.p8 "$WEB_ROOT/" 2>/dev/null || true
fi

# Clean up staging directory
print_info "Cleaning up staging directory..."
rm -rf "$STAGING_DIR"

# Set proper permissions
print_info "Setting file permissions..."
chmod -R 755 "$WEB_ROOT"
chmod 600 "$WEB_ROOT/.env" 2>/dev/null || true
chmod 600 "$WEB_ROOT"/*.p8 2>/dev/null || true

print_success "Deployment completed successfully!"
echo ""
print_info "Deployment Summary:"
echo "  - Application deployed to: $WEB_ROOT"
echo "  - Node.js modules: Installed (production only)"
echo "  - Environment: Check $WEB_ROOT/.env"
echo ""
print_info "Next steps:"
echo "  1. Review $WEB_ROOT/.env and update production settings"
echo "  2. Update OAuth callback URLs in Google/Apple consoles"
echo "  3. Start the application:"
echo "     cd $WEB_ROOT && npm start"
echo "  4. Or use PM2 for production:"
echo "     pm2 start $WEB_ROOT/server.js --name oauth-login"
echo "     pm2 save"
echo "     pm2 startup"
echo ""
print_warning "Important: Make sure to configure your web server (nginx/apache) as a reverse proxy!"
