import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryCandidateMemoryRepository } from './memoryCandidateMemoryRepository.js'

const candidate = (version, extra = {}) => ({
  artifact_type: 'canonical_candidate_data_state',
  state_version: version,
  candidate_data_state: {
    candidate_id: 'candidate-test',
    state_version: version,
    ...extra
  }
})

test('memory repository persists and returns an isolated clone', async () => {
  const repository = createMemoryCandidateMemoryRepository()
  const state = candidate('v1.3_probe_response_integration')

  const saved = await repository.save('candidate-test', state)
  assert.equal(saved.status, 'persisted')
  assert.equal(saved.state_version, state.state_version)

  const loaded = await repository.get('candidate-test')
  assert.deepEqual(loaded, state)

  loaded.candidate_data_state.mutated_after_get = true
  const reloaded = await repository.get('candidate-test')
  assert.equal(reloaded.candidate_data_state.mutated_after_get, undefined)
})

test('memory repository accepts the current expected version', async () => {
  const repository = createMemoryCandidateMemoryRepository([
    candidate('v1.3_probe_response_integration')
  ])

  await assert.doesNotReject(() => repository.save(
    'candidate-test',
    candidate('v1.4_probe_response_integration'),
    'v1.3_probe_response_integration'
  ))

  const loaded = await repository.get('candidate-test')
  assert.equal(loaded.state_version, 'v1.4_probe_response_integration')
})

test('memory repository rejects a stale expected version without changing state', async () => {
  const repository = createMemoryCandidateMemoryRepository([
    candidate('v1.4_probe_response_integration')
  ])

  await assert.rejects(
    () => repository.save(
      'candidate-test',
      candidate('v1.5_probe_response_integration'),
      'v1.3_probe_response_integration'
    ),
    (error) => error.code === 'CANDIDATE_MEMORY_CONFLICT' &&
      error.expectedVersion === 'v1.3_probe_response_integration' &&
      error.currentVersion === 'v1.4_probe_response_integration'
  )

  const loaded = await repository.get('candidate-test')
  assert.equal(loaded.state_version, 'v1.4_probe_response_integration')
})

test('memory repository permits initial save with no expected version', async () => {
  const repository = createMemoryCandidateMemoryRepository()
  const state = candidate('v1.3_probe_response_integration')
  await repository.save('candidate-test', state)
  assert.equal((await repository.get('candidate-test')).state_version, state.state_version)
})
