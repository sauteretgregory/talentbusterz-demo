import assert from 'node:assert/strict'

import {
  ENGINE_IDS,
  createEngineRegistry,
  registerEngineProvider,
  executeEngine
} from './engineGateway.js'

const registry = createEngineRegistry()

const missing = await executeEngine(
  registry,
  ENGINE_IDS.JOB_DATA,
  {}
)

assert.equal(
  missing.status,
  'engine_not_configured'
)

registerEngineProvider(
  registry,
  ENGINE_IDS.JOB_DATA,
  async (input) => ({
    artifact_type: 'canonical_job_data_state',
    artifact_id: 'job_test',
    state_version: 'v1.0',
    source_request_id: input.request_id
  })
)

const result = await executeEngine(
  registry,
  ENGINE_IDS.JOB_DATA,
  {
    artifact_type: 'job_data_engine_input_payload',
    request_id: 'req_test_001'
  }
)

assert.equal(result.status, 'completed')

assert.equal(
  result.output_artifact.artifact_type,
  'canonical_job_data_state'
)

assert.equal(
  result.output_artifact.source_request_id,
  'req_test_001'
)

console.log('✓ TBZ engine gateway tests passed')
console.log('Missing provider:', missing.status)
console.log('Configured provider:', result.status)
console.log(
  'Output:',
  result.output_artifact.artifact_type
)
