CREATE TABLE IF NOT EXISTS published_posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  cover_data_url TEXT NOT NULL DEFAULT '',
  blocks_json TEXT NOT NULL,
  date TEXT NOT NULL,
  read_time TEXT NOT NULL,
  author_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_published_posts_updated_at
  ON published_posts(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_posts_category
  ON published_posts(category_slug, updated_at DESC);
