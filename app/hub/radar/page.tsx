"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useAppContext } from "@/lib/context";

const FEEDS = [
  "https://api.rss2json.com/v1/api.json?rss_url=https://www.gizmochina.com/feed/",
  "https://api.rss2json.com/v1/api.json?rss_url=https://bloody-disgusting.com/feed/",
];

const KEYWORDS = ["xiaomi", "cuktech", "horror", "stephen king", "alien", "redmi", "poco", "hyperos", "android", "slasher", "zombie"];

type Article = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  thumbnail: string;
  source: string;
};

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }
  return html.replace(/<[^>]*>/g, "");
}

function matchesKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return KEYWORDS.some(kw => lower.includes(kw));
}

export default function RadarPage() {
  const { accentColor } = useAppContext();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchFeeds = async () => {
      try {
        const results = await Promise.all(
          FEEDS.map(url =>
            fetch(url)
              .then(r => r.json())
              .then(data => {
                if (data.status !== "ok" || !data.items) return [];
                return data.items.map((item: any) => ({
                  title: item.title || "",
                  link: item.link || "",
                  pubDate: item.pubDate || "",
                  description: stripHtml(item.description || "").slice(0, 200),
                  thumbnail: item.thumbnail || item.enclosure?.link || "",
                  source: data.feed?.title || "Unknown",
                }));
              })
              .catch(() => [])
          )
        );
        const merged = results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        setArticles(merged);
      } catch {}
      setLoading(false);
    };
    fetchFeeds();
  }, []);

  const filteredArticles = useMemo(() => {
    const keywordFiltered = articles.filter(a => matchesKeywords(a.title + " " + a.description));
    if (!searchQuery.trim()) return keywordFiltered;
    const q = searchQuery.toLowerCase();
    return keywordFiltered.filter(a => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  }, [articles, searchQuery]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return dateStr; }
  };

  return (
    <div className="p-6 animate-in fade-in duration-500 space-y-6 pb-32">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/hub" className="p-2 bg-muted rounded-xl hover:bg-border transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Radar Tracker</h1>
          <p className="text-xs text-muted-foreground font-medium">Filtered tech & entertainment intel</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-card rounded-xl px-4 py-3 border border-border/50 shadow-sm">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search articles..."
          className="flex-1 bg-transparent text-sm font-semibold outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Keywords */}
      <div className="-mx-6 px-6 overflow-x-auto hide-scrollbar">
        <div className="flex gap-2 pb-1 w-max">
          {KEYWORDS.slice(0, 8).map(kw => (
            <span key={kw} style={{ color: accentColor, backgroundColor: `${accentColor}1A` }} className="text-[10px] font-bold px-3 py-1 rounded-full capitalize shrink-0">{kw}</span>
          ))}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Scanning feeds...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="bg-card p-8 rounded-3xl shadow-soft border border-border/40 text-center">
          <p className="text-3xl mb-3">📡</p>
          <p className="text-muted-foreground text-sm font-medium">No matching articles found. Keywords are scanned against live RSS feeds.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredArticles.map((article, i) => (
            <motion.div
              key={article.link + i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <button
                onClick={() => window.open(article.link, "_blank")}
                className="w-full text-left bg-card p-4 rounded-2xl shadow-sm border border-border/40 hover:scale-[1.01] active:scale-[0.98] transition-all"
              >
                <div className="flex items-start gap-3">
                  {article.thumbnail && (
                    <img src={article.thumbnail} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground leading-snug line-clamp-2">{article.title}</p>
                    <p className="text-[11px] text-muted-foreground font-medium mt-1 line-clamp-2 leading-relaxed">{article.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] font-bold text-muted-foreground">{formatDate(article.pubDate)}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{article.source}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
                    </div>
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
