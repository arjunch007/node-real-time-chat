# AWS Auto-Deploy Setup Guide

## Step 1: Configure GitHub Secrets

Go to your GitHub repository → **Settings → Secrets and variables → Actions**

Add these 3 secrets:

### Secret 1: `EC2_HOST`
- **Value**: Your EC2 public IP (e.g., `1.2.3.4`)

### Secret 2: `EC2_USER`
- **Value**: SSH username (typically `ec2-user` for Amazon Linux or `ubuntu` for Ubuntu)

### Secret 3: `EC2_SSH_KEY`
- **Value**: Content of your `.pem` private key file
- **How to get it**: 
  ```bash
  cat ~/.ssh/your-key-pair.pem
  ```
  Copy the entire output (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)

---

## Step 2: Set Up Your EC2 Instance

### Install Node.js (if not already installed)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### Install PM2 (for app management)
```bash
npm install -g pm2
```

### Clone your repository on EC2
```bash
cd ~
git clone https://github.com/YOUR_USERNAME/node-real-time-chat.git
cd node-real-time-chat
npm install
```

### Start your app with PM2
```bash
pm2 start server.js --name "chat-app"
pm2 startup
pm2 save
```

Or if using systemd, create a service file:

**Create `/etc/systemd/system/chat-app.service`:**
```ini
[Unit]
Description=Node.js Real-time Chat App
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/node-real-time-chat
ExecStart=/usr/local/bin/node /home/ec2-user/node-real-time-chat/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable chat-app
sudo systemctl start chat-app
```

---

## Step 3: Test the Deployment

1. Push a change to your `main` branch
2. Go to GitHub → Actions tab
3. Watch the workflow run
4. Check EC2: `ssh -i your-key.pem ec2-user@your-ip` to verify the code was deployed

---

## Troubleshooting

### SSH connection fails
- Ensure EC2 security group allows **port 22** from your IP
- Double-check the `.pem` key is correct
- Verify EC2_USER matches your AMI (ec2-user vs ubuntu)

### App doesn't start
- SSH to EC2 and check: `pm2 logs` or `sudo systemctl status chat-app`
- Verify Node.js dependencies: `npm install`

### Port issues
- Make sure your app listens on the correct port
- Check security group rules for your app's port (usually 3000 or 5000)
