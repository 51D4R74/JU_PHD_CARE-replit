import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, PaperPlaneRight, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useChatbot } from "@/lib/chatbot-context";

interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Olá! Sou a assistente da JuPHD. Posso ajudar com dúvidas sobre saúde mental no trabalho, riscos psicossociais, ou simplesmente ouvir como você está. Como posso ajudar?",
};

export default function ChatbotDrawer() {
  const { isOpen, closeChat } = useChatbot();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const closeSession = useCallback(
    async (sid: string | null, cid: string | null) => {
      if (!sid && !cid) return;
      try {
        await fetch("/api/chat/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, conversationId: cid }),
          credentials: "include",
        });
      } catch {
        // best-effort — ignore errors on close
      }
    },
    [],
  );

  const handleClose = useCallback(() => {
    closeSession(sessionId, conversationId);
    closeChat();
    setMessages([WELCOME_MESSAGE]);
    setSessionId(null);
    setConversationId(null);
    setInput("");
  }, [closeChat, closeSession, sessionId, conversationId]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId ?? undefined,
          conversationId: conversationId ?? undefined,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as {
        reply?: string;
        message?: string;
        session_id?: string | null;
        conversation_id?: string | null;
      };

      if (data.session_id) setSessionId(data.session_id);
      if (data.conversation_id) setConversationId(data.conversation_id);

      const reply =
        data.reply ??
        data.message ??
        "Desculpe, não consegui processar sua mensagem.";

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
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 right-0 z-50 flex h-[28rem] w-full flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:bottom-6 sm:right-6 sm:w-96 sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <img
                src="/juphd-icon.png"
                alt="JuPHD"
                className="h-6 w-6 rounded-full object-contain"
              />
              <div>
                <span className="text-sm font-semibold">JuPHD Care</span>
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-score-good/12 px-2 py-0.5 text-[10px] font-medium text-score-good">
                  <span className="h-1.5 w-1.5 rounded-full bg-score-good" />
                  Online
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Fechar chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-brand-teal text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <SpinnerGap className="h-3.5 w-3.5 animate-spin" />
                  Pensando...
                </div>
              </div>
            ) : null}
          </div>

          {/* Confidentiality note */}
          <p className="px-4 pb-1 text-center text-[10px] text-muted-foreground/60">
            Conversa confidencial · Nada chega ao RH sem sua autorização
          </p>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t px-4 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-teal/30"
              disabled={loading}
              maxLength={2000}
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 rounded-full bg-brand-teal text-white hover:bg-brand-teal/90"
              disabled={!input.trim() || loading}
              aria-label="Enviar mensagem"
            >
              <PaperPlaneRight className="h-4 w-4" weight="bold" />
            </Button>
          </form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
