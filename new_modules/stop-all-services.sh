#!/bin/bash

echo "🛑 Stopping Chat Bot Services..."
echo

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Run the stop script with all arguments passed through
node stop-all-services.js "$@"