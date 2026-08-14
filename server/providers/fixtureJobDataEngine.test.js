import assert from 'node:assert/strict'

import {
  createFixtureJobDataEngineProvider
} from './fixtureJobDataEngine.js'

const provider =
  createFixtureJobDataEngineProvider()

const result = await provider({
  artifact_type: 'job_data_engine_input_payload',
  input_contract_version: 'v1.0',
  provider_payload: {
    offer_id: '210SDTY'
  }
})

assert.equal(
  result.artifact_type,
  'canonical_job_data_state'
)

assert.equal(
  result.artifact_id,
  'job_france_travail_talent_acquisition_210SDTY'
)

assert.equal(
  result.state_version,
  'v1.0'
)

assert.equal(
  result.validation_report.validation_status,
  'passed'
)

await assert.rejects(
  () =>
    provider({
      artifact_type: 'job_data_engine_input_payload',
      input_contract_version: 'v1.0',
      provider_payload: {
        offer_id: 'UNKNOWN'
      }
    }),
  /no fixture/
)

await assert.rejects(
  () =>
    provider({
      artifact_type: 'job_data_engine_input_payload',
      input_contract_version: 'v2.0',
      provider_payload: {
        offer_id: '210SDTY'
      }
    }),
  /unsupported JOB DATA ENGINE input contract/
)

console.log('✓ Fixture JOB DATA ENGINE tests passed')
console.log('Artifact:', result.artifact_id)
console.log('Version:', result.state_version)
console.log(
  'Validation:',
  result.validation_report.validation_status
)
