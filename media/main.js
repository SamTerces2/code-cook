// media/main.js

(function () {
  const vscode = acquireVsCodeApi();

  // Build UI structure
  document.body.innerHTML = `
    <div class="cc-root">
      <header class="cc-header">
        <div class="cc-header-left">
          <div class="cc-title">CODE COOK</div>
          <div class="cc-subtitle">AI Assistant for VS Code</div>
        </div>
        <div class="cc-header-right">
          <span id="cc-provider-pill" class="cc-provider-pill">Loading model...</span>
          <button id="cc-switch-provider" class="cc-ghost-button" title="Switch Model">
            Switch
          </button>
          <button id="cc-clear" class="cc-ghost-button">
            Clear
          </button>
        </div>
      </header>

      <main id="cc-messages" class="cc-messages"></main>

      <footer class="cc-footer">
        <div class="cc-input-wrapper">
          <textarea
            id="cc-input"
            class="cc-input"
            rows="1"
            placeholder="Ask Code Cook anything about your code..."
          ></textarea>
        </div>
       <button id="cc-send" class="cc-primary-button">
  <span class="cc-send-label">Send</span>
  <span class="cc-send-loader hidden">
    <span class="cc-dot"></span>
    <span class="cc-dot"></span>
    <span class="cc-dot"></span>
  </span>
</button>

      </footer>

      <div class="cc-status-bar">
        <span id="cc-status">Ready</span>
        <button id="cc-configure" class="cc-link-button">API & Settings…</button>
      </div>
    </div>
  `;

  const messagesEl = document.getElementById("cc-messages");
  const inputEl = document.getElementById("cc-input");
  const sendBtn = document.getElementById("cc-send");
  const clearBtn = document.getElementById("cc-clear");
  const statusEl = document.getElementById("cc-status");
  const switchProviderBtn = document.getElementById("cc-switch-provider");
  const providerPill = document.getElementById("cc-provider-pill");
  const configureBtn = document.getElementById("cc-configure");

  let currentAssistantBubble = null;

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function createMessageBubble(text, role) {
    const wrapper = document.createElement("div");
    wrapper.className =
      "cc-message-row " +
      (role === "user" ? "cc-message-row-user" : "cc-message-row-assistant");

    const bubble = document.createElement("div");
    bubble.className =
      "cc-bubble " +
      (role === "user" ? "cc-bubble-user" : "cc-bubble-assistant");

    const pre = document.createElement("pre");
    pre.className = "cc-bubble-text";
    pre.textContent = text;

    bubble.appendChild(pre);
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
    return { wrapper, bubble, pre };
  }

  function showUserMessage(text) {
    createMessageBubble(text, "user");
  }

  function startAssistantMessage() {
    const bubbleObj = createMessageBubble("", "assistant");
    currentAssistantBubble = bubbleObj.pre;
  }

  function appendAssistantChunk(chunk) {
    if (!currentAssistantBubble) {
      startAssistantMessage();
    }
    currentAssistantBubble.textContent += chunk;
    scrollToBottom();
  }

  function clearMessages() {
    messagesEl.innerHTML = "";
    currentAssistantBubble = null;
  }

  function setLoading(isLoading) {
    if (isLoading) {
      statusEl.textContent = "Thinking…";
      sendBtn.disabled = true;

      sendBtn.classList.add("loading");
      sendBtn.querySelector(".cc-send-loader").classList.remove("hidden");
      sendBtn.querySelector(".cc-send-label").classList.add("hidden");
    } else {
      statusEl.textContent = "Ready";
      sendBtn.disabled = false;

      sendBtn.classList.remove("loading");
      sendBtn.querySelector(".cc-send-loader").classList.add("hidden");
      sendBtn.querySelector(".cc-send-label").classList.remove("hidden");
    }
  }

  function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    vscode.postMessage({
      type: "sendMessage",
      message: text,
    });

    // Important: DO NOT add the bubble here.
    // We'll render it only when the extension sends "userMessage".
    inputEl.value = "";
    inputEl.rows = 1;
    setLoading(true);
  }

  // --- Event wiring ---

  sendBtn.addEventListener("click", () => {
    sendMessage();
  });

  inputEl.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
      return;
    }

    // Auto-resize
    setTimeout(() => {
      inputEl.style.height = "auto";
      inputEl.style.height = inputEl.scrollHeight + "px";
    }, 0);
  });

  clearBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "clearChat" });
  });

  switchProviderBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "switchProvider" });
  });

  configureBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "configureKeys" });
  });

  // --- Messages from extension ---

  window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
      case "userMessage":
        showUserMessage(message.message);
        break;

      case "streamChunk":
        appendAssistantChunk(message.chunk);
        break;

      case "startLoading":
        setLoading(true);
        currentAssistantBubble = null;
        break;

      case "stopLoading":
        setLoading(false);
        break;

      case "clearMessages":
        clearMessages();
        break;

      case "updateProvider":
        if (message.provider && message.model) {
          providerPill.textContent = `${message.provider} · ${message.model}`;
        }
        break;

      case "error":
        setLoading(false);
        statusEl.textContent = "Error: " + (message.message || "Unknown");
        break;

      case "prefillMessage":
        inputEl.value = message.message || "";
        inputEl.focus();
        break;

      default:
        break;
    }
  });
})();
