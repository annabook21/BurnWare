#!/bin/bash
# Start Application Script for CodeDeploy ApplicationStart hook

set -e

echo "Starting BurnWare application"

cd /opt/burnware

PM2="node node_modules/pm2/bin/pm2"

# Start application with bundled PM2 (use direct path, not .bin/ symlink)
su - ec2-user -c "cd /opt/burnware && $PM2 start ecosystem.config.js || $PM2 restart burnware-api"
su - ec2-user -c "cd /opt/burnware && $PM2 save"

echo "Application started"
