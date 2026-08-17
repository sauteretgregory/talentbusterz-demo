import { assertCandidateMemoryRepository } from './candidateMemoryRepository.js'

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
    const currentVersion = current?.state_version ?? null

    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      const error = new Error('TBZ_CANDIDATE_MEMORY_CONFLICT')
      error.code = 'CANDIDATE_MEMORY_CONFLICT'
      error.expectedVersion = expectedVersion
      error.currentVersion = currentVersion
      throw error
    }

    this.#states.set(candidateId, structuredClone(candidateState))

    return {
      candidate_id: candidateId,
      status: 'persisted',
      state_version: candidateState.state_version ?? null
    }
  }
}

export function createMemoryCandidateMemoryRepository(initialStates = []) {
  const repository = new MemoryCandidateMemoryRepository(initialStates)
  return assertCandidateMemoryRepository(repository)
}
