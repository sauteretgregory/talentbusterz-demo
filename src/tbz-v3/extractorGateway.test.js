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

const linkedinUrl =
  'https://www.linkedin.com/jobs/view/4440659619/'

const franceTravailUrl =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

const registry = createExtractorRegistry()

registerExtractor(
  registry,
  'linkedin',
  async ({ source_url }) => ({
    provider_id: 'mock_linkedin_provider',
    raw_job_content: `Mock LinkedIn content from ${source_url}`
  })
)

registerExtractor(
  registry,
  'france_travail',
  async ({ source_url }) => ({
    provider_id: 'mock_france_travail_provider',
    structured_source_data: {
      source_url,
      title: 'Talent Acquisition'
    }
  })
)

const linkedinResult = await extractJobFromIntake(
  createJobIntakeRequest(linkedinUrl),
  registry
)

assert.equal(
  linkedinResult.extraction_status,
  EXTRACTION_STATUS.COMPLETED
)

assert.equal(
  linkedinResult.provider_id,
  'mock_linkedin_provider'
)

assert.ok(linkedinResult.raw_job_content)

const franceTravailResult = await extractJobFromIntake(
  createJobIntakeRequest(franceTravailUrl),
  registry
)

assert.equal(
  franceTravailResult.extraction_status,
  EXTRACTION_STATUS.COMPLETED
)

assert.equal(
  franceTravailResult.provider_id,
  'mock_france_travail_provider'
)

assert.ok(franceTravailResult.structured_source_data)

const emptyRegistry = createExtractorRegistry()

const fallback = await extractJobFromIntake(
  createJobIntakeRequest(linkedinUrl),
  emptyRegistry
)

assert.equal(
  fallback.extraction_status,
  EXTRACTION_STATUS.REQUIRES_FALLBACK
)

assert.equal(
  fallback.error,
  'no_extractor_available'
)

console.log('✓ TBZ V3 extractor gateway tests passed')
console.log('LinkedIn provider:', linkedinResult.provider_id)
console.log(
  'France Travail provider:',
  franceTravailResult.provider_id
)
console.log('Missing provider fallback:', fallback.extraction_status)
