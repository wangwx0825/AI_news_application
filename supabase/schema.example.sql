-- 示例建表 SQL（新闻模块）
-- 在 Supabase SQL Editor 中执行即可创建

create table if not exists news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  summary text,
  content text,
  content_blocks jsonb default '[]'::jsonb,
  tags text[],
  source text,
  source_url text,
  external_id text unique,
  author text,
  status text,
  cover_image text,
  category text,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 开启 Row Level Security（可选，公开读）
alter table news enable row level security;

create policy "Allow public read access"
  on news for select
  using (true);

-- 插入示例数据
insert into news (title, summary, content) values
  ('示例新闻 1', '这是第一条示例新闻的摘要。', '这里是新闻正文内容...'),
  ('示例新闻 2', '这是第二条示例新闻的摘要。', '这里是新闻正文内容...');
