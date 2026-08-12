import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createArtifactStore,
  ingestCanonicalArtifact
} from './artifactStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadJson(name) {
  const file = path.join(
    __dirname,
    'fixtures',
    'doctrine',
    name
  )

  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const candidate = loadJson('candidate.json')
const job = loadJson('job.json')
const match = loadJson('match.json')
const probePlan = loadJson('probe-plan.json')

let store = createArtifactStore()

store = ingestCanonicalArtifact(store, candidate)
store = ingestCanonicalArtifact(store, job)
store = ingestCanonicalArtifact(store, match)
store = ingestCanonicalArtifact(store, probePlan)

assert.equal(
  store.candidate.artifact_type,
  'canonical_candidate_data_state'
)

assert.equal(
  store.job.artifact_type,
  'canonical_job_data_state'
)

assert.equal(
  store.match.artifact_type,
  'canonical_match_state'
)

assert.equal(
  store.probePlan.artifact_type,
  'canonical_probe_plan'
)

assert.equal(
  store.match.source_artifacts.job.artifact_id,
  store.job.artifact_id
)

assert.equal(
  store.match.source_artifacts.candidate.artifact_id,
  store.candidate.artifact_id
)

assert.equal(
  store.match.source_artifacts.job.state_version,
  store.job.state_version
)

assert.equal(
  store.match.source_artifacts.candidate.state_version,
  store.candidate.state_version
)

console.log('✓ Doctrine V3 fixture ingestion passed')
console.log('Candidate:', store.candidate.artifact_id)
console.log('Job:', store.job.artifact_id)
console.log('Match:', store.match.artifact_id)
console.log('Probe:', store.probePlan.artifact_id)
