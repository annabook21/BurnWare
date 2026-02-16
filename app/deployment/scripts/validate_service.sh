#!/bin/bash
# Validate Service Script for CodeDeploy ValidateService hook

set -e

echo "Validating application health"

cd /opt/burnware
PM2="node node_modules/pm2/bin/pm2"

# Wait for application to be ready
sleep 10

# Check if PM2 process is running (redirect PM2 streams)
if ! su - ec2-user -c "cd /opt/burnware && $PM2 status burnware-api" </dev/null 2>/dev/null | grep online; then
  echo "ERROR: Application is not running"
  su - ec2-user -c "cd /opt/burnware && $PM2 logs burnware-api --lines 50 --nostream" </dev/null 2>/dev/null || true
  exit 1
fi

# Check health endpoint
max_retries=10
retry_count=0

while [ $retry_count -lt $max_retries ]; do
  if curl -sf http://localhost:3000/health; then
    echo ""
    echo "Health check passed"
    exit 0
  fi

  echo "Health check failed, retrying... ($((retry_count + 1))/$max_retries)"
  sleep 5
  retry_count=$((retry_count + 1))
done

echo "ERROR: Health check failed after $max_retries attempts"
su - ec2-user -c "cd /opt/burnware && $PM2 logs burnware-api --lines 50 --nostream" </dev/null 2>/dev/null || true
exit 1
