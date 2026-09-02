#!/bin/bash
# EC2 Auto-Deploy Setup Script
# Run this on your EC2 instance to prepare it for auto-deployment

set -e

echo "🚀 Setting up Node.js Real-time Chat on EC2..."

# Update system
echo "📦 Updating system packages..."
sudo yum update -y || sudo apt update -y

# Install Node.js using NVM
echo "📥 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 18
    nvm use 18
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install PM2 globally
echo "📥 Installing PM2..."
sudo npm install -g pm2

# Clone repository (adjust if needed)
REPO_PATH="$HOME/node-real-time-chat"
if [ ! -d "$REPO_PATH" ]; then
    echo "📂 Cloning repository..."
    cd ~
    git clone https://github.com/YOUR_USERNAME/node-real-time-chat.git
else
    echo "✅ Repository already exists at $REPO_PATH"
fi

# Install dependencies
echo "📥 Installing app dependencies..."
cd "$REPO_PATH"
npm install

# Start app with PM2
echo "🚀 Starting app with PM2..."
pm2 start server.js --name "chat-app" || pm2 restart "chat-app"
pm2 startup
pm2 save

echo "✅ Setup complete!"
echo "Your app is now running. Check status with: pm2 status"
echo "View logs with: pm2 logs chat-app"
