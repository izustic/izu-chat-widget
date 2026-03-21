// components/ChatWidget.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, ChevronDown } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ClientConfig {
  name: string;
  greeting: string;
  primary_color: string;
  assistant_label: string;
  suggested_prompts?: string[];
}

interface Props {
  apiUrl: string;
  clientId: string;
}

// ── Default config (fallback if /config fetch fails) ──────────────────────────

const DEFAULT_CONFIG: ClientConfig = {
  name: "Assistant",
  greeting: "Hi! How can I help you today?",
  primary_color: "#6366f1",
  assistant_label: "AI Assistant",
  suggested_prompts: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// ── Scoped styles injected into <head> ────────────────────────────────────────
// All classes are namespaced with .izu-widget__ to avoid clashing with
// the client's existing CSS.

function injectStyles(primaryColor: string) {
  const existing = document.getElementById("izu-widget-styles");
  if (existing) existing.remove();

  const rgb = hexToRgb(primaryColor);

  const css = `
    #izu-chat-root * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .izu-widget__bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${primaryColor};
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(${rgb}, 0.4);
      transition: transform 0.3s ease, opacity 0.3s ease, background 0.2s;
    }
    .izu-widget__bubble:hover {
      background: color-mix(in srgb, ${primaryColor} 85%, black);
    }
    .izu-widget__bubble:active {
      transform: scale(0.94);
    }
    .izu-widget__bubble--hidden {
      transform: scale(0);
      opacity: 0;
      pointer-events: none;
    }

    .izu-widget__unread {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      background: #ef4444;
      border-radius: 50%;
      border: 2px solid #fff;
    }

    .izu-widget__panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      width: 360px;
      max-width: calc(100vw - 2rem);
      height: 520px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      transform-origin: bottom right;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    .izu-widget__panel--hidden {
      transform: scale(0.75);
      opacity: 0;
      pointer-events: none;
    }

    @media (prefers-color-scheme: dark) {
      .izu-widget__panel {
        background: #0f172a;
        border-color: #334155;
      }
    }

    .izu-widget__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: ${primaryColor};
      color: #fff;
      flex-shrink: 0;
    }

    .izu-widget__header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .izu-widget__avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .izu-widget__header-name {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
    }

    .izu-widget__header-status {
      font-size: 11px;
      opacity: 0.85;
      display: flex;
      align-items: center;
      gap: 4px;
      line-height: 1.2;
    }

    .izu-widget__status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #86efac;
      display: inline-block;
    }

    .izu-widget__close {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .izu-widget__close:hover {
      background: rgba(255,255,255,0.25);
    }

    .izu-widget__messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      scroll-behavior: smooth;
    }

    .izu-widget__messages::-webkit-scrollbar {
      width: 4px;
    }
    .izu-widget__messages::-webkit-scrollbar-track {
      background: transparent;
    }
    .izu-widget__messages::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 2px;
    }

    .izu-widget__msg-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    .izu-widget__msg-row--user {
      flex-direction: row-reverse;
    }

    .izu-widget__msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .izu-widget__msg-avatar--user {
      background: ${primaryColor};
      color: #fff;
    }
    .izu-widget__msg-avatar--bot {
      background: #e2e8f0;
      color: ${primaryColor};
    }
    @media (prefers-color-scheme: dark) {
      .izu-widget__msg-avatar--bot {
        background: #334155;
      }
    }

    .izu-widget__msg-body {
      max-width: 78%;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .izu-widget__msg-body--user {
      align-items: flex-end;
    }
    .izu-widget__msg-body--bot {
      align-items: flex-start;
    }

    .izu-widget__bubble-text {
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.5;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      word-break: break-word;
    }
    .izu-widget__bubble-text--user {
      background: ${primaryColor};
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .izu-widget__bubble-text--bot {
      background: #fff;
      color: #334155;
      border: 1px solid #e2e8f0;
      border-bottom-left-radius: 4px;
    }
    @media (prefers-color-scheme: dark) {
      .izu-widget__bubble-text--bot {
        background: #1e293b;
        color: #e2e8f0;
        border-color: #334155;
      }
    }

    .izu-widget__timestamp {
      font-size: 10px;
      color: #94a3b8;
      padding: 0 4px;
    }

    .izu-widget__typing-dots {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 0;
    }
    .izu-widget__typing-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${primaryColor};
      animation: izu-bounce 0.9s infinite;
    }
    .izu-widget__typing-dots span:nth-child(2) { animation-delay: 0.15s; }
    .izu-widget__typing-dots span:nth-child(3) { animation-delay: 0.30s; }

    @keyframes izu-bounce {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-4px); }
    }

    .izu-widget__suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding-top: 4px;
    }

    .izu-widget__suggestion {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid #e2e8f0;
      color: ${primaryColor};
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .izu-widget__suggestion:hover {
      background: rgba(${rgb}, 0.06);
      border-color: ${primaryColor};
    }
    @media (prefers-color-scheme: dark) {
      .izu-widget__suggestion {
        background: #1e293b;
        border-color: #334155;
        color: ${primaryColor};
      }
      .izu-widget__suggestion:hover {
        background: rgba(${rgb}, 0.12);
      }
    }

    .izu-widget__scroll-btn {
      position: absolute;
      bottom: 80px;
      right: 16px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #fff;
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #64748b;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: color 0.15s;
      z-index: 10;
    }
    .izu-widget__scroll-btn:hover {
      color: ${primaryColor};
    }
    @media (prefers-color-scheme: dark) {
      .izu-widget__scroll-btn {
        background: #1e293b;
        border-color: #334155;
      }
    }

    .izu-widget__input-row {
      flex-shrink: 0;
      padding: 12px;
      border-top: 1px solid #e2e8f0;
      background: #fff;
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    @media (prefers-color-scheme: dark) {
      .izu-widget__input-row {
        background: #0f172a;
        border-top-color: #334155;
      }
    }

    .izu-widget__textarea {
      flex: 1;
      resize: none;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      outline: none;
      line-height: 1.5;
      max-height: 120px;
      overflow-y: auto;
      transition: border-color 0.15s, box-shadow 0.15s;
      font-family: inherit;
    }
    .izu-widget__textarea::placeholder {
      color: #94a3b8;
    }
    .izu-widget__textarea:focus {
      border-color: ${primaryColor};
      box-shadow: 0 0 0 3px rgba(${rgb}, 0.12);
    }
    .izu-widget__textarea:disabled {
      opacity: 0.5;
    }
    @media (prefers-color-scheme: dark) {
      .izu-widget__textarea {
        background: #1e293b;
        border-color: #334155;
        color: #e2e8f0;
      }
    }

    .izu-widget__send {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: ${primaryColor};
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.1s;
      box-shadow: 0 2px 8px rgba(${rgb}, 0.3);
    }
    .izu-widget__send:hover {
      background: color-mix(in srgb, ${primaryColor} 85%, black);
    }
    .izu-widget__send:active {
      transform: scale(0.94);
    }
    .izu-widget__send:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }
  `;

  const style = document.createElement("style");
  style.id = "izu-widget-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="izu-widget__typing-dots">
      <span /><span /><span />
    </div>
  );
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`izu-widget__msg-row ${isUser ? "izu-widget__msg-row--user" : ""}`}>
      <div className={`izu-widget__msg-avatar ${isUser ? "izu-widget__msg-avatar--user" : "izu-widget__msg-avatar--bot"}`}>
        {isUser
          ? <User size={13} />
          : <Bot size={13} />
        }
      </div>
      <div className={`izu-widget__msg-body ${isUser ? "izu-widget__msg-body--user" : "izu-widget__msg-body--bot"}`}>
        <div className={`izu-widget__bubble-text ${isUser ? "izu-widget__bubble-text--user" : "izu-widget__bubble-text--bot"}`}>
          {msg.isStreaming ? <TypingDots /> : msg.content}
        </div>
        <span className="izu-widget__timestamp">{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatWidget({ apiUrl, clientId }: Props) {
  const [config, setConfig] = useState<ClientConfig>(DEFAULT_CONFIG);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const historyRef = useRef<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch client config on mount ───────────────────────────────────────────

  useEffect(() => {
    fetch(`${apiUrl}/config/${clientId}`)
      .then(r => r.json())
      .then((data: ClientConfig) => setConfig({ ...DEFAULT_CONFIG, ...data }))
      .catch(() => setConfig(DEFAULT_CONFIG));
  }, [apiUrl, clientId]);

  // ── Inject styles whenever primary colour changes ──────────────────────────

  useEffect(() => {
    injectStyles(config.primary_color);
  }, [config.primary_color]);

  // ── Warm up the backend on mount ──────────────────────────────────────────

  useEffect(() => {
    fetch(`${apiUrl}/health`).catch(() => {});
  }, [apiUrl]);

  // ── Scroll helpers ─────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false);
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen) scrollToBottom();
    else if (messages.length > 0) setHasUnread(true);
  }, [messages, isOpen, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
  };

  // ── Welcome message on first open ─────────────────────────────────────────

  useEffect(() => {
    if (isOpen && messages.length === 0 && config.greeting) {
      setMessages([{
        id: generateId(),
        role: "assistant",
        content: config.greeting,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, messages.length, config.greeting]);

  // ── Send logic ─────────────────────────────────────────────────────────────

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: DisplayMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const loadingMsg: DisplayMessage = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          message: trimmed,
          history: historyRef.current,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const reply: string = data.reply;

      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: trimmed },
        { role: "assistant", content: reply },
      ];

      setMessages(prev =>
        prev.map(m => m.id === loadingMsg.id
          ? { ...m, content: reply, isStreaming: false }
          : m
        )
      );
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === loadingMsg.id
          ? { ...m, content: "Sorry, something went wrong. Please try again.", isStreaming: false }
          : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, clientId, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const showSuggestions =
    messages.length <= 1 &&
    !isLoading &&
    (config.suggested_prompts?.length ?? 0) > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating bubble */}
      <button
        className={`izu-widget__bubble ${isOpen ? "izu-widget__bubble--hidden" : ""}`}
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
      >
        <MessageCircle size={24} />
        {hasUnread && <span className="izu-widget__unread" />}
      </button>

      {/* Chat panel */}
      <div className={`izu-widget__panel ${isOpen ? "" : "izu-widget__panel--hidden"}`}>

        {/* Header */}
        <div className="izu-widget__header">
          <div className="izu-widget__header-left">
            <div className="izu-widget__avatar">
              <Bot size={16} />
            </div>
            <div>
              <div className="izu-widget__header-name">{config.assistant_label}</div>
              <div className="izu-widget__header-status">
                <span className="izu-widget__status-dot" />
                Online
              </div>
            </div>
          </div>
          <button
            className="izu-widget__close"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div
          className="izu-widget__messages"
          ref={scrollRef}
          onScroll={handleScroll}
        >
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {showSuggestions && (
            <div className="izu-widget__suggestions">
              {config.suggested_prompts!.map(prompt => (
                <button
                  key={prompt}
                  className="izu-widget__suggestion"
                  onClick={() => send(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            className="izu-widget__scroll-btn"
            onClick={() => scrollToBottom()}
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={14} />
          </button>
        )}

        {/* Input */}
        <form className="izu-widget__input-row" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="izu-widget__textarea"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="izu-widget__send"
            disabled={!input.trim() || isLoading}
            aria-label="Send"
          >
            {isLoading
              ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              : <Send size={16} />
            }
          </button>
        </form>
      </div>

      {/* Spin keyframe for loader */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}