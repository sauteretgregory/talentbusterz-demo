import {
  fetchFranceTravailPublicJob
} from './franceTravailPublic.js'

const url =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

try {
  const result = await fetchFranceTravailPublicJob(url)

  console.log('✓ France Travail live fetch succeeded')
  console.log('Offer ID:', result.provider_payload.offer_id)
  console.log('HTTP:', result.provider_payload.http_status)
  console.log('Content-Type:', result.provider_payload.content_type)
  console.log('HTML length:', result.raw_job_content.length)
  console.log(
    'Contains 210SDTY:',
    result.raw_job_content.includes('210SDTY')
  )
} catch (error) {
  console.error('✗ France Travail live fetch failed')
  console.error(error.message)
  process.exitCode = 1
}
