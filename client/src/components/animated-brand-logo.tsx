import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AnimatedBrandLogoProps = Readonly<{
  size?: "compact" | "hero";
  showWordmark?: boolean;
  className?: string;
}>;

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */

const palette = {
  text: "hsl(var(--text-heading))",
  textSecondary: "hsl(var(--text-body))",
} as const;

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AnimatedBrandLogo({
  size = "hero",
  showWordmark = true,
  className = "",
}: AnimatedBrandLogoProps) {
  const compact = size === "compact";

  return (
    <div
      className={
        "flex items-center " +
        (compact ? "gap-3" : "flex-col gap-4 text-center") +
        (className ? " " + className : "")
      }
    >
      <motion.img
        src="/logoCARE.png"
        alt="JuPHD"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={compact ? "h-12 w-12 shrink-0 rounded-full object-cover" : "h-28 w-28 shrink-0 rounded-full object-cover"}
        style={{ filter: "drop-shadow(0 8px 24px rgba(10,18,40,0.18))" }}
      />

      {showWordmark ? (
        <div className={compact ? "space-y-0.5" : "space-y-1.5"}>
          <h1
            className={(compact ? "text-base" : "text-3xl") + " font-bold tracking-[-0.04em]"}
            style={{ color: palette.text }}
          >
            JuPHD
          </h1>
          <p
            className={(compact ? "text-[10px]" : "text-xs") + " font-medium tracking-[0.08em] uppercase opacity-70"}
            style={{ color: palette.textSecondary }}
          >
            Inteligência em saúde psicossocial
          </p>
        </div>
      ) : null}
    </div>
  );
}