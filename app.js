/* ============================================
   Phoenix AI — Application Logic
   Ollama-powered chatbot with context memory
   ============================================ */

(() => {
  'use strict';

  // ── Config ──────────────────────────────────
  const OLLAMA_BASE = 'http://localhost:11434';
  const OLLAMA_CHAT_URL = `${OLLAMA_BASE}/api/chat`;
  const MAX_CONTEXT_MESSAGES = 30; // keep last N messages for context
  const STORAGE_KEY_MESSAGES = 'phoenix_ai_messages';
  const STORAGE_KEY_MODEL = 'phoenix_ai_model';
  const DEFAULT_MODEL = 'llama3.2';

  const SYSTEM_PROMPT = {
    role: 'system',
    content: `You are Phoenix AI, a helpful, friendly, and knowledgeable personal assistant. You are warm and conversational while being precise and thorough. You remember context from the current conversation and refer back to it naturally. When writing code, use proper formatting with code blocks. Keep responses concise unless the user asks for detailed explanations.`
  };

  // ── DOM Elements ────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const chatMessages = $('#chat-messages');
  const chatContainer = $('#chat-container');
  const chatInput = $('#chat-input');
  const sendBtn = $('#send-btn');
  const clearBtn = $('#clear-btn');
  const modelBtn = $('#model-btn');
  const currentModelLabel = $('#current-model-label');
  const welcomeScreen = $('#welcome-screen');
  const modelModal = $('#model-modal');
  const modelInput = $('#model-input');
  const modelSaveBtn = $('#model-save-btn');
  const modelError = $('#model-error');
  const connectionModal = $('#connection-modal');
  const retryConnectionBtn = $('#retry-connection-btn');
  const errorToast = $('#error-toast');

  // ── State ───────────────────────────────────
  let messages = []; // { role, content }
  let currentModel = DEFAULT_MODEL;
  let isGenerating = false;
  let currentAbortController = null;

  // ── Initialization ──────────────────────────
  function init() {
    loadState();
    renderMessages();
    updateModelLabel();
    bindEvents();
    checkOllamaConnection();
  }

  function loadState() {
    try {
      const savedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (savedMessages) {
        messages = JSON.parse(savedMessages);
      }
      const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);
      if (savedModel) {
        currentModel = savedModel;
      }
    } catch (e) {
      console.warn('Failed to load saved state:', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      localStorage.setItem(STORAGE_KEY_MODEL, currentModel);
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }

  // ── Ollama Connection Check ─────────────────
  async function checkOllamaConnection() {
    try {
      const res = await fetch(OLLAMA_BASE, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        connectionModal.classList.add('hidden');
        return true;
      }
    } catch (e) {
      // Connection failed
    }
    connectionModal.classList.remove('hidden');
    return false;
  }

  // ── Event Bindings ──────────────────────────
  function bindEvents() {
    // Send message
    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
      sendBtn.disabled = !chatInput.value.trim() || isGenerating;
    });

    // Clear chat
    clearBtn.addEventListener('click', handleClear);

    // Model modal
    modelBtn.addEventListener('click', () => {
      modelInput.value = currentModel;
      modelError.classList.remove('visible');
      modelModal.classList.remove('hidden');
      modelInput.focus();
    });

    modelSaveBtn.addEventListener('click', handleModelSave);
    modelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleModelSave();
    });

    // Close modals on overlay click
    modelModal.addEventListener('click', (e) => {
      if (e.target === modelModal) modelModal.classList.add('hidden');
    });

    // Retry connection
    retryConnectionBtn.addEventListener('click', async () => {
      retryConnectionBtn.textContent = 'Connecting...';
      const ok = await checkOllamaConnection();
      retryConnectionBtn.textContent = ok ? 'Connected!' : 'Retry Connection';
      if (!ok) showToast('Still can\'t reach Ollama. Make sure it\'s running.');
    });

    // Suggestion cards
    document.querySelectorAll('.suggestion-card').forEach((card) => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          chatInput.value = prompt;
          chatInput.dispatchEvent(new Event('input'));
          handleSend();
        }
      });
    });
  }

  // ── Send Message ────────────────────────────
  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || isGenerating) return;

    // Hide welcome screen
    if (welcomeScreen) {
      welcomeScreen.style.display = 'none';
    }

    // Add user message
    const userMsg = { role: 'user', content: text };
    messages.push(userMsg);
    appendMessageToDOM(userMsg);
    saveState();

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Scroll to bottom
    scrollToBottom();

    // Show typing indicator
    const typingEl = showTypingIndicator();

    // Generate response
    isGenerating = true;
    try {
      const assistantContent = await streamResponse();
      // Remove typing indicator
      typingEl.remove();

      // Add assistant message
      const assistantMsg = { role: 'assistant', content: assistantContent };
      messages.push(assistantMsg);
      appendMessageToDOM(assistantMsg);
      saveState();
    } catch (err) {
      typingEl.remove();
      if (err.name === 'AbortError') {
        // User cancelled — do nothing
      } else {
        console.error('Generation error:', err);
        showToast(getErrorMessage(err));
        // Add error as a system message visually
        const errorMsg = { role: 'assistant', content: `⚠️ **Error:** ${getErrorMessage(err)}` };
        appendMessageToDOM(errorMsg);
      }
    } finally {
      isGenerating = false;
      sendBtn.disabled = !chatInput.value.trim();
      currentAbortController = null;
    }

    scrollToBottom();
  }

  // ── Stream Response from Ollama ─────────────
  async function streamResponse() {
    currentAbortController = new AbortController();

    // Build context: system prompt + last N messages
    const contextMessages = [
      SYSTEM_PROMPT,
      ...messages.slice(-MAX_CONTEXT_MESSAGES)
    ];

    const res = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: currentAbortController.signal,
      body: JSON.stringify({
        model: currentModel,
        messages: contextMessages,
        stream: true
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 404) {
        throw new Error(`Model "${currentModel}" not found. Run: ollama pull ${currentModel}`);
      }
      throw new Error(`Ollama returned ${res.status}: ${errBody || 'Unknown error'}`);
    }

    // Read streaming response
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let streamBubble = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            fullContent += json.message.content;

            // Create or update the streaming bubble
            if (!streamBubble) {
              // Remove typing indicator and create assistant bubble
              const typingEl = chatMessages.querySelector('.typing-indicator');
              if (typingEl) typingEl.remove();
              streamBubble = createStreamBubble();
            }
            updateStreamBubble(streamBubble, fullContent);
            scrollToBottom();
          }
        } catch (e) {
          // Skip malformed JSON lines
        }
      }
    }

    // If we got a stream bubble, remove it (we'll add the final message via appendMessageToDOM)
    if (streamBubble) {
      streamBubble.remove();
    }

    return fullContent;
  }

  // ── Create streaming bubble ─────────────────
  function createStreamBubble() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message assistant streaming';
    wrapper.innerHTML = `
      <div class="message-avatar">🔥</div>
      <div class="message-content"></div>
    `;
    chatMessages.appendChild(wrapper);
    return wrapper;
  }

  function updateStreamBubble(bubble, content) {
    const contentEl = bubble.querySelector('.message-content');
    contentEl.innerHTML = renderMarkdown(content);
  }

  // ── DOM Rendering ───────────────────────────
  function renderMessages() {
    // Clear all except welcome screen
    const welcome = welcomeScreen;
    chatMessages.innerHTML = '';
    if (welcome) chatMessages.appendChild(welcome);

    if (messages.length === 0) {
      if (welcome) welcome.style.display = '';
    } else {
      if (welcome) welcome.style.display = 'none';
      messages.forEach((msg) => appendMessageToDOM(msg, false));
    }
    scrollToBottom();
  }

  function appendMessageToDOM(msg, animate = true) {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    if (!animate) div.style.animation = 'none';

    const avatar = msg.role === 'user' ? '👤' : '🔥';
    div.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">${renderMarkdown(msg.content)}</div>
    `;
    chatMessages.appendChild(div);
  }

  function showTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.innerHTML = `
      <div class="message-avatar">🔥</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
  }

  // ── Markdown Renderer (lightweight) ─────────
  function renderMarkdown(text) {
    if (!text) return '';

    let html = escapeHtml(text);

    // Code blocks (```...```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^[\s]*[-•]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Line breaks → paragraphs
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n/g, '<br/>');
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    // Don't wrap pre blocks in paragraphs
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');

    return html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Clear Chat ──────────────────────────────
  function handleClear() {
    if (isGenerating) {
      if (currentAbortController) currentAbortController.abort();
    }
    messages = [];
    saveState();
    renderMessages();
  }

  // ── Model Management ────────────────────────
  function handleModelSave() {
    const name = modelInput.value.trim();
    if (!name) {
      modelError.textContent = 'Please enter a model name.';
      modelError.classList.add('visible');
      return;
    }
    currentModel = name;
    saveState();
    updateModelLabel();
    modelModal.classList.add('hidden');
    showToast(`Model switched to "${currentModel}"`, 'success');
  }

  function updateModelLabel() {
    currentModelLabel.textContent = currentModel;
  }

  // ── Toast Notifications ─────────────────────
  function showToast(message, type = 'error') {
    errorToast.textContent = message;
    errorToast.style.borderColor = type === 'success'
      ? 'rgba(34, 197, 94, 0.3)'
      : 'rgba(239, 68, 68, 0.3)';
    errorToast.style.color = type === 'success' ? '#22c55e' : '#ef4444';
    errorToast.style.background = type === 'success'
      ? 'rgba(34, 197, 94, 0.12)'
      : 'rgba(239, 68, 68, 0.12)';
    errorToast.classList.add('visible');

    setTimeout(() => {
      errorToast.classList.remove('visible');
    }, 4000);
  }

  // ── Error Messages ──────────────────────────
  function getErrorMessage(err) {
    const msg = err.message || String(err);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return 'Can\'t connect to Ollama. Make sure it\'s running on localhost:11434';
    }
    if (msg.includes('not found')) {
      return msg;
    }
    return msg;
  }

  // ── Start ───────────────────────────────────
  init();
})();
