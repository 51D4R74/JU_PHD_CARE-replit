/**
 * PanicButton — always-visible red FAB that navigates to the Denúncia page.
 *
 * Fixed bottom-left, above bottom nav. Tapping navigates to /denuncia
 * where the user can file anonymous reports.
 *
 * Design rationale: victims rarely find courage to report — the
 * button must be visible, accessible, and feel safe at all times.
 */

import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Siren } from "lucide-react";

export default function PanicButton() {
  const [, navigate] = useLocation();

  return (
    <motion.button
      type="button"
      onClick={() => navigate("/denuncia")}
      className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-red-600 shadow-lg shadow-red-600/30 flex items-center justify-center hover:bg-red-700 active:scale-95 transition-all"
      whileTap={{ scale: 0.9 }}
      aria-label="Denúncia — relatar situação"
      data-testid="panic-button"
    >
      <Siren className="w-6 h-6 text-white" />
    </motion.button>
  );
}
