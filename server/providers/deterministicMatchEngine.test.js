import assert from 'node:assert/strict'

import candidate from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with {
  type: 'json'
}

import job from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with {
  type: 'json'
}

import {
  createDeterministicMatchEngineProvider
} from './deterministicMatchEngine.js'

const provider =
  createDeterministicMatchEngineProvider()

const result =
  await provider({
    candidate_data_state: candidate,
    job_data_state: job
  })

assert.equal(
  result.artifact_type,
  'canonical_match_state'
)

assert.equal(
  result.artifact_id,
  'match_gregory_sauteret_france_travail_210SDTY'
)

assert.equal(
  result.artifact_filename,
  'match_gregory_sauteret_france_travail_210SDTY_v1.0.json'
)

assert.equal(
  result.state_version,
  'v1.0'
)

assert.equal(
  result.engine_name,
  'TBZ_MATCH_ENGINE'
)

assert.equal(
  result.engine_version,
  'V1'
)

assert.equal(
  result.processing_mode,
  'PRODUCTION'
)

assert.equal(
  result.match_id,
  'match_gregory_sauteret_france_travail_210SDTY_v1'
)

assert.equal(
  result.source_alignment.source_job_artifact_id,
  job.artifact_id
)

assert.equal(
  result.source_alignment.source_job_data_state_version,
  job.state_version
)

assert.equal(
  result.source_alignment.source_candidate_artifact_id,
  candidate.artifact_id
)

assert.equal(
  result.source_alignment.source_candidate_data_state_version,
  candidate.state_version
)

assert.equal(
  result.source_alignment.source_states_modified,
  false
)

assert.equal(
  result.input_validation.status,
  'passed'
)

assert.equal(
  result.validation_report.validation_status,
  'passed'
)

assert.equal(
  result.match_state.evaluation_mode,
  'deterministic_v1'
)

assert.equal(
  result.match_state.requirements.length,
  13
)

console.log(
  '✓ Deterministic MATCH provider contract passed'
)

console.log(
  'Artifact:',
  result.artifact_id
)

console.log(
  'Filename:',
  result.artifact_filename
)

console.log(
  'Match ID:',
  result.match_id
)

console.log(
  'Validation:',
  result.validation_report.validation_status
)
