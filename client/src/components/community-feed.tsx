import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, UserCircle, Trophy, ChatCircleDots } from "@phosphor-icons/react";
import { apiRequest } from "@/lib/queryClient";

interface FeedMessage {
  id: string;
  body: string;
  authorName: string | null;
  anonymous: boolean;
  category: string | null;
  likeCount: number;
  liked: boolean;
  createdAt: string | null;
}

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

export default function CommunityFeed() {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");

  const { data: messages = [], isLoading } = useQuery<FeedMessage[]>({
    queryKey: ["/api/community-messages"],
  });

  const likeMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await apiRequest("POST", `/api/community-messages/${messageId}/like`);
      return res.json() as Promise<{ liked: boolean; likeCount: number }>;
    },
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/community-messages"] });
      const prev = queryClient.getQueryData<FeedMessage[]>(["/api/community-messages"]);
      queryClient.setQueryData<FeedMessage[]>(["/api/community-messages"], (old) =>
        (old ?? []).map((m) =>
          m.id === messageId
            ? { ...m, liked: !m.liked, likeCount: m.liked ? m.likeCount - 1 : m.likeCount + 1 }
            : m,
        ),
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/community-messages"], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-messages"] });
    },
  });

  const sorted = [...messages].sort((a, b) => {
    if (sortBy === "popular") return b.likeCount - a.likeCount;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });

  const topMessage = messages.length > 0
    ? [...messages].sort((a, b) => b.likeCount - a.likeCount)[0]
    : null;

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
      {topMessage && topMessage.likeCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-brand-gold" weight="fill" />
            <span className="text-xs font-medium text-brand-gold">Mais curtida</span>
          </div>
          <p className="text-sm leading-relaxed">{topMessage.body}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" weight="fill" />
              {topMessage.likeCount}
            </span>
            {!topMessage.anonymous && topMessage.authorName && (
              <span className="flex items-center gap-1">
                <UserCircle className="w-3 h-3" />
                {topMessage.authorName}
              </span>
            )}
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Mural da comunidade</h3>
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50">
          <button
            onClick={() => setSortBy("recent")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              sortBy === "recent" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Recentes
          </button>
          <button
            onClick={() => setSortBy("popular")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              sortBy === "popular" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            Populares
          </button>
        </div>
      </div>

      <AnimatePresence>
        {sorted.map((msg, i) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card rounded-xl p-4"
          >
            <p className="text-sm leading-relaxed">{msg.body}</p>
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
                  msg.liked
                    ? "text-red-500 bg-red-50"
                    : "text-muted-foreground hover:text-red-400 hover:bg-red-50/50"
                }`}
              >
                <Heart className="w-3.5 h-3.5" weight={msg.liked ? "fill" : "regular"} />
                {msg.likeCount > 0 && msg.likeCount}
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}
