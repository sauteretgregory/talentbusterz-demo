/**
 * TalentBusterZ V3 — Candidate Memory Repository Contract v0
 *
 * Persistence boundary for Candidate Memory.
 *
 * This module defines the minimal repository contract identified by the
 * Candidate Memory persistence audit. Concrete storage adapters (for example
 * Freebox/USB or cloud storage) must implement this boundary.
 *
 * The repository deliberately does not know about:
 * - HTTP orchestration
 * - TBZ engines
 * - Freebox
 * - filesystem paths
 * - JSON files
 * - SQLite
 * - cloud providers
 *
 * Contract status: v0 / architectural proposal.
 *
 * IMPORTANT:
 * - Evidence / Memory Item mutation APIs are intentionally not exposed here.
 * - Their final granularity depends on the still-open 1B contract.
 * - `state_version` is the current candidate-state version carried by the
 *   canonical Candidate Data State contract.
 */

export const CANDIDATE_MEMORY_REPOSITORY_CONTRACT_VERSION = 'v0'

export class CandidateMemoryRepositoryConflictError extends Error {
  constructor(candidateId, expectedVersion, actualVersion) {
    super(
      `TBZ candidate memory version conflict for "${candidateId}": expected ${String(expectedVersion)}, actual ${String(actualVersion)}.`
    )
    this.name = 'CandidateMemoryRepositoryConflictError'
    this.code = 'CANDIDATE_MEMORY_VERSION_CONFLICT'
    this.candidateId = candidateId
    this.expectedVersion = expectedVersion
    this.actualVersion = actualVersion
  }
}

export class CandidateMemoryRepository {
  /**
   * Load the complete persisted candidate memory state.
   *
   * @param {string} candidateId
   * @returns {Promise<object|null>}
   */
  async get(candidateId) {
    throw new Error(
      'CandidateMemoryRepository.get() is not implemented.'
    )
  }

  /**
   * Persist the complete candidate memory state.
   *
   * Implementations must provide an atomic commit for the candidate state.
   * When `expectedVersion` is supplied, the write must fail if the persisted
   * state no longer has that version (optimistic concurrency control).
   *
   * @param {string} candidateId
   * @param {object} candidateState
   * @param {number|string|null} expectedVersion
   * @returns {Promise<object>}
   */
  async save(candidateId, candidateState, expectedVersion = null) {
    throw new Error(
      'CandidateMemoryRepository.save() is not implemented.'
    )
  }
}

export function assertCandidateMemoryRepository(repository) {
  if (!repository || typeof repository !== 'object') {
    throw new Error(
      'TBZ: candidate memory repository is required.'
    )
  }

  if (typeof repository.get !== 'function') {
    throw new Error(
      'TBZ: candidate memory repository must implement get().'
    )
  }

  if (typeof repository.save !== 'function') {
    throw new Error(
      'TBZ: candidate memory repository must implement save().'
    )
  }

  return repository
}
