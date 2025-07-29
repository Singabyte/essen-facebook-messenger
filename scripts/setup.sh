#!/bin/bash

# Setup script for Facebook Messenger Bot

echo "🚀 Facebook Messenger Bot Setup"
echo "==============================="

# Check Node.js version
echo "🔍 Checking Node.js version..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Node.js 18 or higher is required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your credentials!"
else
    echo "✅ .env file exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p database logs

# Initialize database
echo "🗄️ Initializing database..."
node -e "require('./src/database').initDatabase().then(() => process.exit(0))" || {
    echo "❌ Failed to initialize database"
    exit 1
}

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x scripts/*.sh

echo ""
echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Facebook and Gemini credentials"
echo "2. Run 'npm run dev' to start development server"
echo "3. Configure Facebook webhook at: http://localhost:3000/webhook"
echo ""
echo "For production deployment:"
echo "1. Set up your DigitalOcean droplet"
echo "2. Configure Nginx and SSL"
echo "3. Use PM2 for process management"
echo "4. Run './scripts/deploy.sh' for deployment"