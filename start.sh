#!/bin/bash

# Startup script for mcpGraph UX
# Usage: ./start.sh <port> <config-path>

if [ $# -lt 2 ]; then
  echo "Usage: ./start.sh <port> <config-path>"
  echo "Example: ./start.sh 3000 ../mcpGraph/examples/count_files.yaml"
  exit 1
fi

PORT=$1
CONFIG_PATH=$2

echo "Starting mcpGraph UX server..."
echo "Port: $PORT"
echo "Config: $CONFIG_PATH"

npm run server $PORT $CONFIG_PATH

