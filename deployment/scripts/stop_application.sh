#!/bin/bash
# Stop Application Script for CodeDeploy

set -e

echo "Stopping BurnWare application"

# Stop PM2 process
su - ec2-user -c "pm2 stop burnware-api || true"

echo "Application stopped"
