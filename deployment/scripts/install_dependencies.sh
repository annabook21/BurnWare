#!/bin/bash
# Install Dependencies Script for CodeDeploy / User Data

set -e

echo "Installing application dependencies"

cd /opt/burnware

# Install Node.js and PM2 if not present (Amazon Linux 2023)
if ! command -v node &>/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  yum install -y nodejs
fi
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

# Install application dependencies
if [ -f package.json ]; then
  npm ci --production
fi

# Set ownership
chown -R ec2-user:ec2-user /opt/burnware

echo "Dependencies installation complete"
