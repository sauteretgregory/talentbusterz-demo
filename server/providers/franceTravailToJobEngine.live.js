import {
  fetchFranceTravailPublicJob
} from './franceTravailPublic.js'

import {
  createJobEngineInputPayload,
  canJobEngineProcess
} from '../../src/tbz-v3/jobEngineInput.js'

const url =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

try {
  const extraction =
    await fetchFranceTravailPublicJob(url)

  const payload = createJobEngineInputPayload({
    extractionResult: {
      extraction_status: 'completed',
      source_url: url,
      detected_source: 'france_travail',
      provider_id: extraction.provider_id,
      provider_payload: extraction.provider_payload,
      raw_job_content: extraction.raw_job_content,
      structured_source_data:
        extraction.structured_source_data,
      error: null
    },
    requestId: 'req_ft_live_210SDTY'
  })

  console.log('✓ France Travail → JOB DATA ENGINE payload passed')
  console.log(
    'Offer ID:',
    payload.provider_payload.offer_id
  )
  console.log(
    'Provider:',
    payload.extraction.provider
  )
  console.log(
    'Extraction:',
    payload.extraction.status
  )
  console.log(
    'Raw content length:',
    payload.raw_job_content.length
  )
  console.log(
    'Processable:',
    canJobEngineProcess(payload)
  )

  console.log('\n--- JOB CONTENT PREVIEW ---\n')
  console.log(
    payload.raw_job_content.slice(0, 1800)
  )
} catch (error) {
  console.error(
    '✗ France Travail → JOB DATA ENGINE payload failed'
  )
  console.error(error.message)
  process.exitCode = 1
}
