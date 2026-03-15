import { useState, useRef, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, UserCircle, Trophy, ChatCircleDots, Waveform, Play, Pause } from "@phosphor-icons/react";
import { apiRequest } from "@/lib/queryClient";

interface FeedMessage {
  id: string;
  content: string | null;
  audioUrl: string | null;
  mediaType: string;
  authorName: string | null;
  anonymous: boolean;
  category: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string | null;
}

const PAGE_SIZE = 20;

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function AudioPlayer({ src }: Readonly<{ src: string }>) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
    setPlaying(!playing);
  }, [playing]);

  return (
    <div className="flex items-center gap-2 py-1">
      <button
        onClick={toggle}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-teal/10 text-brand-teal transition-colors hover:bg-brand-teal/20"
      >
        {playing ? <Pause className="w-4 h-4" weight="fill" /> : <Play className="w-4 h-4" weight="fill" />}
      </button>
      <div className="flex-1 flex items-center gap-0.5 h-5">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-full bg-brand-teal/20"
            style={{ height: `${20 + Math.sin(i * 0.8) * 60 + Math.random() * 20}%` }}
          />
        ))}
      </div>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
    </div>
  );
}

function RankBadge({ rank }: Readonly<{ rank: number }>) {
  if (rank > 3) return null;
  const colors = ["text-brand-gold", "text-muted-foreground", "text-amber-700"];
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${colors[rank - 1]}`}>
      <Trophy className="w-3 h-3" weight="fill" />
      #{rank}
    </span>
  );
}

function MediaBadge({ type }: Readonly<{ type: string }>) {
  if (type === "audio") {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-brand-teal bg-brand-teal/8 rounded px-1.5 py-0.5">
        <Waveform className="w-3 h-3" weight="bold" />
        Áudio
      </span>
    );
  }
  return null;
}

export default function CommunityFeed() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedMessage[]>({
    queryKey: ["/api/community-messages"],
    queryFn: async ({ pageParam }) => {
      const res = await fetch(`/api/community-messages?page=${pageParam}&limit=${PAGE_SIZE}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar mensagens");
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
  });

  const messages = data?.pages.flat() ?? [];

  const likeMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await apiRequest("POST", `/api/community-messages/${messageId}/like`);
      return { messageId, ...(await res.json() as { liked: boolean; likeCount: number }) };
    },
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/community-messages"] });
      queryClient.setQueryData(["/api/community-messages"], (old: unknown) => {
        if (!old || typeof old !== "object" || !("pages" in old)) return old;
        const inf = old as { pages: FeedMessage[][]; pageParams: unknown[] };
        return {
          ...inf,
          pages: inf.pages.map((page) =>
            page.map((m) =>
              m.id === messageId
                ? { ...m, likedByMe: !m.likedByMe, likeCount: m.likedByMe ? m.likeCount - 1 : m.likeCount + 1 }
                : m,
            ),
          ),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-messages"] });
    },
  });

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="w-5 h-5 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-10">
        <ChatCircleDots className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" weight="duotone" />
        <p className="text-sm text-muted-foreground">
          Nenhuma mensagem ainda.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Seja a primeira pessoa a deixar uma mensagem de apoio.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Mural da comunidade</h3>
      </div>

      <AnimatePresence>
        {messages.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: Math.min(i, 5) * 0.04 }}
            className="glass-card rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <RankBadge rank={i + 1} />
              <MediaBadge type={msg.mediaType} />
            </div>

            {msg.mediaType === "audio" && msg.audioUrl ? (
              <AudioPlayer src={msg.audioUrl} />
            ) : (
              <p className="text-sm leading-relaxed">{msg.content}</p>
            )}

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {msg.anonymous ? (
                  <span className="flex items-center gap-1">
                    <UserCircle className="w-3.5 h-3.5" />
                    Anônimo
                  </span>
                ) : (
                  msg.authorName && (
                    <span className="flex items-center gap-1">
                      <UserCircle className="w-3.5 h-3.5" />
                      {msg.authorName}
                    </span>
                  )
                )}
                {msg.createdAt && (
                  <span>{timeAgo(msg.createdAt)}</span>
                )}
              </div>
              <button
                onClick={() => likeMutation.mutate(msg.id)}
                className={`flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors ${
                  msg.likedByMe
                    ? "text-red-500 bg-red-50"
                    : "text-muted-foreground hover:text-red-400 hover:bg-red-50/50"
                }`}
              >
                <Heart className="w-3.5 h-3.5" weight={msg.likedByMe ? "fill" : "regular"} />
                {msg.likeCount > 0 && msg.likeCount}
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full py-3 text-sm font-medium text-brand-teal hover:bg-brand-teal/5 rounded-xl transition-colors disabled:opacity-50"
        >
          {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
        </button>
      )}
    </section>
  );
}
