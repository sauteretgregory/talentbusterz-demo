import {
  extractFranceTravailOfferId
} from '../../src/tbz-v3/providersFranceTravail.js'

import {
  parseFranceTravailHtml
} from './franceTravailHtmlParser.js'

export async function fetchFranceTravailPublicJob(
  sourceUrl,
  { fetchImpl = fetch } = {}
) {
  const offerId = extractFranceTravailOfferId(sourceUrl)

  const response = await fetchImpl(sourceUrl, {
    headers: {
      'User-Agent':
        'TalentBusterZ/3.0 job-intake (+public-job-offer-reader)',
      'Accept':
        'text/html,application/xhtml+xml'
    }
  })

  if (!response.ok) {
    throw new Error(
      `France Travail public fetch failed: HTTP ${response.status}`
    )
  }

  const html = await response.text()

  if (!html || html.length < 100) {
    throw new Error(
      'France Travail public fetch returned insufficient content.'
    )
  }

  const parsed = parseFranceTravailHtml(html)

  return {
    provider_id: 'france_travail_public_html',
    provider_payload: {
      offer_id: offerId,
      source_url: sourceUrl,
      http_status: response.status,
      content_type:
        response.headers.get('content-type') || null,
      parser_id: parsed.parser_id,
      parser_version: parsed.parser_version
    },
    raw_job_content: parsed.raw_job_content,
    structured_source_data:
      parsed.structured_source_data
  }
}
