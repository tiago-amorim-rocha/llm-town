#!/bin/bash
# Configure git to use .githooks directory for hooks
# Run this script after cloning the repository or when environment resets

echo "📦 Configuring git hooks..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not a git repository. Please run this script from the project root."
  exit 1
fi

# Check if .githooks directory exists
if [ ! -d ".githooks" ]; then
  echo "❌ Error: .githooks directory not found"
  exit 1
fi

# Configure git to use .githooks directory
git config core.hooksPath .githooks

echo "✅ Git hooks configured successfully!"
echo ""
echo "ℹ️  Git is now configured to use hooks from .githooks/ directory."
echo "   The pre-commit hook will automatically update version.txt on every commit."
echo "   This ensures your PWA users get notified of new versions."
