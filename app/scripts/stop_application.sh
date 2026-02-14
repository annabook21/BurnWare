#!/bin/bash
# Stop Application Script for CodeDeploy BeforeInstall hook

set -e

echo "Stopping BurnWare application"

# Use absolute path — BeforeInstall runs BEFORE new files are copied
PM2="/opt/burnware/node_modules/pm2/bin/pm2"

if [ -f "$PM2" ]; then
  su - ec2-user -c "cd /opt/burnware && node $PM2 stop burnware-api || true"
else
  echo "PM2 not found at $PM2, skipping stop (first deployment)"
fi

# Clean deployment directory (preserve .env written by user data)
# This prevents "file already exists" errors when user data already
# extracted the app before CodeDeploy runs its Install step.
if [ -d /opt/burnware ]; then
  echo "Cleaning /opt/burnware (preserving .env)"
  find /opt/burnware -mindepth 1 -not -name '.env' -delete 2>/dev/null || true
fi

echo "Application stopped"
