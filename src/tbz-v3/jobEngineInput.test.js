import assert from 'node:assert/strict'

import {
  createExtractorRegistry,
  registerExtractor,
  extractJobFromIntake,
  EXTRACTION_STATUS
} from './extractorGateway.js'

import {
  createJobIntakeRequest
} from './jobIntake.js'

import {
  createJobEngineInputPayload,
  canJobEngineProcess
} from './jobEngineInput.js'

import {
  JOB_ENGINE_INPUT_ARTIFACT_TYPE,
  JOB_ENGINE_INPUT_CONTRACT_VERSION,
  assertJobEngineInputPayload
} from './contracts/jobEngineInputContract.js'

const franceTravailUrl =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

const registry = createExtractorRegistry()

registerExtractor(
  registry,
  'france_travail',
  async ({ source_url }) => ({
    provider_id: 'mock_france_travail_provider',
    raw_job_content: 'Talent Acquisition Manager - offre de test',
    structured_source_data: {
      title: 'Talent Acquisition Manager',
      company: 'Entreprise test',
      source_url
    }
  })
)

const intake = createJobIntakeRequest(franceTravailUrl)

const extraction = await extractJobFromIntake(
  intake,
  registry
)

const payload = createJobEngineInputPayload({
  extractionResult: extraction,
  requestId: 'req_france_travail_001'
})

assert.equal(
  payload.artifact_type,
  JOB_ENGINE_INPUT_ARTIFACT_TYPE
)

assert.equal(
  payload.input_contract_version,
  JOB_ENGINE_INPUT_CONTRACT_VERSION
)

assert.equal(assertJobEngineInputPayload(payload), payload)

assert.throws(
  () =>
    assertJobEngineInputPayload({
      artifact_type: JOB_ENGINE_INPUT_ARTIFACT_TYPE,
      input_contract_version: 'v2.0'
    }),
  /unsupported JOB DATA ENGINE input contract/
)

assert.equal(
  payload.operation,
  'create'
)

assert.equal(
  payload.source.source_type,
  'url'
)

assert.equal(
  payload.source.provider,
  'france_travail'
)

assert.equal(
  payload.source.provenance.url,
  franceTravailUrl
)

assert.equal(
  payload.extraction.status,
  'success'
)

assert.equal(
  payload.extraction.gateway.gateway_name,
  'TBZ_EXTRACTOR_GATEWAY'
)

assert.ok(payload.raw_job_content)
assert.ok(payload.structured_extraction)

assert.equal(
  canJobEngineProcess(payload),
  true
)

const failedExtraction = {
  extraction_status: EXTRACTION_STATUS.FAILED,
  source_url: franceTravailUrl,
  detected_source: 'france_travail',
  provider_id: null,
  raw_job_content: null,
  structured_source_data: null,
  error: 'blocked'
}

const failedPayload = createJobEngineInputPayload({
  extractionResult: failedExtraction,
  requestId: 'req_failed_001'
})

assert.equal(
  failedPayload.extraction.status,
  'failed'
)

assert.equal(
  canJobEngineProcess(failedPayload),
  false
)

console.log('✓ TBZ V3 Job Engine input adapter tests passed')
console.log('Payload type:', payload.artifact_type)
console.log('Contract:', payload.input_contract_version)
console.log('Provider:', payload.source.provider)
console.log('Processable:', canJobEngineProcess(payload))
