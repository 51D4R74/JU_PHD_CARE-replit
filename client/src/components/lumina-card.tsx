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
import { CaretRight, SealCheck } from "@phosphor-icons/react";
import { GradientButton } from "@/components/ui/gradient-button";
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
        <div className="flex flex-col items-center flex-shrink-0">
          <LuminaAvatar size={36} />
          <span className="text-[8px] font-bold tracking-wide text-brand-teal/70 uppercase mt-0.5">JuPHD</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-medium text-muted-foreground">IA Psicossocial</span>
            <span className="lumina-status-dot" aria-hidden="true" />
          </div>
          <p className="text-sm leading-snug text-foreground">
            {msg.text}
          </p>
        </div>
        <CaretRight className="h-4 w-4 flex-shrink-0 text-brand-teal/60" weight="bold" />
      </motion.button>
    );
  }

  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={
          "relative overflow-hidden rounded-[28px] border border-brand-teal/15 " +
          "bg-card shadow-lg " + className
        }
      >
        {/* Aurora gradient wash */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(135deg, hsl(183 41% 36% / 0.06) 0%, hsl(202 56% 21% / 0.04) 40%, hsl(43 82% 58% / 0.05) 80%, transparent 100%)",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-[280px] h-[280px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(183 41% 36% / 0.06) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 w-[200px] h-[200px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(43 82% 58% / 0.05) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col px-6 py-7 sm:px-8 sm:py-9">
          {/* Identity header row */}
          <div className="flex items-center gap-3.5 mb-6">
            <LuminaAvatar size={88} showHalo />

            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <img src="/logoNOMECareTransp.png" alt="JuPHD" className="h-5 object-contain" />
                <SealCheck className="w-4 h-4 text-brand-teal flex-shrink-0" weight="fill" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
                IA especializada em Saúde Psicossocial
              </span>
              <span className="lumina-status-pill mt-0.5">
                <span className="lumina-status-dot" aria-hidden="true" />
                Ativa
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-brand-teal/10 via-brand-teal/20 to-brand-gold/10 mb-5" />

          {/* Message */}
          <p className="text-[1.08rem] leading-8 text-foreground font-medium sm:text-lg">
            {msg.text}
          </p>

          <GradientButton onClick={onTap} showCaret className="mt-7">
            {msg.cta}
          </GradientButton>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={
        "relative overflow-hidden rounded-[24px] border border-brand-teal/15 " +
        "bg-card shadow-sm " + className
      }
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          background: "linear-gradient(135deg, hsl(183 41% 36%), hsl(43 82% 58%) 60%, transparent 80%)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3.5 px-4 py-4">
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5">
          <LuminaAvatar size={44} />
          <span className="text-[9px] font-bold tracking-wide text-brand-teal/70 uppercase mt-1">JuPHD</span>
          <span className="text-[8px] text-muted-foreground/50 leading-tight">IA Psicossocial</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="lumina-status-pill">
              <span className="lumina-status-dot" aria-hidden="true" />
              Ativa
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {msg.text}
          </p>

          <button
            type="button"
            onClick={onTap}
            className={
              "mt-3 inline-flex items-center gap-1.5 rounded-xl " +
              "bg-gradient-to-r from-brand-teal/12 to-brand-navy/8 " +
              "px-3.5 py-2 text-sm font-semibold text-brand-teal " +
              "transition-colors hover:from-brand-teal/18 hover:to-brand-navy/12 active:from-brand-teal/22"
            }
          >
            {msg.cta}
            <CaretRight className="h-3.5 w-3.5" weight="bold" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Avatar sub-component ───────────────────────────────

function LuminaAvatar({ size, showHalo = false }: Readonly<{ size: number; showHalo?: boolean }>) {
  const ringSpread = showHalo ? 4 : 2;
  const outerSpread = showHalo ? 8 : 0;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size + outerSpread * 2, height: size + outerSpread * 2 }}
    >
      {/* Outer gold halo ring (featured only) */}
      {showHalo && (
        <span
          className="lumina-halo absolute rounded-full"
          style={{
            inset: 0,
            border: "1.5px solid hsl(43 82% 58% / 0.25)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Breathing teal ring */}
      <span
        className="companion-breathing absolute rounded-full"
        style={{
          inset: showHalo ? outerSpread - ringSpread : -ringSpread,
          border: `1.5px solid hsl(183 41% 36% / 0.30)`,
        }}
        aria-hidden="true"
      />

      {/* Avatar circle with gradient background */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{
          inset: outerSpread,
          background: "linear-gradient(145deg, hsl(183 41% 36% / 0.08) 0%, hsl(43 82% 58% / 0.06) 100%)",
        }}
      >
        <video
          src="/juphd.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover object-top"
          aria-label="JuPHD — IA em Saúde Psicossocial"
        />
      </div>
    </div>
  );
}
