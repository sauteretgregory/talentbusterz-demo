import assert from 'node:assert/strict'

import {
  extractJobFromIntake,
  EXTRACTION_STATUS
} from './extractorGateway.js'

import {
  createJobIntakeRequest
} from './jobIntake.js'

import {
  createTbzExtractorRegistry
} from './extractorRegistry.js'

import {
  createJobEngineInputPayload,
  canJobEngineProcess
} from './jobEngineInput.js'

const url =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

const intake = createJobIntakeRequest(url)
const registry = createTbzExtractorRegistry()

const extraction = await extractJobFromIntake(
  intake,
  registry
)

assert.equal(
  extraction.extraction_status,
  EXTRACTION_STATUS.REQUIRES_FALLBACK
)

assert.equal(
  extraction.provider_id,
  'france_travail'
)

assert.equal(
  extraction.provider_payload.offer_id,
  '210SDTY'
)

assert.equal(
  extraction.provider_payload.network_status,
  'not_configured'
)

assert.equal(
  extraction.raw_job_content,
  null
)

assert.equal(
  extraction.structured_source_data,
  null
)

const payload = createJobEngineInputPayload({
  extractionResult: extraction,
  requestId: 'req_ft_210SDTY'
})

assert.equal(
  payload.artifact_type,
  'job_data_engine_input_payload'
)

assert.equal(
  payload.provider_payload.offer_id,
  '210SDTY'
)

assert.equal(
  payload.extraction.status,
  'partial'
)

assert.equal(
  canJobEngineProcess(payload),
  false
)

console.log('✓ France Travail V3 pipeline routing passed')
console.log('Offer ID:', extraction.provider_payload.offer_id)
console.log('Extraction:', extraction.extraction_status)
console.log('Network:', extraction.provider_payload.network_status)
console.log('JOB DATA ENGINE processable:', canJobEngineProcess(payload))
