#!/bin/bash
# Install git hooks from the hooks/ directory
# Run this script after cloning the repository to set up automatic version.txt updates

echo "📦 Installing git hooks..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not a git repository. Please run this script from the project root."
  exit 1
fi

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy pre-commit hook
if [ -f "hooks/pre-commit" ]; then
  cp hooks/pre-commit .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✅ Installed pre-commit hook (auto-updates version.txt)"
else
  echo "❌ Error: hooks/pre-commit not found"
  exit 1
fi

echo "🎉 Git hooks installed successfully!"
echo ""
echo "ℹ️  The pre-commit hook will automatically update version.txt on every commit."
echo "   This ensures your PWA users get notified of new versions."
