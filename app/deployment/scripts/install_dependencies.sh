#!/bin/bash
# Install Dependencies Script for CodeDeploy AfterInstall hook
# Node.js is installed by user data via dnf; node_modules are bundled in artifact.

set -e

echo "Running AfterInstall: verifying dependencies"

cd /opt/burnware

# Verify Node.js is available (installed by user data via dnf)
if ! command -v node &>/dev/null; then
  echo "WARNING: Node.js not found. Attempting install from AL2023 repos..."
  dnf install -y nodejs20 nodejs20-npm
fi

# Verify bundled node_modules exist
if [ ! -d "node_modules" ]; then
  echo "ERROR: node_modules directory not found in artifact."
  echo "The artifact should include bundled production dependencies."
  exit 1
fi

# Verify PM2 is available in bundled modules
if [ ! -x "node_modules/.bin/pm2" ]; then
  echo "ERROR: PM2 not found in bundled node_modules."
  exit 1
fi

# Create logs directory
mkdir -p /opt/burnware/logs

# Set ownership
chown -R ec2-user:ec2-user /opt/burnware

echo "AfterInstall complete: dependencies verified"
