interface TagProps {
  label: string
}

export default function Tag({ label }: TagProps) {
  return (
    <span className="inline-block bg-tag-bg text-sub px-2.5 py-0.5 rounded text-xs mr-1 mb-0.5">
      {label}
    </span>
  )
}
