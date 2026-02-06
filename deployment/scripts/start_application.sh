#!/bin/bash
# Start Application Script for CodeDeploy

set -e

echo "Starting BurnWare application"

cd /opt/burnware

# Start application with PM2
su - ec2-user -c "cd /opt/burnware && pm2 start ecosystem.config.js || pm2 restart burnware-api"
su - ec2-user -c "pm2 save"

echo "Application started"
