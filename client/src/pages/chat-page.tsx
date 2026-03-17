import { useState, useRef, useEffect, useCallback } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  PaperPlaneRight,
  ClockCounterClockwise,
  Plus,
  X,
} from "@phosphor-icons/react";

interface UiMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
}

interface ConversationSummary {
  readonly id: string;
  readonly title: string | null;
  readonly preview: string | null;
  readonly messageCount: number;
  readonly orchestratorSessionId: string | null;
  readonly orchestratorConversationId: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl bg-white/70 px-4 py-2.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-brand-teal/60"
            animate={{ y: [0, -6, 0] }}
            transition={{
              repeat: Infinity,
              duration: 0.8,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function formatConvDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "/dashboard";
  }
}

export default function ChatPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialQuery = params.get("q");

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [dbConversationId, setDbConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [initialSent, setInitialSent] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversations, refetch: refetchConversations } = useQuery<ConversationSummary[]>({
    queryKey: ["/api/chat/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/chat/conversations", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !containerRef.current) return;

    function onResize() {
      if (!containerRef.current || !vv) return;
      const offsetTop = vv.offsetTop;
      containerRef.current.style.height = `${vv.height}px`;
      containerRef.current.style.transform = `translateY(${offsetTop}px)`;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: UiMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            sessionId: sessionId ?? undefined,
            conversationId: conversationId ?? undefined,
            dbConversationId: dbConversationId ?? undefined,
          }),
          credentials: "include",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          reply?: string;
          session_id?: string | null;
          conversation_id?: string | null;
          db_conversation_id?: string | null;
        };

        if (data.session_id) setSessionId(data.session_id);
        if (data.conversation_id) setConversationId(data.conversation_id);
        if (data.db_conversation_id) setDbConversationId(data.db_conversation_id);

        const reply =
          data.reply ?? "Desculpe, não consegui processar sua mensagem.";
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: reply },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Erro de conexão. Se precisar de apoio imediato, ligue para o CVV: 188.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, sessionId, conversationId, dbConversationId],
  );

  useEffect(() => {
    if (initialQuery && !initialSent) {
      setInitialSent(true);
      window.history.replaceState({}, "", "/chat");
      sendMessage(initialQuery);
    }
  }, [initialQuery, initialSent, sendMessage]);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setConversationId(null);
    setDbConversationId(null);
    setShowHistory(false);
    setInput("");
    refetchConversations();
    inputRef.current?.focus();
  }, [refetchConversations]);

  const loadConversation = useCallback(
    async (conv: ConversationSummary) => {
      setShowHistory(false);
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/conversations/${conv.id}/messages`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as {
          conversation: {
            orchestratorSessionId: string | null;
            orchestratorConversationId: string | null;
          };
          messages: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
          }>;
        };
        setMessages(data.messages);
        setSessionId(data.conversation.orchestratorSessionId);
        setConversationId(data.conversation.orchestratorConversationId);
        setDbConversationId(conv.id);
      } catch {
        setMessages([
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Não foi possível carregar essa conversa.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const hasMessages = messages.length > 0;

  return (
    <div ref={containerRef} className="fixed inset-0 flex flex-col bg-gradient-to-b from-sky-50/80 via-white to-sky-50/40" style={{ height: "100dvh" }}>
      <header className="relative z-10 flex items-center gap-3 border-b border-border/30 bg-white/80 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" weight="bold" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <img
            src="/juphd-avatar.png"
            alt="JuPHD Care"
            className="h-8 w-8 rounded-full object-cover object-top"
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground truncate">
                JuPHD Care
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-score-good/12 px-2 py-0.5 text-[10px] font-medium text-score-good">
                <span className="h-1.5 w-1.5 rounded-full bg-score-good" />
                Online
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              IA especializada em Saúde Psicossocial
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              refetchConversations();
              setShowHistory((v) => !v);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Conversas anteriores"
          >
            <ClockCounterClockwise className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={startNewConversation}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Nova conversa"
          >
            <Plus className="h-5 w-5" weight="bold" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-x-0 top-[60px] z-20 mx-auto max-w-lg border-b border-border/30 bg-white/95 shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-sm font-semibold text-foreground">
                Conversas anteriores
              </span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto px-2 pb-2">
              {(!conversations || conversations.length === 0) ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Nenhuma conversa anterior
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => loadConversation(conv)}
                    className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-teal/5"
                  >
                    <p className="text-sm font-medium text-foreground truncate">
                      {conv.title || "Conversa"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {conv.preview || "..."}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      {formatConvDate(conv.updatedAt)} · {conv.messageCount} mensagens
                    </p>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mx-auto mt-2 text-center text-[10px] text-muted-foreground/50">
        Conversa confidencial · Nada chega ao RH sem sua autorização
      </p>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto max-w-lg space-y-3">
          {!hasMessages && !loading && (
            <div className="flex flex-col items-center gap-4 pt-16 text-center">
              <img
                src="/juphd-avatar.png"
                alt="JuPHD Care"
                className="h-16 w-16 rounded-full object-cover object-top opacity-80"
              />
              <div>
                <p className="text-base font-semibold text-foreground/80">
                  Como posso ajudar?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dúvidas sobre saúde mental, riscos psicossociais, ou
                  simplesmente conversar. Estou aqui.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <img
                  src="/juphd-avatar.png"
                  alt=""
                  className="mr-2 mt-1 h-7 w-7 flex-shrink-0 rounded-full object-cover object-top"
                />
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-brand-teal text-white"
                    : "bg-white/70 text-foreground shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && <TypingIndicator />}
        </div>
      </div>

      <div className="border-t border-border/20 bg-white/80 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text) return;
            setInput("");
            sendMessage(text);
          }}
          className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 rounded-full border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal/30"
            disabled={loading}
            maxLength={2000}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Enviar mensagem"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-teal to-brand-navy text-white shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <PaperPlaneRight className="h-4 w-4" weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
}
