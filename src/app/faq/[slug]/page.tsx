import EntryLayout from '@/components/EntryLayout'
import Section from '@/components/Section'
import InfoCard from '@/components/InfoCard'
import { supabase } from '@/lib/supabase'
import DeleteFAQButton from '@/components/DeleteFAQButton'

export default async function FAQDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: faq, error } = await supabase
    .from('faq')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !faq) {
    return <div className="mx-auto max-w-5xl px-6 py-10">未找到这条 FAQ。</div>
  }

  const breadcrumbItems = [
    { label: '首页', href: '/' },
    { label: 'FAQ', href: '/faq' },
    { label: faq.question },
  ]

  const infoCardItems = [
    { label: '分类', value: faq.category ?? '' },
    {
      label: '更新时间',
      value: faq.updated_at ? String(faq.updated_at).slice(0, 10) : '',
    },
  ]

  return (
    <EntryLayout
      breadcrumbItems={breadcrumbItems}
      title={faq.question}
      infoCard={<InfoCard title="FAQ 信息" items={infoCardItems} />}
    >
      <div className="mb-6">
        <a href="/faq" className="text-sm text-link hover:underline">
          ← 返回 FAQ 列表
        </a>
      </div>

      <Section title="回答" defaultOpen>
        <p>{faq.answer}</p>
      </Section>
    </EntryLayout>
  )
}