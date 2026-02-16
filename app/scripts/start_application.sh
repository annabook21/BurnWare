#!/bin/bash
# Start Application Script for CodeDeploy ApplicationStart hook
# IMPORTANT: Redirect PM2 streams to prevent inheriting CodeDeploy's FDs

set -e

echo "Starting BurnWare application"

cd /opt/burnware

PM2="node node_modules/pm2/bin/pm2"

# Start application with bundled PM2 (use direct path, not .bin/ symlink)
# Redirect all streams to /dev/null to prevent PM2 daemon from holding
# CodeDeploy's stdout/stderr FDs open (aws-codedeploy-agent#118)
su - ec2-user -c "cd /opt/burnware && $PM2 start ecosystem.config.js || $PM2 restart burnware-api" </dev/null >/dev/null 2>&1
su - ec2-user -c "cd /opt/burnware && $PM2 save" </dev/null >/dev/null 2>&1

echo "Application started"
