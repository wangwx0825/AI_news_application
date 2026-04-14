# Company Wiki

一个 Wikipedia 风格的企业知识库脚手架，基于 Next.js + Supabase + Tailwind CSS 构建。

> 目标：提供一个可直接部署的项目骨架与设计系统，
> 开发者可在此基础上扩展新的知识模块（如新闻、通用词条、FAQ 等）。

---

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 数据 | Supabase（PostgreSQL） |
| 部署 | Vercel + PWA |

---

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone <your-repo-url>
cd company-wiki
npm install
```

### 2. 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com/) 注册账号
2. 创建一个新项目（免费版即可）
3. 进入 **Settings → API**，复制：
   - Project URL
   - anon / public key

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 Supabase 项目值：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看效果。

---

## 项目结构

```
company-wiki/
├── src/
│   ├── app/
│   │   ├── layout.tsx          全局布局（含 Header）
│   │   ├── page.tsx            首页
│   │   ├── globals.css         全局样式 + 设计变量
│   │   └── demo/
│   │       └── page.tsx        组件示例页（新模块的参考模板）
│   ├── components/
│   │   ├── Header.tsx          顶部导航
│   │   ├── Breadcrumb.tsx      面包屑
│   │   ├── EntryLayout.tsx     词条页通用布局
│   │   ├── Section.tsx         可折叠分区
│   │   ├── InfoCard.tsx        右侧信息卡
│   │   └── Tag.tsx             标签
│   └── lib/
│       └── supabase.ts         Supabase 客户端
├── public/
│   ├── manifest.json           PWA 配置
│   └── icons/                  PWA 图标
├── supabase/
│   └── schema.example.sql      示例建表 SQL
└── .env.example                环境变量模板
```

---

## 设计规范

### 配色

| 用途 | 值 | Tailwind 变量 |
|------|------|------|
| 背景 | `#f8f6f1` | `bg-bg` |
| 卡片 | `#ffffff` | `bg-card` |
| 边框 | `#e0ddd5` | `border-border` |
| 正文 | `#2c2c2a` | `text-text` |
| 次要文字 | `#6b6960` | `text-sub` |
| 提示 | `#9e9b91` | `text-hint` |
| 链接 | `#2a6496` | `text-link` |
| 强调 | `#c8553a` | `text-accent` |

### 字体

- 标题：`Noto Serif SC`（`font-serif`）
- 正文：`Noto Sans SC`（`font-sans`）

### 布局

- 内容最大宽度：`960px`
- 词条页：左侧内容 + 右侧 `260px` 信息卡
- 移动端（`<720px`）：单列，信息卡置于内容上方

---

## 开发新模块

以"新闻模块"为例：

### 1. 在 Supabase 中建表

```sql
create table news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text,
  published_at timestamptz default now()
);
```

### 2. 新建页面目录

```
src/app/news/
├── page.tsx            新闻列表页
└── [id]/
    └── page.tsx        新闻详情页（参考 /demo/page.tsx）
```

### 3. 复用现有组件

```tsx
import EntryLayout from '@/components/EntryLayout'
import Section from '@/components/Section'
import InfoCard from '@/components/InfoCard'
import { supabase } from '@/lib/supabase'

export default async function NewsDetail({ params }) {
  const { data } = await supabase
    .from('news')
    .select('*')
    .eq('id', params.id)
    .single()

  return (
    <EntryLayout
      breadcrumbItems={[
        { label: '首页', href: '/' },
        { label: '新闻', href: '/news' },
        { label: data.title },
      ]}
      title={data.title}
      infoCard={<InfoCard title="基本信息" items={[
        { label: '发布时间', value: data.published_at },
      ]} />}
    >
      <Section title="正文" defaultOpen>
        {data.content}
      </Section>
    </EntryLayout>
  )
}
```

---

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 [vercel.com](https://vercel.com) 导入仓库
3. 在 Vercel 项目设置中配置环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 自动部署完成

---

## License

MIT
