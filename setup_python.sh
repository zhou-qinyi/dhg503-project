#!/bin/bash
set -e

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    if ! command -v virtualenv >/dev/null 2>&1; then
        echo "Installing virtualenv..."
        pip install virtualenv
    fi
    virtualenv .venv
fi

# Activate virtual environment based on OS
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "Error: Could not find virtual environment activation script"
    exit 1
fi

pip install -r requirements.txt
