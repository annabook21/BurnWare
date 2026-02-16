#!/bin/bash
# Stop Application Script for CodeDeploy BeforeInstall hook
# IMPORTANT: All PM2 commands MUST redirect streams to /dev/null to prevent
# the daemon from inheriting CodeDeploy's stdout/stderr FDs, which causes
# the hook to hang indefinitely (aws-codedeploy-agent#118).

set -e

echo "Stopping BurnWare application"

PM2="/opt/burnware/node_modules/pm2/bin/pm2"

if [ -f "$PM2" ] && [ -S "/home/ec2-user/.pm2/rpc.sock" ]; then
  # Kill PM2 daemon and all managed processes in one shot
  su - ec2-user -c "cd /opt/burnware && node $PM2 kill" </dev/null >/dev/null 2>&1 || true
elif [ -f "$PM2" ]; then
  echo "PM2 binary exists but no daemon running, skipping pm2 kill"
else
  echo "PM2 not found at $PM2, skipping stop (first deployment)"
fi

# Kill any remaining node processes as fallback
pkill -f "node.*dist/index.js" 2>/dev/null || true
pkill -f "PM2.*God.*Daemon" 2>/dev/null || true

# Clean deployment directory (preserve .env written by user data)
if [ -d /opt/burnware ]; then
  echo "Cleaning /opt/burnware (preserving .env)"
  # Backup .env, wipe everything, restore .env
  cp /opt/burnware/.env /tmp/_bw_env_backup 2>/dev/null || true
  rm -rf /opt/burnware/*
  rm -rf /opt/burnware/.??* 2>/dev/null || true
  if [ -f /tmp/_bw_env_backup ]; then
    mv /tmp/_bw_env_backup /opt/burnware/.env
  fi
fi

echo "Application stopped"
