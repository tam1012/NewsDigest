export interface Env {
  DB: D1Database;
  SCRAPER_CONFIG: KVNamespace;
  PUSH_SUBSCRIPTIONS: KVNamespace;
  CONTENT_QUEUE: Queue;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  YOUTUBE_API_KEY: string;
}

export interface ContentScrapeMessage {
  articleId: string;
  url: string;
}

export interface Article {
  id: string;
  source_id: string;
  url: string;
  title: string;
  summary: string | null;
  description: string | null;
  content: string | null;
  hot_score: number | null;
  tags: string | null;
  published_at: string | null;
  fetched_at: string;
  is_bookmarked: number;
  is_read: number;
}

export interface Source {
  id: string;
  url: string;
  name: string;
  type: 'rss' | 'html' | 'reddit' | 'youtube' | 'voz';
  enabled: number;
  group_name: string | null;
  last_fetched_at: string | null;
  created_at: string;
}

export interface ArticleInput {
  url: string;
  title: string;
  description?: string;
  published_at?: string;
}
