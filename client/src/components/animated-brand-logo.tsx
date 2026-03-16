import { motion } from "framer-motion";

type AnimatedBrandLogoProps = Readonly<{
  size?: "compact" | "hero";
  showWordmark?: boolean;
  className?: string;
}>;

export default function AnimatedBrandLogo({
  size = "hero",
  showWordmark = true,
  className = "",
}: AnimatedBrandLogoProps) {
  const compact = size === "compact";

  if (compact) {
    return (
      <div className={"flex items-center gap-3" + (className ? " " + className : "")}>
        <motion.img
          src="/juphd-icon.png"
          alt="JuPhD Care"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-10 h-10 object-contain shrink-0"
        />
        {showWordmark && (
          <motion.img
            src="/juphd-nome.png"
            alt="JuPhD Care"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="h-6 w-auto object-contain"
          />
        )}
      </div>
    );
  }

  return (
    <div className={"flex flex-col items-center gap-4 text-center" + (className ? " " + className : "")}>
      <motion.img
        src="/juphd-icon.png"
        alt="JuPhD Care"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-28 h-28 object-contain"
        style={{ filter: "drop-shadow(0 6px 24px rgba(10,18,40,0.18))" }}
      />
      {showWordmark && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-2"
        >
          <img
            src="/juphd-nome.png"
            alt="JuPhD Care"
            className="h-9 w-auto object-contain"
          />
          <p
            className="text-[11px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: "hsl(var(--brand-navy))", opacity: 0.72 }}
          >
            protegendo o que importa.
          </p>
        </motion.div>
      )}
    </div>
  );
}
