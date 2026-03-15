import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Cloud, Sun, ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-brand-navy/5 to-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-sm"
      >
        <div className="relative inline-flex items-center justify-center mb-6">
          <Cloud className="w-20 h-20 text-muted-foreground/20" weight="fill" />
          <Sun className="w-10 h-10 text-brand-gold absolute" weight="fill" />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">404</h1>
        <p className="text-base text-muted-foreground mb-1">
          Essa página não foi encontrada.
        </p>
        <p className="text-sm text-muted-foreground/70 mb-8">
          Parece que o sol ainda não chegou aqui.
        </p>

        <Button
          onClick={() => navigate("/dashboard")}
          className="rounded-xl px-6 py-3 bg-brand-navy text-white hover:bg-brand-navy/90"
        >
          <ArrowLeft className="w-4 h-4 mr-2" weight="bold" />
          Voltar ao início
        </Button>
      </motion.div>
    </div>
  );
}
