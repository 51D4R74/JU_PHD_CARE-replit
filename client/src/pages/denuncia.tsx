import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Phone, Warning, CaretLeft, Heart,
  Lifebuoy, Question, Lock, Scales, Briefcase, UserMinus, UserCircleMinus,
  Headphones, ChatSlash, MagicWand, Siren, X, FileText, SealWarning, Paperclip,
  SealCheck, ChatCircleDots,
} from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

type ReportMode = "anonymous" | "formal";
type OccurrenceWindow = "today" | "this_week" | "this_month" | "older";
type SeverityLevel = "low" | "moderate" | "high" | "emergency";

const occurrenceOptions: ReadonlyArray<{
  readonly value: OccurrenceWindow;
  readonly label: string;
}> = [
  { value: "today", label: "Hoje" },
  { value: "this_week", label: "Nesta semana" },
  { value: "this_month", label: "Neste mês" },
  { value: "older", label: "Há mais tempo" },
];

const severityOptions: ReadonlyArray<{
  readonly value: SeverityLevel;
  readonly label: string;
  readonly colorClass: string;
  readonly bgClass: string;
}> = [
  { value: "moderate", label: "Moderado", colorClass: "bg-score-moderate", bgClass: "from-score-moderate/18 to-score-moderate/5" },
  { value: "high", label: "Alto", colorClass: "bg-score-attention", bgClass: "from-score-attention/18 to-score-attention/5" },
  { value: "emergency", label: "Emergência", colorClass: "bg-score-critical", bgClass: "from-score-critical/18 to-score-critical/5" },
];

const globalRisks = [
  { label: "Assédio Sexual (Art. 216-A CP)", icon: Warning, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
  { label: "Assédio Moral (CLT Art. 483)", icon: ChatSlash, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
  { label: "Situação Violenta/Traumática", icon: Siren, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
];

const psychSafety = [
  { label: "Falta de clareza", icon: Question, color: "text-brand-teal", bgColor: "from-brand-teal/20 to-brand-teal/5" },
  { label: "Esforço sem reconhecimento", icon: Heart, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
  { label: "Baixo reconhecimento", icon: SealWarning, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
  { label: "Falta de suporte", icon: Lifebuoy, color: "text-brand-teal", bgColor: "from-brand-teal/20 to-brand-teal/5" },
  { label: "Falta de autonomia", icon: MagicWand, color: "text-score-moderate", bgColor: "from-score-moderate/20 to-score-moderate/5" },
  { label: "Sensação de injustiça", icon: Scales, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
  { label: "Sobrecarga", icon: Briefcase, color: "text-score-critical", bgColor: "from-score-critical/20 to-score-critical/5" },
  { label: "Relações ruins", icon: UserMinus, color: "text-brand-navy", bgColor: "from-brand-navy/20 to-brand-navy/5" },
  { label: "Isolamento", icon: UserCircleMinus, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
  { label: "Dificuldade de comunicação", icon: ChatCircleDots, color: "text-score-attention", bgColor: "from-score-attention/20 to-score-attention/5" },
];

export default function DenunciaPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showModeChooser, setShowModeChooser] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportMode, setReportMode] = useState<ReportMode>("anonymous");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<SeverityLevel | "">("");
  const [occurrenceWindow, setOccurrenceWindow] = useState<OccurrenceWindow | "">("");
  const [location, setLocation] = useState("");
  const [aggressorName, setAggressorName] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [followUpRequested, setFollowUpRequested] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);

  function resetReportFlow() {
    setShowModeChooser(false);
    setShowReport(false);
    setReportMode("anonymous");
    setSelectedCategory("");
    setSelectedSubcategory("");
    setDescription("");
    setSeverity("");
    setOccurrenceWindow("");
    setLocation("");
    setAggressorName("");
    setAttachments([]);
    setFollowUpRequested(true);
  }

  function handleCategorySelection(category: string, subcategory: string) {
    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
    setShowModeChooser(true);
  }

  function handleSelectReportMode(mode: ReportMode) {
    setReportMode(mode);
    setShowModeChooser(false);
    setShowReport(true);
  }

  function getReportTitle(): string {
    return reportMode === "formal" ? "Denúncia Formal" : "Relato Anônimo";
  }

  function getPrimaryButtonLabel(): string {
    return reportMode === "formal" ? "Enviar Denúncia Formal" : "Enviar Relato Anônimo";
  }

  function getDescriptionPlaceholder(): string {
    return reportMode === "formal"
      ? "Descreva objetivamente o que aconteceu..."
      : "Descreva a situação, se quiser...";
  }

  function isFormalReportValid(): boolean {
    return occurrenceWindow !== "" && description.trim().length >= 12;
  }

  function isAnonymousReportValid(): boolean {
    return severity !== "";
  }

  async function handleSubmitReport() {
    const isFormal = reportMode === "formal";
    const isAnonymous = reportMode === "anonymous";
    if (isFormal && !isFormalReportValid()) {
      toast({
        title: "Falta informação essencial",
        description: "Na denúncia formal, informe quando aconteceu e descreva o fato de forma objetiva.",
        variant: "destructive",
      });
      return;
    }
    if (isAnonymous && !isAnonymousReportValid()) {
      toast({
        title: "Selecione a severidade",
        description: "No relato anônimo, basta marcar o nível para registrar a gravidade rapidamente.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      await apiRequest("POST", "/api/incidents", {
        userId: isFormal ? user?.id ?? null : null,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        description: description.trim() || null,
        anonymous: reportMode === "anonymous",
        reportMode,
        severity: isAnonymous ? severity : null,
        occurrenceWindow: isFormal ? occurrenceWindow : null,
        location: isFormal ? location.trim() || null : null,
        peopleInvolved: isFormal ? aggressorName.trim() || null : null,
        attachmentCount: isFormal ? attachments.length : 0,
        followUpRequested: isFormal ? followUpRequested : false,
      });
      toast({
        title: isFormal ? "Denúncia enviada" : "Relato enviado",
        description: isFormal
          ? "Sua denúncia foi registrada de forma segura e vinculada à sua conta."
          : "Registrado de forma anônima e segura.",
      });
      resetReportFlow();
    } catch (error: unknown) {
      console.error("Report submission failed:", error);
      toast({ title: "Algo deu errado", description: "Não conseguimos enviar o relato.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen gradient-sunrise">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-navy/5 rounded-full blur-[150px]" />
      </div>

      <header className="relative z-10 px-4 pt-6 pb-4 max-w-lg mx-auto">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-dashboard"
        >
          <CaretLeft className="w-4 h-4" weight="bold" />
          Voltar ao início
        </button>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-navy/10 border border-brand-navy/15 mb-4">
            <Shield className="w-8 h-8 text-brand-navy" />
          </div>
          <h1 className="text-2xl font-bold">Denúncia</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Um espaço seguro e confidencial. Seu relato será anônimo.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-score-critical/20 bg-score-critical/5 p-4 mb-6 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-score-critical/20 to-score-critical/10 flex items-center justify-center flex-shrink-0">
            <Phone className="w-6 h-6 text-score-critical" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-score-critical mb-2">Precisa falar com alguém agora?</h3>
            <Button
              onClick={() => setShowCrisis(true)}
              className="bg-gradient-to-r from-score-critical to-score-critical-foreground hover:from-score-critical-foreground hover:to-score-critical text-white border-0 rounded-xl h-10 text-sm"
              data-testid="button-crisis"
            >
              <Headphones className="w-4 h-4 mr-2" />
              Falar com Conselheiro
            </Button>
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Warning className="w-3.5 h-3.5 text-score-attention" />
            Mapeamento de Riscos Globais — Relatos Anônimos
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {globalRisks.map((risk) => (
              <motion.button
                key={risk.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCategorySelection("risk", risk.label)}
                className="glass-card rounded-xl p-4 flex flex-col items-center gap-3 text-center hover:border-brand-navy/15 transition-all"
                data-testid={`risk-${risk.label}`}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${risk.bgColor} flex items-center justify-center`}>
                  <risk.icon className={`w-5 h-5 ${risk.color}`} />
                </div>
                <span className="text-xs font-medium leading-tight">{risk.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-score-attention" />
            Segurança Psicológica — Mapeamento de Dores
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {psychSafety.map((item) => (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCategorySelection("psych", item.label)}
                className="glass-card rounded-xl p-3 flex items-center gap-3 hover:border-brand-navy/15 transition-all"
                data-testid={`psych-${item.label}`}
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <span className="text-xs font-medium leading-tight text-left">{item.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.section>
      </main>

      <BottomNav />

      <AnimatePresence>
        {showModeChooser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-md glass-card rounded-2xl p-6 border-brand-navy/15"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Como deseja registrar?</h3>
                <button onClick={resetReportFlow} className="text-muted-foreground hover:text-foreground" data-testid="button-close-mode-chooser">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Para <span className="font-medium text-foreground">{selectedSubcategory}</span>, o melhor caminho aqui é simples:
                relato anônimo quando você quer registrar rápido e se proteger; denúncia formal quando você quer abrir um caso vinculado à sua conta.
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleSelectReportMode("anonymous")}
                  className="w-full rounded-2xl border border-brand-navy/15 bg-background/80 p-4 text-left transition-colors hover:bg-brand-navy/5"
                  data-testid="button-open-anonymous-report"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy/10">
                      <Lock className="w-5 h-5 text-brand-navy" />
                    </div>
                    <div>
                      <p className="font-medium">Relato anônimo</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        O caminho certo se você está com medo, quer escrever o mínimo e só precisa registrar o fato.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectReportMode("formal")}
                  className="w-full rounded-2xl border border-brand-navy/15 bg-background/80 p-4 text-left transition-colors hover:bg-brand-navy/5"
                  data-testid="button-open-formal-report"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy/10">
                      <FileText className="w-5 h-5 text-brand-navy" />
                    </div>
                    <div>
                      <p className="font-medium">Denúncia formal</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Curta e prática, mas vinculada à sua conta para permitir tratamento oficial do caso.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-md glass-card rounded-2xl p-6 border-brand-navy/15"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{getReportTitle()}</h3>
                <button onClick={resetReportFlow} className="text-muted-foreground hover:text-foreground" data-testid="button-close-report">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4 rounded-lg border border-brand-navy/15 bg-brand-navy/8 p-3">
                {reportMode === "formal" ? (
                  <SealWarning className="w-4 h-4 text-brand-navy flex-shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-brand-navy flex-shrink-0" />
                )}
                <p className="text-xs text-brand-navy">
                  {reportMode === "formal"
                    ? "Esta denúncia fica vinculada à sua conta. O formulário foi reduzido ao essencial para não te extenuar."
                    : "Este relato é completamente anônimo e foi mantido no mínimo necessário para você não desistir no meio."}
                </p>
              </div>

              <p className="text-sm text-muted-foreground mb-1">Categoria:</p>
              <p className="text-sm font-medium mb-4">{selectedSubcategory}</p>

              {reportMode === "anonymous" ? (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-medium">Nível de severidade</p>
                  <div className="grid grid-cols-2 gap-2">
                    {severityOptions.map((option) => {
                      const isSelected = severity === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSeverity(option.value)}
                          className={
                            `rounded-2xl border p-3 text-left transition-all ${
                              isSelected
                                ? "border-brand-navy/30 bg-brand-navy/5 shadow-sm"
                                : "border-border/40 bg-background/40"
                            }`
                          }
                          data-testid={`severity-${option.value}`}
                        >
                          <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${option.bgClass}`}>
                            <span className={`h-3 w-3 rounded-full ${option.colorClass}`} aria-hidden="true" />
                          </div>
                          <p className="text-sm font-medium text-foreground">{option.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {reportMode === "formal" ? (
                <div className="mb-4 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium">Quando aconteceu?</p>
                    <RadioGroup
                      value={occurrenceWindow}
                      onValueChange={(value) => setOccurrenceWindow(value as OccurrenceWindow)}
                      className="grid grid-cols-2 gap-2"
                    >
                      {occurrenceOptions.map((option) => (
                        <label
                          key={option.value}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-3 text-sm"
                        >
                          <RadioGroupItem value={option.value} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">Onde foi? <span className="text-muted-foreground font-normal">opcional</span></p>
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ex.: reunião, chat, corredor, ligação"
                      className="rounded-xl border-border/40 bg-background/40"
                      data-testid="input-report-location"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">Nome do agressor <span className="text-muted-foreground font-normal">opcional</span></p>
                    <Input
                      value={aggressorName}
                      onChange={(e) => setAggressorName(e.target.value)}
                      placeholder="Se souber e quiser informar"
                      className="rounded-xl border-border/40 bg-background/40"
                      data-testid="input-report-aggressor"
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">Anexar arquivo <span className="text-muted-foreground font-normal">opcional</span></p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      className="hidden"
                      data-testid="input-report-file"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) setAttachments((prev) => [...prev, ...Array.from(files)]);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-border/50 bg-background/40 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-brand-navy/30 transition-colors w-full"
                    >
                      <Paperclip className="w-4 h-4" />
                      Adicionar foto, print ou documento
                    </button>
                    {attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {attachments.map((file, i) => (
                          <div key={file.name + String(i)} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-xs">
                            <span className="truncate flex-1">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                              className="ml-2 text-muted-foreground hover:text-score-critical"
                              aria-label="Remover arquivo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <Textarea
                placeholder={getDescriptionPlaceholder()}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px] bg-background/40 border-border/40 focus:border-brand-navy/40 resize-none rounded-xl mb-4"
                data-testid="input-report-description"
              />

              {reportMode === "formal" ? (
                <label className="mb-4 flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
                  <Checkbox
                    checked={followUpRequested}
                    onCheckedChange={(checked) => setFollowUpRequested(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-relaxed">
                    Quero que essa denúncia possa receber acompanhamento formal.
                  </span>
                </label>
              ) : null}

              <Button
                onClick={handleSubmitReport}
                disabled={isSending}
                className="w-full bg-brand-navy hover:bg-brand-navy-hover text-white border-0 rounded-xl h-11"
                data-testid="button-submit-report"
              >
                {isSending ? "Enviando..." : getPrimaryButtonLabel()}
              </Button>
            </motion.div>
          </motion.div>
        )}

        {showCrisis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-score-critical/20 bg-white p-8 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-score-critical/10 border border-score-critical/20 mb-4">
                <Headphones className="w-8 h-8 text-score-critical" />
              </div>
              <h3 className="text-lg font-bold mb-2">Conectando você</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Estamos te conectando a um profissional. Tempo estimado: menos de 60 segundos.
              </p>
              <div className="flex items-center justify-center gap-2 mb-6">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 bg-score-critical rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  className="w-2 h-2 bg-score-critical rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                  className="w-2 h-2 bg-score-critical rounded-full"
                />
              </div>
              <Button
                onClick={() => setShowCrisis(false)}
                variant="outline"
                className="rounded-xl border-border/50"
                data-testid="button-close-crisis"
              >
                Fechar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
