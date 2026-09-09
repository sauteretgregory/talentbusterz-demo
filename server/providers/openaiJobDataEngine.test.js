import assert from 'node:assert/strict'

import {
  createOpenAIJobDataEngineProvider
} from './openaiJobDataEngine.js'

assert.throws(
  () =>
    createOpenAIJobDataEngineProvider({
      apiKey: '',
      model: 'test-model'
    }),
  /OPENAI_API_KEY/
)

assert.throws(
  () =>
    createOpenAIJobDataEngineProvider({
      apiKey: 'fake-key',
      model: ''
    }),
  /OPENAI_MODEL/
)

const fakeClient = {
  responses: {
    async create(request) {
      assert.equal(request.model, 'test-model')
      assert.equal(request.store, false)

      return {
        output_text: JSON.stringify({
          artifact_type: 'canonical_job_data_state',
          artifact_id: 'job_mock_001',
          state_version: 'v1.0',
          validation_report: {
            validation_status: 'passed'
          },
          job_data_state: {
            requirements_explicit: [
              {
                requirement_id: 'req_mock_001',
                requirement: '2 ans d’expérience',
                requirement_type: 'experience_duration',
                evaluation_mode: 'structured_verifiable',
                structured_parameters: {
                  minimum_months: 24
                }
              }
            ]
          }
        })
      }
    }
  }
}

const provider =
  createOpenAIJobDataEngineProvider({
    client: fakeClient,
    model: 'test-model'
  })

await assert.rejects(
  () =>
    provider({
      artifact_type: 'job_data_engine_input_payload',
      input_contract_version: 'v2.0'
    }),
  /unsupported JOB DATA ENGINE input contract/
)

const artifact = await provider({
  artifact_type: 'job_data_engine_input_payload',
  input_contract_version: 'v1.0',
  request_id: 'req_mock_001'
})

assert.equal(
  artifact.artifact_type,
  'canonical_job_data_state'
)

assert.equal(
  artifact.artifact_id,
  'job_mock_001'
)

console.log('✓ OpenAI JOB DATA ENGINE provider tests passed')
console.log('Missing API key: blocked')
console.log('Missing model: blocked')
console.log('Mock canonical output: validated')
