import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { SealCheck, PaperPlaneRight, SpinnerGap } from "@phosphor-icons/react";

interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
}

interface JuPHDChatCardProps {
  readonly message?: string;
  readonly delay?: number;
  readonly className?: string;
}

export default function JuPHDChatCard({
  message = "Como foi até agora? Quero entender melhor o seu momento.",
  delay = 0,
  className = "",
}: Readonly<JuPHDChatCardProps>) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "greeting", role: "assistant", content: message },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
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
        body: JSON.stringify({ message: text }),
        credentials: "include",
      });
      const data = await res.json();
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
      inputRef.current?.focus();
    }
  }, [input, loading]);

  const hasConversation = messages.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={
        "relative overflow-hidden rounded-[28px] border border-brand-teal/15 " +
        "bg-card shadow-lg " +
        className
      }
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(183 41% 36% / 0.06) 0%, hsl(202 56% 21% / 0.04) 40%, hsl(43 82% 58% / 0.05) 80%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-[280px] h-[280px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsl(183 41% 36% / 0.06) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col px-6 pt-7 pb-4 sm:px-8 sm:pt-9">
        {/* Identity header */}
        <div className="flex items-center gap-3.5 mb-5">
          <JuPHDAvatar />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <img src="/juphd-nome.png" alt="JuPHD" className="h-5 object-contain" />
              <SealCheck className="w-4 h-4 text-brand-teal flex-shrink-0" weight="fill" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
              IA especializada em Saúde Psicossocial
            </span>
            <span className="lumina-status-pill mt-0.5">
              <span className="lumina-status-dot" aria-hidden="true" />
              ATIVA
            </span>
          </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-brand-teal/10 via-brand-teal/20 to-brand-gold/10 mb-4" />

        {/* Messages */}
        <div
          className={`flex flex-col gap-3 ${hasConversation ? "max-h-52 overflow-y-auto pr-1" : ""}`}
        >
          {messages.map((msg) =>
            msg.role === "assistant" ? (
              <p
                key={msg.id}
                className="text-[1.05rem] leading-7 text-foreground font-medium"
              >
                {msg.content}
              </p>
            ) : (
              <div key={msg.id} className="flex justify-end">
                <span className="inline-block max-w-[80%] rounded-2xl bg-brand-teal px-3.5 py-2 text-sm leading-relaxed text-white">
                  {msg.content}
                </span>
              </div>
            ),
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SpinnerGap className="h-3.5 w-3.5 animate-spin text-brand-teal" />
              Pensando...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Inline input — always visible, no button needed */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva aqui…"
            disabled={loading}
            maxLength={2000}
            className={
              "flex-1 rounded-2xl border bg-background/60 px-4 py-2.5 text-sm " +
              "placeholder:text-muted-foreground/50 outline-none " +
              "focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal/30 " +
              "transition-all disabled:opacity-50"
            }
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Enviar mensagem"
            className={
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full " +
              "bg-gradient-to-br from-brand-teal to-brand-navy text-white " +
              "shadow-md shadow-brand-teal/20 transition-all " +
              "hover:brightness-110 active:scale-95 " +
              "disabled:opacity-40 disabled:pointer-events-none"
            }
          >
            <PaperPlaneRight className="h-4 w-4" weight="bold" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function JuPHDAvatar() {
  const size = 72;
  const ringSpread = 3;
  const outerSpread = 6;
  const total = size + outerSpread * 2;

  return (
    <div className="relative flex-shrink-0" style={{ width: total, height: total }}>
      <span
        className="lumina-halo absolute rounded-full"
        style={{ inset: 0, border: "1.5px solid hsl(43 82% 58% / 0.25)" }}
        aria-hidden="true"
      />
      <span
        className="companion-breathing absolute rounded-full"
        style={{
          inset: outerSpread - ringSpread,
          border: "1.5px solid hsl(183 41% 36% / 0.30)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute rounded-full overflow-hidden"
        style={{
          inset: outerSpread,
          background:
            "linear-gradient(145deg, hsl(183 41% 36% / 0.08) 0%, hsl(43 82% 58% / 0.06) 100%)",
        }}
      >
        <img
          src="/juphd-icon.png"
          alt="JuPHD — IA em Saúde Psicossocial"
          className="h-full w-full object-contain p-[8%]"
          style={{ filter: "drop-shadow(0 2px 8px rgba(42,166,166,0.18))" }}
        />
      </div>
    </div>
  );
}
