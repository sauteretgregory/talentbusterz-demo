import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CandidateMemoryRepositoryConflictError,
  SqliteCandidateMemoryRepository
} from './sqliteCandidateMemoryRepository.js'

function createRepository() {
  return new SqliteCandidateMemoryRepository({ filename: ':memory:' })
}

function candidateState(version = 'v1.3_probe_response_integration') {
  return {
    artifact_type: 'canonical_candidate_data_state',
    artifact_filename: `candidate_test_${version}.json`,
    state_version: version,
    engine_name: 'TBZ_CANDIDATE_DATA_ENGINE',
    candidate_data_state: {
      candidate_id: 'candidate_test',
      state_version: version,
      profile_status: 'probe_enriched_with_candidate_answers'
    }
  }
}

test('sqlite repository saves and reloads the complete candidate state', async () => {
  const repository = createRepository()
  const state = candidateState()

  try {
    const saved = await repository.save('candidate_test', state)
    const loaded = await repository.get('candidate_test')

    assert.equal(saved.candidate_id, 'candidate_test')
    assert.equal(saved.state_version, 'v1.3_probe_response_integration')
    assert.equal(saved.created, true)
    assert.deepEqual(loaded, state)
  } finally {
    repository.close()
  }
})

test('sqlite repository accepts a matching expected version and updates atomically', async () => {
  const repository = createRepository()
  const initial = candidateState('v1.3_probe_response_integration')
  const next = candidateState('v1.4_probe_response_integration')

  try {
    await repository.save('candidate_test', initial)
    const saved = await repository.save(
      'candidate_test',
      next,
      'v1.3_probe_response_integration'
    )

    assert.equal(saved.created, false)
    assert.equal(saved.state_version, 'v1.4_probe_response_integration')
    assert.deepEqual(await repository.get('candidate_test'), next)
  } finally {
    repository.close()
  }
})

test('sqlite repository rejects a stale expected version without overwriting committed state', async () => {
  const repository = createRepository()
  const initial = candidateState('v1.3_probe_response_integration')
  const committed = candidateState('v1.4_probe_response_integration')
  const staleWrite = candidateState('v1.5_probe_response_integration')

  try {
    await repository.save('candidate_test', initial)
    await repository.save('candidate_test', committed, initial.state_version)

    await assert.rejects(
      repository.save('candidate_test', staleWrite, initial.state_version),
      (error) => {
        assert.ok(error instanceof CandidateMemoryRepositoryConflictError)
        assert.equal(error.code, 'CANDIDATE_MEMORY_VERSION_CONFLICT')
        assert.equal(error.expectedVersion, initial.state_version)
        assert.equal(error.actualVersion, committed.state_version)
        return true
      }
    )

    assert.deepEqual(await repository.get('candidate_test'), committed)
  } finally {
    repository.close()
  }
})

test('sqlite repository refuses an expected-version insert when no candidate exists', async () => {
  const repository = createRepository()
  const state = candidateState()

  try {
    await assert.rejects(
      repository.save('candidate_test', state, 'v0.0'),
      CandidateMemoryRepositoryConflictError
    )
    assert.equal(await repository.get('candidate_test'), null)
  } finally {
    repository.close()
  }
})

test('sqlite repository supports reopening a file-backed database', async () => {
  const path = `/tmp/tbz-candidate-memory-${process.pid}-${Date.now()}.sqlite`
  const state = candidateState()

  const first = new SqliteCandidateMemoryRepository({ filename: path })
  await first.save('candidate_test', state)
  first.close()

  const second = new SqliteCandidateMemoryRepository({ filename: path })
  try {
    assert.deepEqual(await second.get('candidate_test'), state)
  } finally {
    second.close()
  }
})
