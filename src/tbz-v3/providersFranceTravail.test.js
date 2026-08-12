import assert from 'node:assert/strict'

import {
  extractFranceTravailOfferId,
  createFranceTravailProviderRequest
} from './providersFranceTravail.js'

const url =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

assert.equal(
  extractFranceTravailOfferId(url),
  '210SDTY'
)

const request =
  createFranceTravailProviderRequest(url)

assert.equal(
  request.provider_id,
  'france_travail'
)

assert.equal(
  request.provider_request_type,
  'job_offer_lookup'
)

assert.equal(
  request.offer_id,
  '210SDTY'
)

assert.equal(
  request.network_status,
  'not_configured'
)

assert.equal(
  request.authentication_required,
  true
)

assert.equal(
  request.endpoint,
  null
)

assert.equal(
  request.credentials_present,
  false
)

assert.throws(
  () =>
    extractFranceTravailOfferId(
      'https://www.linkedin.com/jobs/view/4440659619/'
    ),
  /not a France Travail URL/
)

assert.throws(
  () =>
    extractFranceTravailOfferId(
      'https://candidat.francetravail.fr/offres/recherche/'
    ),
  /offer identifier not found/
)

console.log('✓ TBZ V3 France Travail provider tests passed')
console.log('Offer ID:', request.offer_id)
console.log('Network:', request.network_status)
console.log('Endpoint configured:', Boolean(request.endpoint))
