import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CandidateMemoryRepositoryConflictError,
  assertCandidateMemoryRepository
} from './candidateMemoryRepository.js'
import { createMemoryCandidateMemoryRepository } from './memoryCandidateMemoryRepository.js'
import { createSqliteCandidateMemoryRepository } from './sqliteCandidateMemoryRepository.js'

const candidate = (version, candidateId = 'candidate-contract-test') => ({
  artifact_type: 'canonical_candidate_data_state',
  artifact_filename: `candidate_${candidateId}_${version}.json`,
  state_version: version,
  engine_name: 'TBZ_CANDIDATE_DATA_ENGINE',
  candidate_data_state: {
    candidate_id: candidateId,
    state_version: version,
    profile_status: 'contract_test'
  }
})

const adapters = [
  {
    name: 'memory',
    create: () => createMemoryCandidateMemoryRepository(),
    close: () => {}
  },
  {
    name: 'sqlite',
    create: () => createSqliteCandidateMemoryRepository({ filename: ':memory:' }),
    close: (repository) => repository.close()
  }
]

for (const adapter of adapters) {
  test(`${adapter.name} adapter satisfies CandidateMemoryRepository contract v0`, async () => {
    const repository = adapter.create()

    try {
      assertCandidateMemoryRepository(repository)

      assert.equal(await repository.get('candidate-contract-test'), null)

      const initial = candidate('v1.0')
      const created = await repository.save('candidate-contract-test', initial)

      assert.equal(created.candidate_id, 'candidate-contract-test')
      assert.equal(created.status, 'persisted')
      assert.equal(created.state_version, 'v1.0')
      assert.equal(created.created, true)
      assert.deepEqual(await repository.get('candidate-contract-test'), initial)

      const next = candidate('v1.1')
      const updated = await repository.save(
        'candidate-contract-test',
        next,
        'v1.0'
      )

      assert.equal(updated.candidate_id, 'candidate-contract-test')
      assert.equal(updated.status, 'persisted')
      assert.equal(updated.state_version, 'v1.1')
      assert.equal(updated.created, false)
      assert.deepEqual(await repository.get('candidate-contract-test'), next)

      const stale = candidate('v1.2')
      await assert.rejects(
        repository.save(
          'candidate-contract-test',
          stale,
          'v1.0'
        ),
        (error) => {
          assert.ok(error instanceof CandidateMemoryRepositoryConflictError)
          assert.equal(error.code, 'CANDIDATE_MEMORY_VERSION_CONFLICT')
          assert.equal(error.candidateId, 'candidate-contract-test')
          assert.equal(error.expectedVersion, 'v1.0')
          assert.equal(error.actualVersion, 'v1.1')
          return true
        }
      )

      assert.deepEqual(await repository.get('candidate-contract-test'), next)

      const forced = candidate('v1.3')
      const forcedResult = await repository.save(
        'candidate-contract-test',
        forced
      )

      assert.equal(forcedResult.status, 'persisted')
      assert.equal(forcedResult.state_version, 'v1.3')
      assert.equal(forcedResult.created, false)
      assert.deepEqual(await repository.get('candidate-contract-test'), forced)

      await assert.rejects(
        repository.save('candidate-contract-test', candidate('v1.4'), 'v0.0'),
        (error) => {
          assert.ok(error instanceof CandidateMemoryRepositoryConflictError)
          assert.equal(error.code, 'CANDIDATE_MEMORY_VERSION_CONFLICT')
          assert.equal(error.expectedVersion, 'v0.0')
          assert.equal(error.actualVersion, 'v1.3')
          return true
        }
      )
    } finally {
      adapter.close(repository)
    }
  })
}
