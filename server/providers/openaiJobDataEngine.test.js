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
