-- 访客明细表：每次页面浏览落一行。
-- 应用方式（在 worker/like-counter 目录）：
--   npx wrangler d1 execute my-blog-visitors --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS visits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,   -- unix 毫秒时间戳
  path       TEXT,               -- 访问的页面路径
  referrer   TEXT,               -- 来源页
  ip         TEXT,               -- 访客 IP（原始）
  country    TEXT,               -- 国家两位码
  region     TEXT,               -- 省级地区
  city       TEXT,               -- 城市
  colo       TEXT,               -- 命中的 Cloudflare 机房
  asn        INTEGER,            -- 运营商 ASN
  as_org     TEXT,               -- 运营商/机构名
  ua         TEXT,               -- User-Agent
  language   TEXT,               -- Accept-Language
  visitor_id TEXT,               -- localStorage 里的随机访客 ID
  screen     TEXT                -- 屏幕分辨率
);

CREATE INDEX IF NOT EXISTS idx_visits_ts      ON visits (ts);
CREATE INDEX IF NOT EXISTS idx_visits_ip      ON visits (ip);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits (visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_country ON visits (country);
CREATE INDEX IF NOT EXISTS idx_visits_path    ON visits (path);
