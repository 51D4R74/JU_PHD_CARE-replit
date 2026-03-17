import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { SealCheck, PaperPlaneRight } from "@phosphor-icons/react";

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
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    navigate(`/chat?q=${encodeURIComponent(text)}`);
  }

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

        <p className="text-[1.05rem] leading-7 text-foreground font-medium">
          {message}
        </p>

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
            maxLength={2000}
            className={
              "flex-1 rounded-2xl border bg-background/60 px-4 py-2.5 text-sm " +
              "placeholder:text-muted-foreground/50 outline-none " +
              "focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal/30 " +
              "transition-all"
            }
          />
          <button
            type="submit"
            disabled={!input.trim()}
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
          alt="JuPHD Care — IA em Saúde Psicossocial"
          className="h-full w-full object-contain p-[8%]"
          style={{ filter: "drop-shadow(0 2px 8px rgba(42,166,166,0.18))" }}
        />
      </div>
    </div>
  );
}
