/**
 * LuminaCard — contextual AI companion card.
 *
 * Lumina is a RAG-based generative AI trained on psychosocial wellness
 * research. This card surfaces her voice across every key screen as the
 * single source of personalized guidance.
 *
 * Message selection is delegated to lumina-engine.ts.
 * AI sprint: swap the engine implementation with a live RAG call.
 */

import { motion } from "framer-motion";
import { Sparkle, CaretRight } from "@phosphor-icons/react";
import {
  type LuminaContext,
  selectLuminaMessage,
} from "../lib/lumina-engine";

// ── Component ──────────────────────────────────────────

interface LuminaCardProps {
  readonly context: LuminaContext;
  readonly onTap?: () => void;
  readonly delay?: number;
  readonly className?: string;
  readonly compact?: boolean;
  readonly featured?: boolean;
}

export default function LuminaCard({
  context,
  onTap,
  delay = 0,
  className = "",
  compact = false,
  featured = false,
}: Readonly<LuminaCardProps>) {
  const msg = selectLuminaMessage(context);

  if (compact) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.35 }}
        onClick={onTap}
        className={
          "flex w-full items-center gap-3 rounded-2xl border border-brand-teal/20 " +
          "bg-gradient-to-r from-brand-teal/6 to-transparent px-4 py-3 text-left " +
          "transition-colors hover:border-brand-teal/30 " + className
        }
      >
        <LuminaAvatar size={32} />
        <p className="flex-1 text-sm leading-snug text-foreground">
          {msg.text}
        </p>
        <CaretRight className="h-4 w-4 flex-shrink-0 text-brand-teal/60" weight="bold" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={
        "relative overflow-hidden rounded-[28px] border border-brand-teal/20 " +
        "bg-card shadow-sm " + className
      }
    >
      {/* Subtle gradient wash — Lumina's signature */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          background: "linear-gradient(135deg, hsl(187 62% 44%), hsl(44 90% 51%) 60%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <div
        className={
          featured
            ? "relative flex min-h-[54svh] flex-col items-center justify-center px-6 py-8 text-center sm:min-h-[420px] sm:px-8 sm:py-10"
            : "relative flex items-start gap-3.5 px-4 py-4"
        }
      >
        {featured ? (
          <>
            <LuminaAvatar size={88} />

            <p className="mt-5 max-w-xl text-[1.08rem] leading-8 text-foreground sm:text-lg">
              {msg.text}
            </p>

            <button
              type="button"
              onClick={onTap}
              className={
                "mt-8 inline-flex min-h-12 items-center gap-2 rounded-2xl " +
                "bg-brand-teal/10 px-5 py-3 text-base font-medium text-brand-teal " +
                "transition-colors hover:bg-brand-teal/16 active:bg-brand-teal/20"
              }
            >
              {msg.cta}
              <CaretRight className="h-4 w-4" weight="bold" />
            </button>
          </>
        ) : (
          <>
            <LuminaAvatar size={40} />

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-xs font-semibold tracking-wide text-brand-teal">
                  JuPHD
                </span>
                <Sparkle className="h-3 w-3 text-brand-teal/60" weight="fill" />
              </div>

              <p className="text-sm leading-relaxed text-foreground">
                {msg.text}
              </p>

              <button
                type="button"
                onClick={onTap}
                className={
                  "mt-3 inline-flex items-center gap-1.5 rounded-xl " +
                  "bg-brand-teal/10 px-3.5 py-2 text-sm font-medium text-brand-teal " +
                  "transition-colors hover:bg-brand-teal/16 active:bg-brand-teal/20"
                }
              >
                {msg.cta}
                <CaretRight className="h-3.5 w-3.5" weight="bold" />
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Avatar sub-component ───────────────────────────────

function LuminaAvatar({ size }: Readonly<{ size: number }>) {
  return (
    <div
      className="relative flex-shrink-0 rounded-full"
      style={{ width: size, height: size }}
    >
      <img
        src="/logoCARE.png"
        alt="JuPHD"
        className="h-full w-full rounded-full object-cover"
        style={{ filter: "drop-shadow(0 2px 8px rgba(42,166,166,0.18))" }}
      />
      {/* Breathing ring — companion presence indicator */}
      <span
        className="companion-breathing absolute inset-[-2px] rounded-full border border-brand-teal/25"
        aria-hidden="true"
      />
    </div>
  );
}
