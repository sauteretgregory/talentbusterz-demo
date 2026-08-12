import assert from 'node:assert/strict'

import {
  ENGINE_IDS
} from './engineGateway.js'

import {
  createTbzEngineRegistry
} from './engineRegistry.js'

const emptyRegistry =
  createTbzEngineRegistry({
    openaiApiKey: '',
    openaiModel: ''
  })

assert.equal(
  emptyRegistry.has(ENGINE_IDS.JOB_DATA),
  false
)

const fakeClient = {
  responses: {
    async create() {
      return {
        output_text: JSON.stringify({
          artifact_type: 'canonical_job_data_state',
          artifact_id: 'job_registry_test',
          state_version: 'v1.0',
          validation_report: {
            validation_status: 'passed'
          }
        })
      }
    }
  }
}

const configuredRegistry =
  createTbzEngineRegistry({
    openaiModel: 'test-model',
    openaiClient: fakeClient
  })

assert.equal(
  configuredRegistry.has(ENGINE_IDS.JOB_DATA),
  true
)

console.log('✓ TBZ engine registry tests passed')
console.log(
  'JOB DATA without OpenAI config:',
  emptyRegistry.has(ENGINE_IDS.JOB_DATA)
)
console.log(
  'JOB DATA with OpenAI config:',
  configuredRegistry.has(ENGINE_IDS.JOB_DATA)
)
