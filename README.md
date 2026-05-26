# Company Wiki

Company Wiki 是一个面向 AI 新技术资讯的企业知识库项目，基于 Next.js、Supabase 和 Tailwind CSS 构建。项目包含新闻聚合、新闻详情展示、FAQ、后台管理、定时抓取和基础权限控制。

线上内容以 AI 官方来源为主，支持展示正文段落、图片、表格、代码块和简单视频。

---

## 功能概览

- 首页：AI 资讯中心封面、最新新闻预览、来源状态展示。
- 新闻列表 `/news`：展示 AI 新闻，支持按来源筛选。
- 新闻详情 `/news/[slug]`：展示封面、正文块、图片、视频、表格、代码块和原文链接。
- FAQ `/faq`：展示常见问题列表和详情。
- 后台 `/admin`：管理新闻、FAQ 和管理员邮箱。
- 自动抓取：支持从多个 AI 官方来源导入新闻。
- 安全控制：Supabase Auth、`admin_users` 管理员表、RLS、middleware、`CRON_SECRET` 接口鉴权。

---

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Next.js 16 App Router |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 数据库 | Supabase PostgreSQL |
| 鉴权 | Supabase Auth |
| 内容解析 | Cheerio、fast-xml-parser |
| 部署 | Vercel |

---

## 主要页面

| 路径 | 说明 |
|------|------|
| `/` | 首页，展示 AI 资讯中心和最新新闻 |
| `/news` | 新闻列表 |
| `/news/[slug]` | 新闻详情 |
| `/faq` | FAQ 列表 |
| `/faq/[slug]` | FAQ 详情 |
| `/login` | 管理员登录 |
| `/admin` | 后台首页 |
| `/admin/news` | 新闻管理 |
| `/admin/faq` | FAQ 管理 |
| `/admin/users` | 管理员管理 |

---

## 新闻来源

当前抓取来源包括：

- OpenAI
- Google DeepMind
- Hugging Face
- Anthropic
- Stability AI
- Mistral AI
- Meta AI

导入接口位于 `src/app/api/import/*`，统一入口位于：

```text
/api/cron/import-all-news
```

生产环境下，抓取接口必须携带：

```http
Authorization: Bearer <CRON_SECRET>
```

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env.local
```

至少需要配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-cron-secret
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 用于前台读取数据和登录。
- `SUPABASE_SERVICE_ROLE_KEY` 用于服务器端新闻导入，不要暴露到浏览器。
- `CRON_SECRET` 用于保护导入和调试接口。
- `NEXT_PUBLIC_SITE_URL` 本地可设为 `http://localhost:3000`，线上设为 Vercel 域名。

### 3. 初始化数据库

在 Supabase SQL Editor 中执行：

```text
supabase/schema.example.sql
```

如果是已有数据库，只需要补 RLS 策略，可以执行：

```text
supabase/rls-policies.sql
```

首次使用后台前，需要先插入管理员邮箱：

```sql
insert into public.admin_users (email)
values ('your-admin@example.com')
on conflict (email) do nothing;
```

这个邮箱需要和 Supabase Auth 登录邮箱一致。

### 4. 启动开发服务器

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

---

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
```

---

## 手动触发新闻导入

本地如果配置了 `CRON_SECRET`，触发导入时需要带 Authorization header：

```bash
curl -X POST "http://localhost:3000/api/import/deepmind-news" \
  -H "Authorization: Bearer your-cron-secret"
```

触发所有来源：

```bash
curl "http://localhost:3000/api/cron/import-all-news" \
  -H "Authorization: Bearer your-cron-secret"
```

如果本地开发环境没有配置 `CRON_SECRET`，导入接口会允许本地调试；生产环境必须配置 `CRON_SECRET`。

---

## 数据库表

### `news`

存储新闻内容。主要字段包括：

- `title`
- `slug`
- `summary`
- `content`
- `content_blocks`
- `source`
- `source_url`
- `external_id`
- `cover_image`
- `category`
- `published_at`
- `status`

### `faq`

存储 FAQ 内容。主要字段包括：

- `question`
- `answer`
- `category`
- `slug`
- `created_at`
- `updated_at`

### `admin_users`

存储允许进入后台的管理员邮箱。

---

## 权限模型

项目使用三层保护：

1. Supabase Auth：负责登录身份。
2. `admin_users` 表：决定登录用户是否是后台管理员。
3. Supabase RLS：限制匿名用户只能读，管理员才能写。

middleware 会保护以下入口：

```text
/admin/*
/news/new
/news/[slug]/edit
/faq/new
/faq/[slug]/edit
```

未登录用户会跳转到 `/login`，非管理员用户会跳回首页。

---

## 项目结构

```text
company-wiki/
├── INTERN_REPORT.md              技术复盘报告
├── middleware.ts                  后台和写页面门禁
├── src/
│   ├── app/
│   │   ├── page.tsx               首页
│   │   ├── news/                  新闻前台页面
│   │   ├── faq/                   FAQ 前台页面
│   │   ├── admin/                 后台管理页面
│   │   ├── login/                 登录页
│   │   └── api/
│   │       ├── import/            各来源新闻导入接口
│   │       ├── cron/              定时导入入口
│   │       └── test/              parser 调试接口
│   ├── components/                通用 UI 组件
│   └── lib/                       Supabase 与接口鉴权工具
├── public/                        静态资源
└── supabase/
    ├── schema.example.sql         当前表结构示例
    └── rls-policies.sql           RLS 策略
```

---

## 部署到 Vercel

1. 将代码推送到 GitHub。
2. 在 Vercel 导入仓库。
3. 配置 Environment Variables：

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

4. 确认 Supabase 已执行 `schema.example.sql` 或 `rls-policies.sql`。
5. 部署后访问线上地址。

项目已在 `vercel.json` 中配置 Vercel Cron，每天 `08:00 UTC` 请求：

```text
/api/cron/import-all-news
```

只要在 Vercel Environment Variables 中配置了 `CRON_SECRET`，Vercel 会自动携带 `Authorization: Bearer <CRON_SECRET>` 请求该路由。

---

## 原生 App 打包

项目已配置 Capacitor，可将线上站点打包为 iOS 和 Android 原生 App。发布步骤见：

```text
APP_RELEASE.md
```

---

## 复盘报告

项目复盘见：

```text
INTERN_REPORT.md
```

---

## License

MIT
