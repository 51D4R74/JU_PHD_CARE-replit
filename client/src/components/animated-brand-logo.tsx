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
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-12 h-12 rounded-full overflow-hidden shrink-0"
          style={{ boxShadow: "0 4px 16px rgba(10,18,40,0.15)" }}
        >
          <img
            src="/juphd-logo-horizontal.png"
            alt="JuPhD Care"
            className="w-full h-full object-cover"
            style={{ objectPosition: "left center" }}
          />
        </motion.div>
        {showWordmark && (
          <div className="space-y-0.5">
            <h1 className="text-base font-bold tracking-[-0.03em]" style={{ color: "hsl(var(--text-heading))" }}>
              JuPhD <span className="font-extrabold">Care</span>
            </h1>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={"flex flex-col items-center gap-4 text-center" + (className ? " " + className : "")}>
      <motion.img
        src="/juphd-logo-horizontal.png"
        alt="JuPhD Care"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="h-20 w-auto object-contain"
        style={{ mixBlendMode: "multiply", filter: "drop-shadow(0 4px 16px rgba(10,18,40,0.10))" }}
      />
      {showWordmark && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="text-xs font-medium tracking-[0.07em] uppercase opacity-60"
          style={{ color: "hsl(var(--text-body))" }}
        >
          Inteligência em saúde psicossocial
        </motion.p>
      )}
    </div>
  );
}
