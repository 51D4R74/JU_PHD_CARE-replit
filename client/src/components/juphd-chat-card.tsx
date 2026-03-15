import { motion } from "framer-motion";
import { SealCheck } from "@phosphor-icons/react";
import { GradientButton } from "@/components/ui/gradient-button";
import { useChatbot } from "@/lib/chatbot-context";

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
  const { openChat } = useChatbot();

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
        <div className="flex items-center gap-3.5 mb-6">
          <JuPHDAvatar size={88} />

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

        <div className="w-full h-px bg-gradient-to-r from-brand-teal/10 via-brand-teal/20 to-brand-gold/10 mb-5" />

        <p className="text-[1.08rem] leading-8 text-foreground font-medium sm:text-lg">
          {message}
        </p>

        <GradientButton
          onClick={openChat}
          showCaret
          className="mt-7"
        >
          Contar pra JuPHD
        </GradientButton>
      </div>
    </motion.div>
  );
}

function JuPHDAvatar({ size }: Readonly<{ size: number }>) {
  const ringSpread = 4;
  const outerSpread = 8;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size + outerSpread * 2, height: size + outerSpread * 2 }}
    >
      <span
        className="lumina-halo absolute rounded-full"
        style={{
          inset: 0,
          border: "1.5px solid hsl(43 82% 58% / 0.25)",
        }}
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
          background: "linear-gradient(145deg, hsl(183 41% 36% / 0.08) 0%, hsl(43 82% 58% / 0.06) 100%)",
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
