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
<html>
<head>
  <meta charset="UTF-8">
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
</head>

<body>
  <div id="layout">
    
    <!-- LEFT TOOLBAR -->
    <div id="sidebar">
      <button class="sidebar-btn"><span class="icon">💬</span></button>
      <button class="sidebar-btn"><span class="icon">📄</span></button>
      <button class="sidebar-btn"><span class="icon">🔍</span></button>
      <button class="sidebar-btn"><span class="icon">⚙️</span></button>
    </div>

    <!-- MAIN CHAT PANEL -->
    <div id="chat-panel">

      <!-- HEADER -->
      <div id="chat-header">
        <div class="title">Claude Cook</div>
        <div class="model-dropdown">
          <select id="modelSelect">
            <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="llama-3.1">Llama 3.1</option>
          </select>
        </div>
      </div>

      <!-- MESSAGES -->
      <div id="messages"></div>

      <!-- TYPING INDICATOR -->
      <div id="typing-indicator" class="hidden">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>

      <!-- INPUT BAR -->
      <div id="input-container">
        <button id="addContextBtn">📎 Add Context</button>

        <textarea id="chat-input" placeholder="Describe what to build next"></textarea>
        
       <button id="sendBtn">
  <span class="send-label">Send</span>
  <span class="send-loader hidden">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </span>
</button>

      </div>

    </div>

  </div>

  <script src="${markedUri}"></script>
  <script src="${highlightUri}"></script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
