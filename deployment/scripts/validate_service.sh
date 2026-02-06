#!/bin/bash
# Validate Service Script for CodeDeploy

set -e

echo "Validating application health"

# Wait for application to be ready
sleep 10

# Check if PM2 process is running
if ! su - ec2-user -c "pm2 status burnware-api | grep online"; then
  echo "ERROR: Application is not running"
  exit 1
fi

# Check health endpoint
max_retries=10
retry_count=0

while [ $retry_count -lt $max_retries ]; do
  if curl -f http://localhost:3000/health; then
    echo "Health check passed"
    exit 0
  fi
  
  echo "Health check failed, retrying... ($((retry_count + 1))/$max_retries)"
  sleep 5
  retry_count=$((retry_count + 1))
done

echo "ERROR: Health check failed after $max_retries attempts"
exit 1
