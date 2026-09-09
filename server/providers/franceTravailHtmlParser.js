function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function stripTags(html = '') {
  return decodeHtmlEntities(
    String(html)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
}

function normalizeWhitespace(text = '') {
  return String(text)
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseFranceTravailHtml(html) {
  if (!html || typeof html !== 'string') {
    throw new Error('TBZ V3: France Travail HTML is required.')
  }

  if (html.length < 100) {
    throw new Error(
      'TBZ V3: France Travail HTML content is insufficient.'
    )
  }

  const text = normalizeWhitespace(stripTags(html))

  if (text.length < 100) {
    throw new Error(
      'TBZ V3: France Travail parsed content is insufficient.'
    )
  }

  return {
    parser_id: 'france_travail_public_html_parser',
    parser_version: 'v1',
    raw_job_content: text,
    structured_source_data: null
  }
}
