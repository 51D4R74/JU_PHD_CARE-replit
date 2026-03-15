import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { CaretLeft, Heart, Sparkle, ArrowsClockwise, PaperPlaneRight, PencilLine, Waves, Flame, HandHeart, Leaf, EyeSlash, Eye, Microphone, Stop, Waveform } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import BottomNav from "@/components/bottom-nav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SupportMessageCard from "@/components/support-message-card";
import LuminaCard from "@/components/lumina-card";
import SolarPointsBadge from "@/components/solar-points-badge";
import CommunityFeed from "@/components/community-feed";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SUPPORT_CATEGORIES, type SupportCategory, type SupportMessage } from "@/lib/support-messages";
import {
  selectSupportMessage,
  toggleFavorite,
  isFavorite,
  getFavoriteMessages,
  evaluateRespiro,
  deactivateRespiro,
} from "@/lib/support-engine";
import { POINT_VALUES } from "@/lib/mission-engine";
import type { TodayScores } from "@/lib/score-engine";
import type { UserMission } from "@shared/schema";
import { useAuth } from "@/lib/auth";

const CATEGORY_ICONS: Record<string, PhosphorIcon> = { Waves, Flame, HandHeart, Leaf };

// ── Tabs ──────────────────────────────────────────

type Tab = "receive" | "favorites" | "leave";

const EMPTY_SCORES: TodayScores = {
  domainScores: { recarga: 0, "estado-do-dia": 0, "seguranca-relacional": 0 },
  skyState: "partly-cloudy",
  solarHaloLevel: 0.5,
  flags: [],
  hasCheckedIn: false,
};

export default function SupportCenterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: scores = EMPTY_SCORES } = useQuery<TodayScores>({
    queryKey: ["/api/scores/user", userId, "today"],
    enabled: !!userId,
  });

  const { data: todayMissions = [] } = useQuery<UserMission[]>({
    queryKey: ["/api/missions", userId, "today"],
    enabled: !!userId,
  });

  const missionPointsToday = todayMissions.reduce((sum, m) => sum + m.pointsEarned, 0);
  const solarPoints = (scores.hasCheckedIn ? POINT_VALUES.checkin : 0) + missionPointsToday;

  const isRespiro = evaluateRespiro(scores);

  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("receive");
  const [composeMode, setComposeMode] = useState<"text" | "audio">("text");
  const [authorText, setAuthorText] = useState("");
  const [authorAnonymous, setAuthorAnonymous] = useState(true);
  const [authorSubmitted, setAuthorSubmitted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null);
  const [currentMessage, setCurrentMessage] = useState<SupportMessage | null>(null);
  const [favMessages, setFavMessages] = useState(getFavoriteMessages);

  const handleCategorySelect = useCallback(
    (cat: SupportCategory) => {
      setSelectedCategory(cat);
      const msg = selectSupportMessage({
        category: cat,
        skyState: scores.skyState,
        flags: scores.flags,
      });
      setCurrentMessage(msg);
    },
    [scores.skyState, scores.flags],
  );

  const handleNewMessage = useCallback(() => {
    if (!selectedCategory) return;
    const msg = selectSupportMessage({
      category: selectedCategory,
      skyState: scores.skyState,
      flags: scores.flags,
    });
    setCurrentMessage(msg);
  }, [selectedCategory, scores.skyState, scores.flags]);

  const handleToggleFavorite = useCallback((messageId: string) => {
    toggleFavorite(messageId);
    setFavMessages(getFavoriteMessages());
  }, []);

  const submitMessageMutation = useMutation({
    mutationFn: async (payload: { content?: string; audioUrl?: string; mediaType: "text" | "audio"; anonymous: boolean }) => {
      const res = await apiRequest("POST", "/api/community-messages", payload);
      return res.json();
    },
    onSuccess: () => {
      setAuthorSubmitted(true);
      setAuthorText("");
      setAudioBlob(null);
      queryClient.invalidateQueries({ queryKey: ["/api/community-messages"] });
      toast({ title: "Mensagem enviada", description: "Obrigado por cuidar de alguém." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível enviar. Tente de novo.", variant: "destructive" });
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast({ title: "Permissão negada", description: "Habilite o microfone para gravar.", variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleDeactivateRespiro = useCallback(() => {
    deactivateRespiro();
    navigate("/support");
  }, [navigate]);

  return (
    <div className="min-h-screen gradient-sunrise">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-teal/8 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 pt-6 pb-2 flex items-center gap-3 max-w-lg mx-auto">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 -ml-2 rounded-xl hover:bg-black/5 transition-colors"
          aria-label="Voltar"
        >
          <CaretLeft className="w-5 h-5" weight="bold" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Apoio</h1>
          <p className="text-xs text-muted-foreground">
            Um espaço só pra você
          </p>
        </div>
        <SolarPointsBadge points={solarPoints} />
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-4 pb-24">
        {/* Modo Respiro banner */}
        {isRespiro && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-2xl border border-brand-teal/20 bg-brand-teal/8 p-4"
          >
            <div className="flex items-start gap-3">
              <Sparkle className="w-5 h-5 text-brand-teal flex-shrink-0 mt-0.5" weight="fill" />
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-teal">
                  Modo Respiro ativo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O app está mais leve pra você. Menos estímulos, mais acolhimento.
                </p>
                {scores.skyState !== "respiro" && (
                  <button
                    onClick={handleDeactivateRespiro}
                    className="text-xs font-medium text-brand-teal mt-2 hover:underline"
                  >
                    Desativar Modo Respiro
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 p-1 rounded-xl bg-muted/50">
          <button
            onClick={() => setTab("receive")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === "receive"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Receber
          </button>
          <button
            onClick={() => setTab("favorites")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === "favorites"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className="w-3 h-3 inline mr-1" weight="fill" />
            Favoritos
          </button>
          <button
            onClick={() => setTab("leave")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === "leave"
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PencilLine className="w-3 h-3 inline mr-1" weight="bold" />
            Deixar
          </button>
        </div>

        {/* JuPHD companion — same featured card as home */}
        <LuminaCard
          context="support"
          featured
          delay={0.15}
          className="mt-4"
          onTap={() => navigate("/denuncia")}
        />

        {/* Community feed — always visible below JuPHD card */}
        <div className="mt-5">
          <CommunityFeed />
        </div>

        <AnimatePresence mode="wait">
          {tab === "receive" && (
            <motion.div
              key="receive"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
            >
              {currentMessage ? (
                <section className="mt-5 space-y-4">
                  <SupportMessageCard
                    message={currentMessage}
                    isFavorite={isFavorite(currentMessage.id)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleNewMessage}
                      className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-brand-teal bg-brand-teal/10 hover:bg-brand-teal/15 rounded-xl py-3 transition-colors"
                    >
                      <ArrowsClockwise className="w-4 h-4" weight="bold" />
                      Outra mensagem
                    </button>
                    <button
                      onClick={() => {
                        setCurrentMessage(null);
                        setSelectedCategory(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground bg-muted/50 hover:bg-muted rounded-xl py-3 transition-colors"
                    >
                      Trocar categoria
                    </button>
                  </div>
                </section>
              ) : (
                <section className="mt-5">
                  <p className="text-sm text-muted-foreground mb-3">
                    O que você precisa agora?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {SUPPORT_CATEGORIES.map((cat) => {
                      const IconComp = CATEGORY_ICONS[cat.icon];
                      return (
                        <motion.button
                          key={cat.id}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleCategorySelect(cat.id)}
                          className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 text-center hover:border-brand-teal/20 transition-all"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/10">
                            <IconComp className="w-5 h-5 text-brand-teal" weight="duotone" />
                          </div>
                          <span className="text-sm font-medium">{cat.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {cat.description}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </section>
              )}
            </motion.div>
          )}
          {tab === "favorites" && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <section className="mt-5 space-y-3">
                {favMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" weight="fill" />
                    <p className="text-sm text-muted-foreground">
                      Suas mensagens favoritas aparecerão aqui.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Toque no coração pra guardar as que fazem sentido pra você.
                    </p>
                  </div>
                ) : (
                  favMessages.map((msg) => (
                    <SupportMessageCard
                      key={msg.id}
                      message={msg}
                      isFavorite={true}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))
                )}
              </section>
            </motion.div>
          )}
          {tab === "leave" && (
            <motion.div
              key="leave"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <section className="mt-5">
                {authorSubmitted ? (
                  <div className="text-center py-12">
                    <Sparkle className="w-8 h-8 text-brand-teal mx-auto mb-3" weight="fill" />
                    <p className="text-sm font-medium">Obrigado por cuidar de alguém.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sua mensagem já está no mural da comunidade.
                    </p>
                    <button
                      onClick={() => { setAuthorSubmitted(false); setAuthorText(""); setAudioBlob(null); }}
                      className="mt-4 text-xs font-medium text-brand-teal hover:underline"
                    >
                      Enviar outra
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="glass-card rounded-2xl p-4">
                      <p className="text-sm font-medium mb-1">
                        Deixe uma mensagem pra alguém
                      </p>

                      {/* Escrever / Gravar toggle */}
                      <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50 mb-3">
                        <button
                          onClick={() => setComposeMode("text")}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            composeMode === "text" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          <PencilLine className="w-3.5 h-3.5" weight="bold" />
                          Escrever
                        </button>
                        <button
                          onClick={() => setComposeMode("audio")}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            composeMode === "audio" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          <Microphone className="w-3.5 h-3.5" weight="bold" />
                          Gravar
                        </button>
                      </div>

                      {composeMode === "text" ? (
                        <>
                          <p className="text-xs text-muted-foreground mb-2">
                            Escreva algo que possa ajudar alguém tendo um dia difícil. Até 280 caracteres.
                          </p>
                          <Textarea
                            placeholder="Ex: Você não está só nessa..."
                            value={authorText}
                            onChange={(e) => setAuthorText(e.target.value.slice(0, 280))}
                            className="min-h-[100px] bg-background/40 border-border/40 focus:border-brand-teal/40 resize-none rounded-xl"
                          />
                        </>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Grave uma mensagem de voz para a comunidade.
                          </p>
                          {audioBlob ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-teal/5 border border-brand-teal/10">
                                <Waveform className="w-5 h-5 text-brand-teal" weight="bold" />
                                <span className="text-xs font-medium text-brand-teal flex-1">Áudio gravado</span>
                              </div>
                              <button
                                onClick={() => setAudioBlob(null)}
                                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                              >
                                Refazer
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center py-4">
                              <button
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                onTouchStart={startRecording}
                                onTouchEnd={stopRecording}
                                className={`flex items-center justify-center w-16 h-16 rounded-full transition-all ${
                                  isRecording
                                    ? "bg-red-500 text-white scale-110 animate-pulse"
                                    : "bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20"
                                }`}
                              >
                                {isRecording ? (
                                  <Stop className="w-6 h-6" weight="fill" />
                                ) : (
                                  <Microphone className="w-6 h-6" weight="fill" />
                                )}
                              </button>
                              <p className="text-xs text-muted-foreground mt-2">
                                {isRecording ? "Gravando... solte para parar" : "Segure para gravar"}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAuthorAnonymous(!authorAnonymous)}
                            className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${
                              authorAnonymous
                                ? "text-brand-teal bg-brand-teal/10"
                                : "text-muted-foreground bg-muted/50"
                            }`}
                          >
                            {authorAnonymous ? (
                              <EyeSlash className="w-3.5 h-3.5" weight="bold" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" weight="bold" />
                            )}
                            {authorAnonymous ? "Anônimo" : "Com nome"}
                          </button>
                          {composeMode === "text" && (
                            <span className="text-xs text-muted-foreground">
                              {authorText.length}/280
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (composeMode === "text") {
                              if (authorText.trim().length < 10) {
                                toast({
                                  title: "Precisa de mais",
                                  description: "Escreva pelo menos 10 caracteres.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              submitMessageMutation.mutate({
                                content: authorText.trim(),
                                mediaType: "text",
                                anonymous: authorAnonymous,
                              });
                            } else {
                              if (!audioBlob) {
                                toast({
                                  title: "Grave primeiro",
                                  description: "Segure o botão para gravar sua mensagem.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              const formData = new FormData();
                              formData.append("audio", audioBlob, "recording.webm");
                              fetch("/api/upload-audio", { method: "POST", body: formData, credentials: "include" })
                                .then((r) => { if (!r.ok) throw new Error("Upload falhou"); return r.json() as Promise<{ audioUrl: string }>; })
                                .then((data) => {
                                  submitMessageMutation.mutate({
                                    audioUrl: data.audioUrl,
                                    mediaType: "audio",
                                    anonymous: authorAnonymous,
                                  });
                                })
                                .catch(() => {
                                  toast({ title: "Erro", description: "Falha ao enviar o áudio.", variant: "destructive" });
                                });
                            }
                          }}
                          disabled={
                            (composeMode === "text" && authorText.trim().length < 10) ||
                            (composeMode === "audio" && !audioBlob) ||
                            submitMessageMutation.isPending
                          }
                          className="flex items-center gap-1.5 text-sm font-medium text-white bg-brand-teal hover:bg-brand-teal/90 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors"
                        >
                          <PaperPlaneRight className="w-3.5 h-3.5" weight="bold" />
                          Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
