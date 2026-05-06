export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

export function cleanInlineText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toAbsoluteUrl(url: string | undefined, baseUrl: string) {
  if (!url) return null

  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return null
  }
}
