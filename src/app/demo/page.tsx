import EntryLayout from '@/components/EntryLayout'
import Section from '@/components/Section'
import InfoCard from '@/components/InfoCard'
import Tag from '@/components/Tag'

export default function DemoPage() {
  const breadcrumbItems = [
    { label: '首页', href: '/' },
    { label: '示例模块', href: '/demo' },
    { label: '示例词条' },
  ]

  const infoCardItems = [
    { label: '分类', value: '示例分类' },
    { label: '创建人', value: '示例作者' },
    { label: '更新时间', value: '2026-04-14' },
    { label: '状态', value: '已发布' },
  ]

  return (
    <EntryLayout
      breadcrumbItems={breadcrumbItems}
      title="企业知识库示例词条"
      infoCard={<InfoCard title="基本信息" items={infoCardItems} />}
    >
      <Section title="概述" defaultOpen>
        <p>
          这是一段示例概述内容。实际开发新模块时，这里可以放词条的摘要信息、
          关键描述，或者任何需要默认展开显示的重要内容。
        </p>
        <p className="mt-3">
          <Tag label="示例标签1" />
          <Tag label="示例标签2" />
          <Tag label="示例标签3" />
        </p>
      </Section>

      <Section title="详细说明" defaultOpen>
        <p>这里展示的是 Section 组件的用法。每个 Section 都可以独立折叠/展开。</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>支持任意 React 子元素</li>
          <li>默认折叠，可通过 defaultOpen 打开</li>
          <li>适合词条页面的分区结构</li>
        </ul>
      </Section>

      <Section title="相关条目">
        <p>此分区默认折叠。可以放置关联词条、参考资料等次级信息。</p>
      </Section>

      <Section title="开发指引">
        <p className="mb-2">新模块的典型结构：</p>
        <pre className="rounded bg-sec-bg p-3 text-xs overflow-x-auto">
{`src/app/your-module/
├── page.tsx                 // 列表页
└── [id]/
    └── page.tsx             // 详情页（参考本示例）`}
        </pre>
      </Section>
    </EntryLayout>
  )
}