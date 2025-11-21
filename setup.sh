#!/bin/bash

echo "🍳 Setting up Claude Cook AI Coding Assistant..."
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this from the claude-cook directory."
    exit 1
fi

echo "📦 Installing dependencies..."
echo "This may take a few minutes..."
echo ""
npm install

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "🔨 Compiling TypeScript..."
npm run compile

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to compile TypeScript"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "=================================================="
echo "🎉 Claude Cook is ready to use!"
echo "=================================================="
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Open in VS Code:"
echo "   code ."
echo ""
echo "2. Press F5 to run the extension in debug mode"
echo ""
echo "3. In the new VS Code window:"
echo "   - Click the Claude Cook icon in the sidebar (chef hat)"
echo "   - Or press Cmd/Ctrl+Shift+L to open the chat"
echo ""
echo "4. Configure your API keys:"
echo "   - Press Cmd/Ctrl+Shift+P"
echo "   - Type 'Claude Cook: Configure API Keys'"
echo "   - Add your Anthropic or OpenAI API key"
echo ""
echo "📚 Documentation:"
echo "   - README.md for full documentation"
echo "   - CHANGELOG.md for version history"
echo ""
echo "🐛 Issues or questions?"
echo "   - https://github.com/your-username/claude-cook/issues"
echo ""
echo "Happy coding! 🚀"
echo ""