import fs from 'node:fs'
import path from 'node:path'

import {
  fetchFranceTravailPublicJob
} from './providers/franceTravailPublic.js'

import {
  createJobEngineInputPayload,
  canJobEngineProcess
} from '../src/tbz-v3/jobEngineInput.js'

const url =
  'https://candidat.francetravail.fr/offres/recherche/detail/210SDTY'

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
    structured_source_data: extraction.structured_source_data,
    error: null
  },
  requestId: 'req_ft_210SDTY_create'
})

payload.received_at = new Date().toISOString()

if (!canJobEngineProcess(payload)) {
  throw new Error(
    'TBZ V3: generated JOB DATA ENGINE payload is not processable.'
  )
}

const output =
  path.resolve(
    'server/output/job_data_engine_input_210SDTY.json'
  )

fs.writeFileSync(
  output,
  JSON.stringify(payload, null, 2),
  'utf8'
)

console.log('✓ JOB DATA ENGINE input generated')
console.log('File:', output)
console.log('Artifact:', payload.artifact_type)
console.log('Contract:', payload.input_contract_version)
console.log('Provider:', payload.source.provider)
console.log('Extraction:', payload.extraction.status)
console.log('Processable:', canJobEngineProcess(payload))
