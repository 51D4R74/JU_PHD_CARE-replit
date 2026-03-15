import { useId } from "react";
import { motion } from "framer-motion";
import { Cloud } from "@phosphor-icons/react";
import type { SkyState } from "@/lib/checkin-data";
import type { HaloMetrics } from "@/lib/solar-points";

type SkyHeaderProps = Readonly<{
  skyState: SkyState;
  solarHaloLevel: number;
  haloMetrics?: HaloMetrics | null;
  size?: "compact" | "hero";
  /** When true, render as a full-bleed background with no border/rounding. */
  fullBleed?: boolean;
  className?: string;
}>;

const palette = {
  teal: "hsl(var(--brand-teal))",
  textSecondary: "hsl(var(--text-body))",
  border: "hsl(var(--border-soft))",
} as const;

export const SKY_CONFIG: Record<SkyState, {
  bgFrom: string;
  bgMid: string;
  bgTo: string;
  sunColor: string;
  haloOpacity: number;
  label: string;
}> = {
  clear: {
    bgFrom: "#FEFBF0",
    bgMid: "#FAF4E4",
    bgTo: "#F0EDE6",
    sunColor: "#F5C542",
    haloOpacity: 0.45,
    label: "Céu aberto",
  },
  "partly-cloudy": {
    bgFrom: "#EDF1F5",
    bgMid: "#E7ECF2",
    bgTo: "#E4E8EC",
    sunColor: "#F5C542",
    haloOpacity: 0.25,
    label: "Sol entre nuvens",
  },
  "protective-cloud": {
    bgFrom: "#E2E6EB",
    bgMid: "#DCE0E6",
    bgTo: "#D8DDE3",
    sunColor: "#E8C94A",
    haloOpacity: 0.15,
    label: "Nuvem protetora",
  },
  respiro: {
    bgFrom: "#D9DEE4",
    bgMid: "#D2D6DC",
    bgTo: "#CDD3DA",
    sunColor: "#DAB94A",
    haloOpacity: 0.08,
    label: "Modo Respiro",
  },
};

/**
 * Per-state cloud depth tints.
 * back = distant haze, mid = middle layer, fore = nearest cloud.
 * Concrete hex values required — SVG filter chains don't resolve CSS variables.
 *
 * Depth contrast rule: back is the darkest/coolest (recedes), fore is the
 * lightest/warmest (advances). Difference of ≥25 lightness units between layers
 * ensures each depth reads as distinct in the final composited render.
 */
const CLOUD_TINTS: Record<SkyState, { back: string; mid: string; fore: string }> = {
  //                    back (cool/dark)   mid (neutral)   fore (light/warm)
  clear:              { back: "#A8BED4",  mid: "#CCDAE8", fore: "#EAF2F8" },
  "partly-cloudy":    { back: "#9AB8CC",  mid: "#BDD4E4", fore: "#DDEAF4" },
  "protective-cloud": { back: "#92AABF",  mid: "#B2C6D6", fore: "#D2E0EA" },
  respiro:            { back: "#8EAABF",  mid: "#AECAD8", fore: "#CEE0EA" },
};

/**
 * Per-layer opacity multipliers per sky state.
 * Using flat scalars on cloudOpacity ignores that feColorMatrix threshold
 * binarizes alpha — low opacity on large circles still renders at near-full
 * density inside the intersection zone. These values control *group* opacity
 * after threshold, so they are true scene-presence weights.
 */
const CLOUD_OPACITY: Record<SkyState, { back: number; mid: number; fore: number }> = {
  //                  back    mid    fore
  clear: { back: 0, mid: 0.08, fore: 0.18 },
  "partly-cloudy": { back: 0.4, mid: 0.58, fore: 0.72 },
  "protective-cloud": { back: 0.6, mid: 0.75, fore: 0.88 },
  respiro: { back: 0.68, mid: 0.82, fore: 0.96 },
};

// ── Halo ring ─────────────────────────────────────────────────────────────

const HALO_COLORS: Record<HaloMetrics["temperature"], string> = {
  cold: "#8BB8D0",
  warm: "#F5C542",
  hot:  "#E8944A",
} as const;

const HALO_STROKE: Record<HaloMetrics["thickness"], number> = {
  1: 1.5, 2: 2.5, 3: 3.5, 4: 4.5, 5: 6,
} as const;

function HaloRingSVG({
  haloMetrics, cx, cy, r, tempoScale,
}: Readonly<{ haloMetrics: HaloMetrics; cx: number; cy: number; r: number; tempoScale: number }>) {
  const opacityAnim = haloMetrics.pulse ? { opacity: [0.6, 1, 0.6] } : { opacity: 0.7 };
  const trans = haloMetrics.pulse
    ? { duration: 2.4 * tempoScale, repeat: Infinity, ease: "easeInOut" as const }
    : {};
  return (
    <motion.circle
      cx={cx} cy={cy} r={r}
      stroke={HALO_COLORS[haloMetrics.temperature]}
      strokeWidth={HALO_STROKE[haloMetrics.thickness] ?? 2}
      strokeLinecap="round"
      fill="none"
      animate={opacityAnim}
      transition={trans}
    />
  );
}

// ── Cloud circle geometry ─────────────────────────────────────────────────
//
// Each cloud is rendered as a group of overlapping circles fed through an SVG
// feGaussianBlur filter.  At low σ the circles remain distinct; they merge
// organically as σ rises.  The foreground cloud adds a feColorMatrix
// threshold step to sharpen the silhouette, then a final light blur to
// re-soften the cut edge.  This is the same "metaball / liquid blob"
// technique used by award-winning atmospheric UIs (Dribbble weather concepts,
// Mercury Weather, Linear's hero card).

interface CloudCircle { readonly cx: number; readonly cy: number; readonly r: number; }

function CloudCircles({ circles, fill }: Readonly<{ circles: readonly CloudCircle[]; fill: string }>) {
  return (
    <>
      {circles.map((c) => (
        <circle key={`${c.cx}-${c.cy}-${c.r}`} cx={c.cx} cy={c.cy} r={c.r} fill={fill} />
      ))}
    </>
  );
}

function getContainerClass(compact: boolean, fullBleed: boolean): string {
  if (fullBleed) {
    return "relative h-full w-full overflow-hidden";
  }

  if (compact) {
    return "relative h-14 w-full overflow-hidden rounded-2xl border";
  }

  return "relative h-32 w-full max-w-sm overflow-hidden rounded-[24px] border";
}

/**
 * Two cloud layouts keyed by "hero" / "compact".
 *
 * SVG viewBox is always 0 0 360 128.  With preserveAspectRatio="xMidYMid slice"
 * the compact container (h-14 ≈ 56 px) shows the top 56 viewBox units, so
 * compact clouds must live in y ≤ 50.
 *
 * SIZING RULE: circle radius must be ≥ 3× the filter σ so the shape survives
 * the blur step and the feColorMatrix threshold has visible mass to cut into.
 */
const CLOUD_LAYOUTS = {
  hero: {
    sunCX: 180, sunCY: 38, sunR: 18,
    // Back cloud: left cluster, large circles → σ=5 → threshold(soft) → re-blur
    back: [
      { cx: 70,  cy: 80, r: 32 }, { cx: 106, cy: 73, r: 28 },
      { cx: 44,  cy: 85, r: 22 }, { cx: 132, cy: 80, r: 22 },
      { cx: 26,  cy: 82, r: 16 },
    ],
    // Mid cloud: right cluster
    mid: [
      { cx: 264, cy: 66, r: 26 }, { cx: 294, cy: 58, r: 24 },
      { cx: 242, cy: 72, r: 18 }, { cx: 316, cy: 66, r: 18 },
      { cx: 226, cy: 76, r: 13 },
    ],
    // Fore cloud: bottom-center, overlapping sun axis
    fore: [
      { cx: 162, cy: 102, r: 24 }, { cx: 188, cy: 95,  r: 26 },
      { cx: 138, cy: 108, r: 17 }, { cx: 210, cy: 103, r: 18 },
      { cx: 122, cy: 110, r: 12 },
    ],
  },
  compact: {
    sunCX: 180, sunCY: 20, sunR: 10,
    // Compact: all clouds must stay in y ≤ 50 to be visible in the sliced viewport
    back: [
      { cx: 68,  cy: 34, r: 17 }, { cx: 90,  cy: 28, r: 15 },
      { cx: 50,  cy: 38, r: 11 }, { cx: 108, cy: 34, r: 11 },
      { cx: 36,  cy: 36, r: 9  },
    ],
    mid: [
      { cx: 264, cy: 28, r: 14 }, { cx: 284, cy: 22, r: 13 },
      { cx: 248, cy: 32, r: 10 }, { cx: 300, cy: 28, r: 10 },
    ],
    fore: [
      { cx: 158, cy: 44, r: 13 }, { cx: 178, cy: 39, r: 14 },
      { cx: 140, cy: 47, r: 9  }, { cx: 194, cy: 44, r: 10 },
    ],
  },
} as const;

// ── Main component ────────────────────────────────────────────────────────

export default function SkyHeader({
  skyState,
  solarHaloLevel,
  haloMetrics,
  size = "hero",
  fullBleed = false,
  className = "",
}: SkyHeaderProps) {
  // React 18 useId — colons replaced so the value is a valid XML id
  const uid = useId().replaceAll(":", "");
  const compact = size === "compact";
  const layout = compact ? CLOUD_LAYOUTS.compact : CLOUD_LAYOUTS.hero;
  const config = SKY_CONFIG[skyState];
  const tints = CLOUD_TINTS[skyState];
  const cloudLayers = CLOUD_OPACITY[skyState];
  const effectiveHalo = config.haloOpacity * Math.max(solarHaloLevel, 0);
  // Modo Respiro: slow all animations 1.8× for a calmer, breathing feel
  const tempoScale = skyState === "respiro" ? 1.8 : 1;
  const { sunCX, sunCY, sunR } = layout;

  // Full-bleed mode: no border, no rounding — fills parent container
  const containerClass = getContainerClass(compact, fullBleed);

  const containerBorder = fullBleed ? undefined : palette.border;

  return (
    <div className={`flex ${compact ? "items-center gap-3" : "flex-col items-center gap-3"} ${className}`.trim()}>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={containerClass}
        style={{
          borderColor: containerBorder,
          background: `linear-gradient(165deg, ${config.bgFrom} 0%, ${config.bgMid} 55%, ${config.bgTo} 100%)`,
          boxShadow: fullBleed ? undefined : "0 12px 32px rgba(26,39,68,0.06)",
        }}
      >
        {/*
         * Single full-bleed SVG carries every visual element.
         * viewBox 360×128 stays constant; compact containers crop via
         * preserveAspectRatio="xMidYMid slice" (shows top ~56 units).
         */}
        <svg
          viewBox="0 0 360 128"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            {/* Sun: white-hot core → warm gold rim */}
            <radialGradient id={`sg-${uid}`} cx="42%" cy="36%" r="60%">
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.88" />
              <stop offset="28%"  stopColor={config.sunColor} />
              <stop offset="100%" stopColor={config.sunColor} stopOpacity="0.85" />
            </radialGradient>

            {/* Wide diffuse corona (σ=22) */}
            <filter id={`fc-${uid}`} x="-110%" y="-110%" width="320%" height="320%">
              <feGaussianBlur stdDeviation="22" />
            </filter>

            {/* Mid glow ring (σ=10) */}
            <filter id={`fg-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="10" />
            </filter>

            {/*
             * All three cloud layers share the same pipeline:
             *   blur → feColorMatrix alpha-threshold → re-soften
             * This preserves an organic silhouette while smoothing the cut edge.
             * feColorMatrix: A_out = N·A − k  (threshold at A > k/N)
             *
             * SIZING RULE kept here too: σ is intentionally small (3–5) so the
             * blurred mass retains visible density before the threshold step.
             *
             * Back cloud: σ=5, soft threshold (10·A − 3), re-blur σ=2.5
             */}
            <filter id={`fb-${uid}`} x="-28%" y="-38%" width="156%" height="176%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feColorMatrix
                in="b" type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 10 -3"
                result="t"
              />
              <feGaussianBlur in="t" stdDeviation="2.5" />
            </filter>

            {/*
             * Mid cloud: σ=4, medium threshold (14·A − 5), re-blur σ=1.8
             */}
            <filter id={`fm-${uid}`} x="-22%" y="-32%" width="144%" height="164%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feColorMatrix
                in="b" type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -5"
                result="t"
              />
              <feGaussianBlur in="t" stdDeviation="1.8" />
            </filter>

            {/*
             * Foreground cloud: σ=3.5, sharp threshold (18·A − 7), re-blur σ=1.0
             * Produces the crispest silhouette — this is the dominant cloud layer.
             */}
            <filter id={`ff-${uid}`} x="-18%" y="-30%" width="136%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feColorMatrix
                in="b" type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                result="t"
              />
              <feGaussianBlur in="t" stdDeviation="1.0" />
            </filter>
          </defs>

          {/* ── Wide atmospheric corona ── */}
          <motion.ellipse
            cx={sunCX} cy={sunCY}
            rx={sunR * 3.2} ry={sunR * 3.2}
            fill={config.sunColor}
            filter={`url(#fc-${uid})`}
            style={{ opacity: effectiveHalo * 0.48 }}
            animate={{ rx: [sunR * 3.2, sunR * 3.7, sunR * 3.2], ry: [sunR * 3.2, sunR * 3.7, sunR * 3.2] }}
            transition={{ duration: 6.5 * tempoScale, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* ── Inner glow ring ── */}
          <motion.ellipse
            cx={sunCX} cy={sunCY}
            rx={sunR * 1.8} ry={sunR * 1.8}
            fill={config.sunColor}
            filter={`url(#fg-${uid})`}
            style={{ opacity: effectiveHalo * 0.62 + 0.1 }}
            animate={{ rx: [sunR * 1.8, sunR * 2.1, sunR * 1.8], ry: [sunR * 1.8, sunR * 2.1, sunR * 1.8] }}
            transition={{ duration: 5 * tempoScale, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
          />

          {/* ── Sun disk ── */}
          <motion.ellipse
            cx={sunCX} cy={sunCY}
            rx={sunR} ry={sunR}
            fill={`url(#sg-${uid})`}
            animate={{ rx: [sunR, sunR * 1.022, sunR], ry: [sunR, sunR * 1.022, sunR] }}
            transition={{ duration: 5.4 * tempoScale, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* ── Engagement halo ring ── */}
          {haloMetrics ? (
            <HaloRingSVG
              haloMetrics={haloMetrics}
              cx={sunCX} cy={sunCY}
              r={sunR * (compact ? 1.9 : 1.75)}
              tempoScale={tempoScale}
            />
          ) : null}

          {/* ── Background cloud — distant atmospheric haze ── */}
          <motion.g
            filter={`url(#fb-${uid})`}
            style={{ opacity: cloudLayers.back }}
            animate={{ x: [0, 14, 0], y: [0, 3, 0] }}
            transition={{ duration: 15 * tempoScale, repeat: Infinity, ease: "easeInOut" }}
          >
            <CloudCircles circles={layout.back} fill={tints.back} />
          </motion.g>

          {/* ── Mid cloud — soft volume ── */}
          <motion.g
            filter={`url(#fm-${uid})`}
            style={{ opacity: cloudLayers.mid }}
            animate={{ x: [0, -9, 0], y: [0, -2, 0] }}
            transition={{ duration: 10 * tempoScale, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
          >
            <CloudCircles circles={layout.mid} fill={tints.mid} />
          </motion.g>

          {/* ── Foreground cloud — organic silhouette ── */}
          <motion.g
            filter={`url(#ff-${uid})`}
            style={{ opacity: cloudLayers.fore }}
            animate={{ x: [0, 6, 0], y: [0, 1.5, 0] }}
            transition={{ duration: 8 * tempoScale, repeat: Infinity, ease: "easeInOut", delay: 2.7 }}
          >
            <CloudCircles circles={layout.fore} fill={tints.fore} />
          </motion.g>
        </svg>

        {/* ── State label badge ── */}
        {compact ? null : (
          <div
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em]"
            style={{
              borderColor: "rgba(255,255,255,0.72)",
              background: "rgba(255,255,255,0.8)",
              color: palette.textSecondary,
            }}
          >
            <Cloud className="h-3 w-3" style={{ color: palette.teal }} />
            {config.label}
          </div>
        )}
      </motion.div>
    </div>
  );
}
