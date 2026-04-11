"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, Search, Settings, Film, Tv, Rss } from "lucide-react";
import Link from "next/link";
import { useAppContext } from "@/lib/context";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

type RadarSource = {
  id: string;
  source_type: "rss" | "tmdb_cinema" | "tmdb_streaming";
  name: string;
  url: string | null;
  keywords: string | null;
};

type RadarItem = {
  id: string;
  title: string;
  date: string;
  snippet: string;
  image: string;
  sourceName: string;
  sourceType: "rss" | "tmdb_cinema" | "tmdb_streaming";
  link: string;
  platform?: string;
};

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }
  return html.replace(/<[^>]*>/g, "");
}

async function fetchRssSource(source: RadarSource): Promise<RadarItem[]> {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url || "")}`;
  const res = await fetch(apiUrl);
  const data = await res.json();
  if (data.status !== "ok" || !data.items) return [];

  const keywords = source.keywords
    ? source.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)
    : [];

  let items: any[] = data.items;
  if (keywords.length > 0) {
    items = items.filter((item: any) => {
      const text = ((item.title || "") + " " + (item.description || "")).toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });
  }

  return items.map((item: any) => ({
    id: `rss-${item.link}-${item.pubDate}`,
    title: item.title || "",
    date: item.pubDate || "",
    snippet: stripHtml(item.description || "").slice(0, 200),
    image: item.thumbnail || item.enclosure?.link || "",
    sourceName: source.name,
    sourceType: "rss" as const,
    link: item.link || "",
  }));
}

async function fetchTmdbCinema(source: RadarSource): Promise<RadarItem[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&region=MY&page=1`
  );
  const data = await res.json();
  if (!data.results) return [];
  return data.results.map((m: any) => ({
    id: `tmdb-cinema-${m.id}`,
    title: m.title || m.original_title || "",
    date: m.release_date || "",
    snippet: (m.overview || "").slice(0, 200),
    image: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : "",
    sourceName: source.name,
    sourceType: "tmdb_cinema" as const,
    link: `https://www.themoviedb.org/movie/${m.id}`,
  }));
}

async function fetchTmdbStreaming(source: RadarSource): Promise<RadarItem[]> {
  const providerMap: Record<string, string> = { "8": "Netflix", "337": "Disney+", "350": "Apple TV+", "9": "Amazon Prime" };
  const providerMatch = (source.url || "with_watch_providers=8").match(/with_watch_providers=(\d+)/);
  const providerId = providerMatch ? providerMatch[1] : "8";
  const platformName = providerMap[providerId] || "Streaming";

  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&watch_region=MY&with_watch_providers=${providerId}&sort_by=release_date.desc&page=1`
  );
  const data = await res.json();
  if (!data.results) return [];
  return data.results.map((m: any) => ({
    id: `tmdb-stream-${m.id}`,
    title: m.title || m.original_title || "",
    date: m.release_date || "",
    snippet: (m.overview || "").slice(0, 200),
    image: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : "",
    sourceName: source.name,
    sourceType: "tmdb_streaming" as const,
    link: `https://www.themoviedb.org/movie/${m.id}`,
    platform: platformName,
  }));
}

export default function RadarPage() {
  const { session, accentColor } = useAppContext();
  const [items, setItems] = useState<RadarItem[]>([]);
  const [sources, setSources] = useState<RadarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    if (!session?.user) { setLoading(false); return; }

    const load = async () => {
      const { data } = await supabase
        .from("radar_sources")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      const userSources = (data || []) as RadarSource[];
      setSources(userSources);

      if (userSources.length === 0) {
        setLoading(false);
        return;
      }

      // Each fetch is individually wrapped in .catch() so one failure doesn't crash the rest
      const fetchers = userSources.map((src) => {
        switch (src.source_type) {
          case "rss":
            return fetchRssSource(src).catch(() => [] as RadarItem[]);
          case "tmdb_cinema":
            return fetchTmdbCinema(src).catch(() => [] as RadarItem[]);
          case "tmdb_streaming":
            return fetchTmdbStreaming(src).catch(() => [] as RadarItem[]);
          default:
            return Promise.resolve([] as RadarItem[]);
        }
      });

      const results = await Promise.all(fetchers);
      const merged = results
        .flat()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(merged);
      setLoading(false);
    };

    load();
  }, [session]);

  // Deduplicated filter pills
  const filterNames = useMemo(() => {
    const uniqueNames = Array.from(new Set(sources.map((s) => s.name)));
    return ["All", ...uniqueNames];
  }, [sources]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeFilter !== "All") {
      list = list.filter((i) => i.sourceName === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.snippet.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeFilter, searchQuery]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const sourceIcon = (type: string) => {
    if (type === "tmdb_cinema") return <Film className="w-3 h-3" />;
    if (type === "tmdb_streaming") return <Tv className="w-3 h-3" />;
    return <Rss className="w-3 h-3" />;
  };

  const sourceColor = (type: string) => {
    if (type === "tmdb_cinema") return "bg-pink-500/10 text-pink-500";
    if (type === "tmdb_streaming") return "bg-violet-500/10 text-violet-500";
    return "bg-orange-500/10 text-orange-500";
  };

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-5 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link href="/hub" className="p-2 bg-muted rounded-xl hover:bg-border transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Radar Tracker</h1>
          <p className="text-xs text-muted-foreground font-medium">
            {sources.length} source{sources.length !== 1 ? "s" : ""} active
          </p>
        </div>
        <Link
          href="/hub/radar/settings"
          className="p-2.5 bg-muted rounded-xl hover:bg-border transition-colors"
        >
          <Settings className="w-5 h-5 text-foreground" />
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card rounded-xl px-4 py-3 border border-border/50 shadow-sm">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search articles & movies..."
          className="flex-1 bg-transparent text-sm font-semibold outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Filter Pills (deduplicated) */}
      {filterNames.length > 1 && (
        <div className="-mx-6 px-6 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2 pb-1 w-max">
            {filterNames.map((name) => {
              const active = activeFilter === name;
              return (
                <button
                  key={name}
                  onClick={() => setActiveFilter(name)}
                  className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all shrink-0 ${
                    active ? "text-white shadow-sm" : "text-muted-foreground bg-muted"
                  }`}
                  style={active ? { backgroundColor: accentColor } : {}}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Scanning feeds...</p>
        </div>
      ) : sources.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl shadow-soft border border-border/40 text-center space-y-3">
          <p className="text-3xl">📡</p>
          <p className="text-muted-foreground text-sm font-medium">
            No sources configured yet.
          </p>
          <Link
            href="/hub/radar/settings"
            style={{ backgroundColor: accentColor }}
            className="inline-block px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm active:scale-95 transition-transform"
          >
            Add Your First Source
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl shadow-soft border border-border/40 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-muted-foreground text-sm font-medium">
            No matching results. Try a different filter or search term.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, i) => {
            const isTmdb = item.sourceType === "tmdb_cinema" || item.sourceType === "tmdb_streaming";
            return (
              <motion.div
                key={item.id + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <button
                  onClick={() => window.open(item.link, "_blank")}
                  className="w-full text-left bg-card rounded-2xl shadow-sm border border-border/40 hover:scale-[1.01] active:scale-[0.98] transition-all overflow-hidden"
                >
                  {/* TMDB cards show a larger poster banner */}
                  {isTmdb && item.image ? (
                    <div className="relative">
                      <img
                        src={item.image}
                        alt=""
                        className="w-full h-48 object-cover bg-muted"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="font-bold text-sm text-white leading-snug line-clamp-2 drop-shadow-lg">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-white/70 font-medium mt-1 line-clamp-2 leading-relaxed drop-shadow-sm">
                          {item.snippet}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sourceColor(item.sourceType)}`}>
                            {sourceIcon(item.sourceType)}
                            {item.sourceName}
                          </span>
                          {item.platform && (
                            <>
                              <span className="text-[10px] text-white/40">•</span>
                              <span className="text-[10px] font-bold text-emerald-400">{item.platform}</span>
                            </>
                          )}
                          <span className="text-[10px] text-white/40">•</span>
                          <span className="text-[10px] font-bold text-white/70">
                            {formatDate(item.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            className="w-16 h-16 rounded-xl object-cover shrink-0 bg-muted"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-foreground leading-snug line-clamp-2">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-medium mt-1 line-clamp-2 leading-relaxed">
                            {item.snippet}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {formatDate(item.date)}
                            </span>
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sourceColor(item.sourceType)}`}>
                              {sourceIcon(item.sourceType)}
                              {item.sourceName}
                            </span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
