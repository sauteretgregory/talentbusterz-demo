import assert from 'node:assert/strict'

import {
  JOB_SOURCE_TYPES,
  createJobIntakeRequest,
  detectJobSource
} from './jobIntake.js'

const linkedin =
  'https://www.linkedin.com/jobs/view/4440659619/'

const franceTravail =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

assert.equal(
  detectJobSource(linkedin),
  JOB_SOURCE_TYPES.LINKEDIN
)

assert.equal(
  detectJobSource(franceTravail),
  JOB_SOURCE_TYPES.FRANCE_TRAVAIL
)

const request = createJobIntakeRequest(linkedin)

assert.equal(request.request_type, 'job_url_intake')
assert.equal(request.detected_source, 'linkedin')
assert.equal(request.extraction_status, 'pending')
assert.equal(request.job_data_state, null)

assert.throws(
  () => createJobIntakeRequest('pas une url'),
  /invalid job URL/
)

console.log('✓ TBZ V3 job URL intake tests passed')
console.log('LinkedIn:', detectJobSource(linkedin))
console.log('France Travail:', detectJobSource(franceTravail))
