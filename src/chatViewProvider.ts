import * as vscode from "vscode";
import { AIService } from "./aiService";
import { AIMessage } from "./types";

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "claude-cook.chatView";
  private _view?: vscode.WebviewView;
  private conversationHistory: AIMessage[] = [];
  private aiService: AIService;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    aiService: AIService
  ) {
    this.aiService = aiService;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "sendMessage":
          await this.handleUserMessage(data.message);
          break;
        case "clearChat":
          this.clearChat();
          break;
        case "switchProvider":
          await this.switchProvider();
          break;
        case "configureKeys":
          await this.configureApiKeys();
          break;
      }
    });

    // Send initial provider info
    this.updateProviderInfo();
  }

  private async handleUserMessage(userMessage: string) {
    if (!userMessage.trim()) return;

    // 1. Add to history
    this.conversationHistory.push({
      role: "user",
      content: userMessage,
    });

    // 2. Show user's message in UI
    this._view?.webview.postMessage({
      type: "userMessage",
      message: userMessage,
    });

    // 3. Start loading animation
    this._view?.webview.postMessage({ type: "startLoading" });

    try {
      const config = vscode.workspace.getConfiguration("claudeCook");
      const includeContext = config.get("includeFileContext", true);

      let contextMessage = "";
      if (includeContext) {
        contextMessage = await this.getFileContext();
      }

      const messages: AIMessage[] = [
        {
          role: "system",
          content: `You are an expert coding assistant integrated into VS Code. You help developers write, understand, and improve code. ${contextMessage}`,
        },
        ...this.conversationHistory,
      ];

      // 4. Stream response
      let assistantResponse = "";

      await this.aiService.streamMessage(messages, (chunk) => {
        assistantResponse += chunk;

        this._view?.webview.postMessage({
          type: "streamChunk",
          chunk: chunk,
        });
      });

      // 5. Save in history
      this.conversationHistory.push({
        role: "assistant",
        content: assistantResponse,
      });

      // 6. End loading
      this._view?.webview.postMessage({ type: "stopLoading" });
    } catch (error: any) {
      this._view?.webview.postMessage({
        type: "error",
        message: error.message,
      });

      this._view?.webview.postMessage({ type: "stopLoading" });

      this.conversationHistory.pop(); // remove user message on error
    }
  }

  private async getFileContext(): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return "";
    }

    const document = editor.document;
    const selection = editor.selection;

    let context = `\n\nCurrent file: ${document.fileName}\nLanguage: ${document.languageId}\n`;

    if (!selection.isEmpty) {
      const selectedText = document.getText(selection);
      context += `\nSelected code:\n\`\`\`${document.languageId}\n${selectedText}\n\`\`\`\n`;
    } else {
      // Include a portion of the file for context (first 100 lines)
      const lineCount = Math.min(document.lineCount, 100);
      const text = document.getText(new vscode.Range(0, 0, lineCount, 0));
      context += `\nFile content (first ${lineCount} lines):\n\`\`\`${document.languageId}\n${text}\n\`\`\`\n`;
    }

    return context;
  }

  public async addCodeToChat(code: string, language: string) {
    const message = `Here's some code I'm working with:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nCan you help me with this?`;

    this._view?.webview.postMessage({
      type: "prefillMessage",
      message: message,
    });

    // Focus the chat view
    if (this._view) {
      this._view.show?.(true);
    }
  }

  public clearChat() {
    this.conversationHistory = [];
    this._view?.webview.postMessage({ type: "clearMessages" });
    vscode.window.showInformationMessage("Chat history cleared");
  }

  private async switchProvider() {
    const current = this.aiService.getCurrentProvider();

    const options = [
      {
        label: "🤖 Claude",
        value: "claude" as const,
        description: "Anthropic Claude",
      },
      {
        label: "💬 ChatGPT",
        value: "openai" as const,
        description: "OpenAI GPT",
      },
      {
        label: "🟢 Ollama (Local)",
        value: "ollama" as const,
        description: "Local LLM running via Ollama",
      },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: `Current: ${
        current === "claude"
          ? "Claude"
          : current === "openai"
          ? "ChatGPT"
          : "Ollama"
      }`,
    });

    if (selected) {
      this.aiService.setProvider(selected.value);
      this.updateProviderInfo();

      vscode.window.showInformationMessage(`Switched to ${selected.label}`);
    }
  }

  private updateProviderInfo() {
    const info = this.aiService.getModelInfo();
    this._view?.webview.postMessage({
      type: "updateProvider",
      provider: info.provider,
      model: info.model,
    });
  }

  private async configureApiKeys() {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "claudeCook"
    );
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "styles.css")
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
    );

    const markedUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "marked.min.js")
    );

    const highlightUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "highlight.min.js")
    );

    const highlightCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "github-dark.css")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src ${webview.cspSource} 'unsafe-inline';
             style-src ${webview.cspSource} 'unsafe-inline';
             img-src ${webview.cspSource} data:;
             font-src ${webview.cspSource};
             "
  >
  <link rel="stylesheet" href="${styleUri}">
  <link rel="stylesheet" href="${highlightCssUri}">
  <title>Code Cook</title>
</head>

<body>
  <div class="cc-root">

    <!-- HEADER -->
    <header class="cc-header">
      <div class="cc-header-left">
        <div class="cc-logo">👨‍🍳</div>
        <div class="cc-title">
          <div class="cc-title-main">Code Cook</div>
          <div class="cc-title-sub">AI Coding Assistant</div>
        </div>
      </div>
      <div class="cc-header-center">
        <div id="cc-provider" class="cc-provider-badge">
          <span class="cc-provider-dot"></span>
          <span>Loading...</span>
        </div>
      </div>
      <div class="cc-header-right">
        <button id="cc-search-btn" class="cc-btn cc-btn-ghost cc-btn-icon" title="Search Messages">
          🔍
        </button>
        <button id="cc-switch" class="cc-btn cc-btn-ghost" title="Switch AI Provider">
          Switch
        </button>
        <button id="cc-clear" class="cc-btn cc-btn-ghost" title="Clear Chat">
          Clear
        </button>
      </div>
    </header>

    <!-- SEARCH BAR -->
    <div id="cc-search" class="cc-search">
      <div class="cc-search-input-wrapper">
        <span class="cc-search-icon">🔍</span>
        <input
          type="text"
          id="cc-search-input"
          class="cc-search-input"
          placeholder="Search messages..."
          autocomplete="off"
        />
        <span id="cc-search-count" class="cc-search-count"></span>
        <button id="cc-search-close" class="cc-btn cc-btn-ghost cc-btn-icon" title="Close">✕</button>
      </div>
    </div>

    <!-- MESSAGES -->
    <main id="cc-messages" class="cc-messages" role="main">
      <div class="cc-welcome">
        <div class="cc-welcome-icon">👨‍🍳</div>
        <div class="cc-welcome-title">Welcome to Code Cook</div>
        <div class="cc-welcome-subtitle">
          Your intelligent AI coding assistant. Ask me anything about your code!
        </div>
        <div class="cc-welcome-tips">
          <div class="cc-tip">
            <span class="cc-tip-icon">💡</span>
            <span>Ask me to explain code, fix bugs, or generate new functions</span>
          </div>
          <div class="cc-tip">
            <span class="cc-tip-icon">⚡</span>
            <span>Use <strong>Ctrl+Enter</strong> to send messages quickly</span>
          </div>
          <div class="cc-tip">
            <span class="cc-tip-icon">🔍</span>
            <span>Search through your conversation history anytime</span>
          </div>
        </div>
      </div>
    </main>

    <!-- INPUT AREA -->
    <footer class="cc-footer">
      <div class="cc-input-container">
        <div class="cc-input-wrapper">
          <textarea
            id="cc-input"
            class="cc-input"
            placeholder="Ask Code Cook anything..."
            rows="1"
            aria-label="Message input"
          ></textarea>
        </div>
        <button id="cc-send" class="cc-btn cc-btn-primary cc-btn-send" aria-label="Send message">
          <span class="cc-btn-text">Send</span>
          <span class="cc-spinner"></span>
        </button>
      </div>
    </footer>

    <!-- STATUS BAR -->
    <div class="cc-status-bar">
      <div class="cc-status-text">
        <span class="cc-status-indicator"></span>
        <span id="cc-status">Ready</span>
      </div>
      <button id="cc-configure" class="cc-link">Settings</button>
    </div>

  </div>

  <script src="${markedUri}"></script>
  <script src="${highlightUri}"></script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
