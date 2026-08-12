export const JOB_SOURCE_TYPES = Object.freeze({
  LINKEDIN: 'linkedin',
  FRANCE_TRAVAIL: 'france_travail',
  WELCOME_TO_THE_JUNGLE: 'welcome_to_the_jungle',
  INDEED: 'indeed',
  OTHER: 'other'
})

export function normalizeJobUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('TBZ V3: job URL is required.')
  }

  let url

  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('TBZ V3: invalid job URL.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('TBZ V3: unsupported URL protocol.')
  }

  // Remove tracking parameters but preserve identifiers required by the source.
  const removable = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'trk',
    'trackingId'
  ]

  removable.forEach((key) => url.searchParams.delete(key))

  return url.toString()
}

export function detectJobSource(input) {
  const normalizedUrl = normalizeJobUrl(input)
  const host = new URL(normalizedUrl).hostname
    .replace(/^www\./, '')
    .toLowerCase()

  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    return JOB_SOURCE_TYPES.LINKEDIN
  }

  if (
    host === 'candidat.francetravail.fr' ||
    host.endsWith('.francetravail.fr')
  ) {
    return JOB_SOURCE_TYPES.FRANCE_TRAVAIL
  }

  if (
    host === 'welcometothejungle.com' ||
    host.endsWith('.welcometothejungle.com')
  ) {
    return JOB_SOURCE_TYPES.WELCOME_TO_THE_JUNGLE
  }

  if (host === 'indeed.com' || host.endsWith('.indeed.com')) {
    return JOB_SOURCE_TYPES.INDEED
  }

  return JOB_SOURCE_TYPES.OTHER
}

export function createJobIntakeRequest(input) {
  const sourceUrl = normalizeJobUrl(input)

  return {
    request_type: 'job_url_intake',
    source_url: sourceUrl,
    detected_source: detectJobSource(sourceUrl),
    extraction_status: 'pending',
    job_data_state: null
  }
}
