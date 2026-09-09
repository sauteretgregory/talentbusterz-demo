import {
  fetchFranceTravailPublicJob
} from './franceTravailPublic.js'

import {
  parseFranceTravailHtml
} from './franceTravailHtmlParser.js'

const url =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

try {
  const fetched = await fetchFranceTravailPublicJob(url)

  const parsed = parseFranceTravailHtml(
    fetched.raw_job_content
  )

  console.log('✓ France Travail live fetch + parse succeeded')
  console.log('Offer ID:', fetched.provider_payload.offer_id)
  console.log('HTML length:', fetched.raw_job_content.length)
  console.log('Parsed length:', parsed.raw_job_content.length)

  const checks = [
    '210SDTY',
    'Talent Acquisition',
    'Description',
    'Expérience',
    'Compétences'
  ]

  for (const term of checks) {
    console.log(
      `${term}:`,
      parsed.raw_job_content
        .toLowerCase()
        .includes(term.toLowerCase())
    )
  }

  console.log('\n--- PREVIEW ---\n')
  console.log(
    parsed.raw_job_content.slice(0, 2500)
  )
} catch (error) {
  console.error('✗ France Travail live parse failed')
  console.error(error.message)
  process.exitCode = 1
}
