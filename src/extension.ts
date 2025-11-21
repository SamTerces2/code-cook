import * as vscode from "vscode";
import { AIService } from "./aiService";
import { ChatViewProvider } from "./chatViewProvider";

let aiService: AIService;
let chatViewProvider: ChatViewProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log("Claude Cook AI Assistant is now active!");

  // Initialize AI service
  aiService = new AIService();

  // Register chat view provider
  chatViewProvider = new ChatViewProvider(context.extensionUri, aiService);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatViewProvider
    )
  );

  // Register commands
  registerCommands(context);

  // Show welcome message on first install
  const hasShownWelcome = context.globalState.get("hasShownWelcome");
  if (!hasShownWelcome) {
    showWelcomeMessage();
    context.globalState.update("hasShownWelcome", true);
  }
}

function registerCommands(context: vscode.ExtensionContext) {
  // Open chat command
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-cook.openChat", () => {
      vscode.commands.executeCommand("claude-cook.chatView.focus");
    })
  );

  // Explain code command
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-cook.explainCode", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage("Please select some code first");
        return;
      }

      const selectedText = editor.document.getText(selection);
      const language = editor.document.languageId;

      await chatViewProvider.addCodeToChat(selectedText, language);

      // Pre-fill with explain prompt
      vscode.commands.executeCommand("claude-cook.chatView.focus");
    })
  );

  // Generate code command
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-cook.generateCode", async () => {
      const prompt = await vscode.window.showInputBox({
        placeHolder: "Describe the code you want to generate...",
        prompt: "What would you like me to create?",
      });

      if (prompt) {
        const editor = vscode.window.activeTextEditor;
        const language = editor?.document.languageId || "javascript";

        const fullPrompt = `Generate ${language} code for: ${prompt}`;

        await chatViewProvider.addCodeToChat("", language);
        vscode.commands.executeCommand("claude-cook.chatView.focus");
      }
    })
  );

  // Fix code command
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-cook.fixCode", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage("Please select some code first");
        return;
      }

      const selectedText = editor.document.getText(selection);
      const language = editor.document.languageId;

      const message = `Please review and improve this code:\n\n\`\`\`${language}\n${selectedText}\n\`\`\`\n\nSuggest improvements for:\n- Bug fixes\n- Performance\n- Code quality\n- Best practices`;

      await chatViewProvider.addCodeToChat(selectedText, language);
      vscode.commands.executeCommand("claude-cook.chatView.focus");
    })
  );

  // Add selection to chat
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-cook.addToChat", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage("Please select some code first");
        return;
      }

      const selectedText = editor.document.getText(selection);
      const language = editor.document.languageId;

      await chatViewProvider.addCodeToChat(selectedText, language);
      vscode.commands.executeCommand("claude-cook.chatView.focus");
    })
  );

  // Clear chat command
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-cook.clearChat", () => {
      chatViewProvider.clearChat();
    })
  );

  // Switch provider command
  context.subscriptions.push(
    vscode.commands.registerCommand("claude-cook.switchProvider", async () => {
      const current = aiService.getCurrentProvider();
      const options = [
        {
          label: "$(robot) Claude",
          description: "Anthropic Claude",
          value: "claude" as const,
        },
        {
          label: "$(comment-discussion) ChatGPT",
          description: "OpenAI GPT",
          value: "openai" as const,
        },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: `Current provider: ${
          current === "claude" ? "Claude" : "ChatGPT"
        }`,
      });

      if (selected) {
        aiService.setProvider(selected.value);
        vscode.window.showInformationMessage(`Switched to ${selected.label}`);
      }
    })
  );

  // Configure API keys command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "claude-cook.configureApiKeys",
      async () => {
        const options = [
          {
            label: "$(key) Configure Anthropic API Key",
            action: "anthropic",
          },
          {
            label: "$(key) Configure OpenAI API Key",
            action: "openai",
          },
          {
            label: "$(settings-gear) Open Settings",
            action: "settings",
          },
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: "Choose an option",
        });

        if (selected) {
          if (selected.action === "settings") {
            await vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "claudeCook"
            );
          } else {
            const config = vscode.workspace.getConfiguration("claudeCook");
            const configKey =
              selected.action === "anthropic"
                ? "anthropicApiKey"
                : "openaiApiKey";

            const apiKey = await vscode.window.showInputBox({
              prompt: `Enter your ${
                selected.action === "anthropic" ? "Anthropic" : "OpenAI"
              } API key`,
              password: true,
              placeHolder: "sk-...",
            });

            if (apiKey) {
              await config.update(
                configKey,
                apiKey,
                vscode.ConfigurationTarget.Global
              );
              vscode.window.showInformationMessage(
                `${
                  selected.action === "anthropic" ? "Anthropic" : "OpenAI"
                } API key saved!`
              );
            }
          }
        }
      }
    )
  );
}

function showWelcomeMessage() {
  const message =
    "Welcome to Claude Cook! Configure your API keys to get started.";
  const configureButton = "Configure API Keys";
  const docsButton = "View Documentation";

  vscode.window
    .showInformationMessage(message, configureButton, docsButton)
    .then((selection) => {
      if (selection === configureButton) {
        vscode.commands.executeCommand("claude-cook.configureApiKeys");
      } else if (selection === docsButton) {
        vscode.env.openExternal(
          vscode.Uri.parse("https://github.com/your-repo/claude-cook")
        );
      }
    });
}

export function deactivate() {
  console.log("Claude Cook AI Assistant deactivated");
}
