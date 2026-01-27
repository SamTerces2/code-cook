// Code Cook - Modern UI JavaScript
// Inspired by Claude/Copilot interface

(function () {
  const vscode = acquireVsCodeApi();

  // DOM Elements
  const elements = {
    messages: document.getElementById("cc-messages"),
    input: document.getElementById("cc-input"),
    sendBtn: document.getElementById("cc-send"),
    clearBtn: document.getElementById("cc-clear"),
    switchBtn: document.getElementById("cc-switch"),
    searchBtn: document.getElementById("cc-search-btn"),
    searchContainer: document.getElementById("cc-search"),
    searchInput: document.getElementById("cc-search-input"),
    searchClose: document.getElementById("cc-search-close"),
    searchCount: document.getElementById("cc-search-count"),
    status: document.getElementById("cc-status"),
    statusIndicator: document.querySelector(".cc-status-indicator"),
    provider: document.getElementById("cc-provider"),
    configure: document.getElementById("cc-configure"),
  };

  // State
  const state = {
    messages: [],
    currentAssistantBubble: null,
    searchMatches: [],
    searchIndex: -1,
    isLoading: false,
  };

  // ==================== UTILITY FUNCTIONS ====================

  function scrollToBottom(smooth = true) {
    requestAnimationFrame(() => {
      elements.messages.scrollTo({
        top: elements.messages.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    });
  }

  function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function processMarkdown(text) {
    if (typeof marked === "undefined") {
      return escapeHtml(text).replace(/\n/g, "<br>");
    }

    marked.setOptions({
      highlight: function (code, lang) {
        if (typeof hljs !== "undefined" && lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.error("Highlight error:", err);
          }
        }
        return escapeHtml(code);
      },
      breaks: true,
      gfm: true,
    });

    return marked.parse(text);
  }

  // ==================== MESSAGE FUNCTIONS ====================

  function createMessage(text, role) {
    // Remove welcome screen
    const welcome = elements.messages.querySelector(".cc-welcome");
    if (welcome) {
      welcome.remove();
    }

    const message = document.createElement("div");
    message.className = `cc-message cc-message-${role}`;
    message.dataset.role = role;
    message.dataset.timestamp = Date.now();

    const avatar = document.createElement("div");
    avatar.className = "cc-message-avatar";
    avatar.textContent = role === "user" ? "👤" : "👨‍🍳";

    const content = document.createElement("div");
    content.className = "cc-message-content";

    const bubble = document.createElement("div");
    bubble.className = "cc-message-bubble";

    if (role === "user") {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = processMarkdown(text);
    }

    const meta = document.createElement("div");
    meta.className = "cc-message-meta";

    const time = document.createElement("span");
    time.className = "cc-message-time";
    time.textContent = formatTime();

    const actions = document.createElement("div");
    actions.className = "cc-message-actions";

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "cc-action-btn";
    copyBtn.innerHTML = "📋 Copy";
    copyBtn.onclick = () => copyMessage(text, copyBtn);
    actions.appendChild(copyBtn);

    // Regenerate button for assistant messages
    if (role === "assistant") {
      const regenBtn = document.createElement("button");
      regenBtn.className = "cc-action-btn";
      regenBtn.innerHTML = "🔄 Regenerate";
      regenBtn.onclick = () => regenerateMessage(message);
      actions.appendChild(regenBtn);
    }

    meta.appendChild(time);
    meta.appendChild(actions);

    content.appendChild(bubble);
    content.appendChild(meta);

    message.appendChild(avatar);
    message.appendChild(content);

    elements.messages.appendChild(message);

    state.messages.push({
      text,
      role,
      element: message,
      bubble,
    });

    scrollToBottom();

    return { message, bubble, content };
  }

  function copyMessage(text, button) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const originalHtml = button.innerHTML;
        button.innerHTML = "✓ Copied";
        button.classList.add("success");

        setTimeout(() => {
          button.innerHTML = originalHtml;
          button.classList.remove("success");
        }, 2000);
      })
      .catch((err) => {
        console.error("Copy failed:", err);
        setStatus("Failed to copy");
      });
  }

  function regenerateMessage(messageElement) {
    const index = state.messages.findIndex((m) => m.element === messageElement);
    if (index > 0 && state.messages[index - 1].role === "user") {
      const userMessage = state.messages[index - 1].text;

      // Remove assistant message
      messageElement.remove();
      state.messages.splice(index, 1);

      // Resend
      vscode.postMessage({
        type: "sendMessage",
        message: userMessage,
      });

      setLoading(true);
    }
  }

  function startAssistantMessage() {
    const msg = createMessage("", "assistant");
    state.currentAssistantBubble = msg.bubble;

    // Show typing indicator
    msg.bubble.innerHTML = `
      <div class="cc-typing">
        <div class="cc-typing-dot"></div>
        <div class="cc-typing-dot"></div>
        <div class="cc-typing-dot"></div>
      </div>
    `;

    return msg;
  }

  function appendToAssistant(chunk) {
    if (!state.currentAssistantBubble) {
      startAssistantMessage();
    }

    // Get current text content
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant") {
      lastMsg.text += chunk;
      state.currentAssistantBubble.innerHTML = processMarkdown(lastMsg.text);
    }

    scrollToBottom();
  }

  function clearMessages() {
    elements.messages.innerHTML = `
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
    `;

    state.messages = [];
    state.currentAssistantBubble = null;
    clearSearch();
  }

  // ==================== SEARCH FUNCTIONS ====================

  function toggleSearch() {
    const isActive = elements.searchContainer.classList.toggle("active");
    if (isActive) {
      elements.searchInput.focus();
    } else {
      elements.searchInput.value = "";
      clearSearch();
    }
  }

  function performSearch() {
    const query = elements.searchInput.value.toLowerCase().trim();

    clearSearch();

    if (!query) {
      elements.searchCount.textContent = "";
      return;
    }

    state.messages.forEach((msg, idx) => {
      if (msg.text.toLowerCase().includes(query)) {
        state.searchMatches.push(idx);
        msg.element.classList.add("cc-search-highlight");
      }
    });

    if (state.searchMatches.length > 0) {
      elements.searchCount.textContent = `${state.searchMatches.length}`;
      state.searchIndex = 0;
      highlightSearchMatch(0);
    } else {
      elements.searchCount.textContent = "0";
    }
  }

  function highlightSearchMatch(index) {
    // Remove active class from all
    state.messages.forEach((msg) => {
      msg.element.classList.remove("active");
    });

    if (state.searchMatches.length === 0) return;

    const msgIndex = state.searchMatches[index];
    const element = state.messages[msgIndex].element;
    element.classList.add("active");
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearSearch() {
    state.messages.forEach((msg) => {
      msg.element.classList.remove("cc-search-highlight", "active");
    });
    state.searchMatches = [];
    state.searchIndex = -1;
  }

  // ==================== UI STATE FUNCTIONS ====================

  function setLoading(loading) {
    state.isLoading = loading;

    if (loading) {
      elements.sendBtn.disabled = true;
      elements.input.disabled = true;
      elements.sendBtn.classList.add("loading");
      elements.statusIndicator.classList.add("active");
      setStatus("Thinking...");
    } else {
      elements.sendBtn.disabled = false;
      elements.input.disabled = false;
      elements.sendBtn.classList.remove("loading");
      elements.statusIndicator.classList.remove("active");
      setStatus("Ready");
      state.currentAssistantBubble = null;
    }
  }

  function setStatus(text) {
    elements.status.textContent = text;
  }

  function updateProvider(provider, model) {
    const providerText = elements.provider.querySelector("span:last-child");
    if (providerText) {
      providerText.textContent = `${provider} · ${model}`;
    }
  }

  // ==================== INPUT FUNCTIONS ====================

  function sendMessage() {
    const text = elements.input.value.trim();
    if (!text || state.isLoading) return;

    vscode.postMessage({
      type: "sendMessage",
      message: text,
    });

    elements.input.value = "";
    autoResize();
    setLoading(true);
  }

  function autoResize() {
    elements.input.style.height = "auto";
    const newHeight = Math.min(elements.input.scrollHeight, 120);
    elements.input.style.height = newHeight + "px";
  }

  // ==================== EVENT LISTENERS ====================

  // Send button
  elements.sendBtn.addEventListener("click", sendMessage);

  // Input
  elements.input.addEventListener("input", autoResize);

  elements.input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  // Clear button
  elements.clearBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "clearChat" });
  });

  // Switch button
  elements.switchBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "switchProvider" });
  });

  // Configure button
  elements.configure.addEventListener("click", () => {
    vscode.postMessage({ type: "configureKeys" });
  });

  // Search
  elements.searchBtn.addEventListener("click", toggleSearch);

  elements.searchClose.addEventListener("click", () => {
    elements.searchContainer.classList.remove("active");
    clearSearch();
  });

  elements.searchInput.addEventListener("input", performSearch);

  elements.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      elements.searchContainer.classList.remove("active");
      clearSearch();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (state.searchMatches.length > 0) {
        state.searchIndex = (state.searchIndex + 1) % state.searchMatches.length;
        highlightSearchMatch(state.searchIndex);
      }
    }
  });

  // ==================== MESSAGE HANDLER ====================

  window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
      case "userMessage":
        createMessage(message.message, "user");
        break;

      case "streamChunk":
        appendToAssistant(message.chunk);
        break;

      case "startLoading":
        setLoading(true);
        startAssistantMessage();
        break;

      case "stopLoading":
        setLoading(false);
        break;

      case "clearMessages":
        clearMessages();
        break;

      case "updateProvider":
        if (message.provider && message.model) {
          updateProvider(message.provider, message.model);
        }
        break;

      case "error":
        setLoading(false);
        setStatus("Error occurred");

        const errorMsg = createMessage(
          `⚠️ Error: ${message.message || "Something went wrong. Please try again."}`,
          "assistant"
        );
        errorMsg.bubble.style.borderColor = "var(--error)";
        errorMsg.bubble.style.background = "rgba(248, 113, 113, 0.05)";
        break;

      case "prefillMessage":
        elements.input.value = message.message || "";
        autoResize();
        elements.input.focus();
        break;
    }
  });

  // ==================== INITIALIZATION ====================

  // Focus input on load
  elements.input.focus();

  // Set initial status
  setStatus("Ready");

  console.log("🍳 Code Cook initialized with modern UI");
})();
