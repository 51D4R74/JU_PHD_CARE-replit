/**
 * SupportMessageCard — displays a curated support message with
 * category badge, favorite toggle, and gentle animation.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Waves, Flame, HandHeart, Leaf } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { SupportMessage, SupportCategory } from "@/lib/support-messages";
import { SUPPORT_CATEGORIES } from "@/lib/support-messages";

const ICON_MAP: Record<string, PhosphorIcon> = { Waves, Flame, HandHeart, Leaf };

interface SupportMessageCardProps {
  readonly message: SupportMessage;
  readonly isFavorite: boolean;
  readonly onToggleFavorite: (messageId: string) => void;
  readonly className?: string;
}

const categoryColors: Record<SupportCategory, { bg: string; text: string; border: string }> = {
  calma: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  coragem: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  acolhimento: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
  leveza: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
};

export default function SupportMessageCard({
  message,
  isFavorite: initialFav,
  onToggleFavorite,
  className = "",
}: Readonly<SupportMessageCardProps>) {
  const [fav, setFav] = useState(initialFav);
  const cat = SUPPORT_CATEGORIES.find((c) => c.id === message.category);
  const colors = categoryColors[message.category];

  function handleFavorite() {
    setFav(!fav);
    onToggleFavorite(message.id);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-2xl p-5 ${className}`}
    >
      {/* Category badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
        >
          <CategoryIcon iconName={cat?.icon} />
          {cat?.label}
        </span>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleFavorite}
          className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart
            className={`w-4.5 h-4.5 transition-colors ${
              fav ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
            }`}
          />
        </motion.button>
      </div>

      {/* Message text */}
      <p className="text-base leading-relaxed font-medium text-foreground">
        "{message.text}"
      </p>
    </motion.div>
  );
}

function CategoryIcon({ iconName }: Readonly<{ iconName?: string }>) {
  if (!iconName || !ICON_MAP[iconName]) return null;
  const Ic = ICON_MAP[iconName];
  return <Ic className="w-3.5 h-3.5" weight="duotone" />;
}
