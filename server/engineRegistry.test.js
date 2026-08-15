import assert from 'node:assert/strict'

import {
  ENGINE_IDS
} from './engineGateway.js'

import {
  createTbzEngineRegistry
} from './engineRegistry.js'

const fixtureRegistry =
  createTbzEngineRegistry({
    engineMode: 'fixture'
  })

assert.equal(
  fixtureRegistry.has(ENGINE_IDS.CANDIDATE),
  true
)

assert.equal(
  fixtureRegistry.has(ENGINE_IDS.JOB_DATA),
  true
)

const emptyOpenAIRegistry =
  createTbzEngineRegistry({
    engineMode: 'openai',
    openaiApiKey: '',
    openaiModel: ''
  })

assert.equal(
  emptyOpenAIRegistry.has(ENGINE_IDS.CANDIDATE),
  true
)

assert.equal(
  emptyOpenAIRegistry.has(ENGINE_IDS.JOB_DATA),
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

const configuredOpenAIRegistry =
  createTbzEngineRegistry({
    engineMode: 'openai',
    openaiModel: 'test-model',
    openaiClient: fakeClient
  })

assert.equal(
  configuredOpenAIRegistry.has(ENGINE_IDS.CANDIDATE),
  true
)

assert.equal(
  configuredOpenAIRegistry.has(ENGINE_IDS.JOB_DATA),
  true
)

assert.throws(
  () =>
    createTbzEngineRegistry({
      engineMode: 'unknown'
    }),
  /unsupported engine mode/
)

console.log('✓ TBZ engine mode registry tests passed')
console.log(
  'Fixture CANDIDATE DATA:',
  fixtureRegistry.has(ENGINE_IDS.CANDIDATE)
)
console.log(
  'Fixture JOB DATA:',
  fixtureRegistry.has(ENGINE_IDS.JOB_DATA)
)
console.log(
  'OpenAI without config:',
  emptyOpenAIRegistry.has(ENGINE_IDS.JOB_DATA)
)
console.log(
  'OpenAI configured:',
  configuredOpenAIRegistry.has(ENGINE_IDS.JOB_DATA)
)
