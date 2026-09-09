import assert from 'node:assert/strict'

import {
  fetchFranceTravailPublicJob
} from './franceTravailPublic.js'

const url =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

const fakeHtml = `
<!doctype html>
<html>
  <body>
    <h1>Talent Acquisition Manager</h1>
    <p>Offre France Travail de test suffisamment longue pour valider le provider.</p>
    <p>Contrat, missions, expérience, localisation, compétences et informations diverses.</p>
  </body>
</html>
`

const fakeFetch = async (requestedUrl, options) => {
  assert.equal(requestedUrl, url)
  assert.ok(options.headers['User-Agent'])

  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        if (name === 'content-type') {
          return 'text/html; charset=utf-8'
        }
        return null
      }
    },
    async text() {
      return fakeHtml
    }
  }
}

const result = await fetchFranceTravailPublicJob(
  url,
  { fetchImpl: fakeFetch }
)

assert.equal(
  result.provider_id,
  'france_travail_public_html'
)

assert.equal(
  result.provider_payload.offer_id,
  '210SDTY'
)

assert.equal(
  result.provider_payload.http_status,
  200
)

assert.ok(
  result.raw_job_content.includes(
    'Talent Acquisition Manager'
  )
)

assert.equal(
  result.structured_source_data,
  null
)

console.log('✓ France Travail public provider mock test passed')
console.log('Offer ID:', result.provider_payload.offer_id)
console.log('HTTP:', result.provider_payload.http_status)
console.log('Raw HTML:', Boolean(result.raw_job_content))
