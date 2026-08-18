import {
  assertCandidateMemoryRepository,
  CandidateMemoryRepositoryConflictError
} from './candidateMemoryRepository.js'

export class MemoryCandidateMemoryRepository {
  #states = new Map()

  constructor(initialStates = []) {
    for (const state of initialStates) {
      const candidateId = state?.candidate_id || state?.candidate_data_state?.candidate_id
      if (!candidateId) throw new Error('TBZ memory repository: candidate_id is required.')
      this.#states.set(candidateId, structuredClone(state))
    }
  }

  async get(candidateId) {
    if (!candidateId) throw new Error('TBZ memory repository: candidateId is required.')
    const state = this.#states.get(candidateId)
    return state ? structuredClone(state) : null
  }

  async save(candidateId, candidateState, expectedVersion = null) {
    if (!candidateId) throw new Error('TBZ memory repository: candidateId is required.')
    if (!candidateState || typeof candidateState !== 'object') {
      throw new Error('TBZ memory repository: candidateState is required.')
    }

    const current = this.#states.get(candidateId) || null
    const currentVersion = current?.state_version ?? current?.candidate_data_state?.state_version ?? null

    if (expectedVersion !== null && expectedVersion !== undefined && String(expectedVersion) !== String(currentVersion)) {
      throw new CandidateMemoryRepositoryConflictError(
        candidateId,
        expectedVersion,
        currentVersion
      )
    }

    const nextVersion = candidateState.state_version ?? candidateState.candidate_data_state?.state_version ?? null
    this.#states.set(candidateId, structuredClone(candidateState))

    return {
      candidate_id: candidateId,
      status: 'persisted',
      state_version: nextVersion,
      created: current === null
    }
  }
}

export function createMemoryCandidateMemoryRepository(initialStates = []) {
  const repository = new MemoryCandidateMemoryRepository(initialStates)
  return assertCandidateMemoryRepository(repository)
}
