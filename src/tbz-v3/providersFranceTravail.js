const FRANCE_TRAVAIL_HOST = 'candidat.francetravail.fr'

export function extractFranceTravailOfferId(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('TBZ V3: France Travail URL is required.')
  }

  let url

  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('TBZ V3: invalid France Travail URL.')
  }

  const host = url.hostname
    .replace(/^www\./, '')
    .toLowerCase()

  if (
    host !== FRANCE_TRAVAIL_HOST &&
    !host.endsWith('.francetravail.fr')
  ) {
    throw new Error('TBZ V3: URL is not a France Travail URL.')
  }

  const match = url.pathname.match(
    /\/offres\/recherche\/detail\/([^/?#]+)/
  )

  if (!match?.[1]) {
    throw new Error(
      'TBZ V3: France Travail offer identifier not found.'
    )
  }

  return decodeURIComponent(match[1])
}

export function createFranceTravailProviderRequest(input) {
  const offerId = extractFranceTravailOfferId(input)

  return {
    provider_id: 'france_travail',
    provider_request_type: 'job_offer_lookup',
    offer_id: offerId,
    source_url: new URL(input.trim()).toString(),
    network_status: 'not_configured',
    authentication_required: true,
    endpoint: null,
    credentials_present: false
  }
}

export async function franceTravailExtractor({ source_url }) {
  const providerRequest =
    createFranceTravailProviderRequest(source_url)

  return {
    provider_id: 'france_travail',
    provider_payload: providerRequest,
    raw_job_content: null,
    structured_source_data: null
  }
}
