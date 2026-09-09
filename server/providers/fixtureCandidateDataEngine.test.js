import assert from 'node:assert/strict'

import {
  createFixtureCandidateDataEngineProvider
} from './fixtureCandidateDataEngine.js'

const candidateEngine =
  createFixtureCandidateDataEngineProvider()

const result =
  await candidateEngine()

assert.equal(
  result.artifact_type,
  'canonical_candidate_data_state'
)

assert.equal(
  result.artifact_id,
  'candidate_gregory_sauteret_v1'
)

assert.equal(
  result.engine_name,
  'TBZ_CANDIDATE_DATA_ENGINE'
)

assert.equal(
  result.engine_version,
  'V1'
)

assert.equal(
  result.state_version,
  'v1.3_probe_response_integration'
)

assert.equal(
  result.artifact_filename,
  'candidate_gregory_sauteret_v1.3.json'
)

assert.equal(
  result.candidate_data_state.candidate_id,
  'candidate_gregory_sauteret_v1'
)

assert.equal(
  result.candidate_data_state.contract_compatibility.schema_locked,
  true
)

assert.equal(
  result.validation_report.validation_status,
  'passed'
)

const supplied =
  await candidateEngine({ candidate_data_state: result })

assert.notEqual(
  supplied,
  result
)

assert.deepEqual(
  supplied,
  result
)

await assert.rejects(
  () => candidateEngine({ candidate_data_state: { artifact_type: 'wrong' } }),
  /canonical candidate state is required/
)

console.log('✓ Fixture CANDIDATE DATA ENGINE contract passed')
console.log('CANDIDATE:', result.artifact_id)
console.log('CANDIDATE version:', result.state_version)
