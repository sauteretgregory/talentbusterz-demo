import Database from 'better-sqlite3'

import {
  CandidateMemoryRepositoryConflictError
} from './candidateMemoryRepository.js'

export const SQLITE_CANDIDATE_MEMORY_REPOSITORY_VERSION = 'v0'

export { CandidateMemoryRepositoryConflictError }

function assertCandidateId(candidateId) {
  if (typeof candidateId !== 'string' || !candidateId.trim()) {
    throw new Error('TBZ SQLite candidate memory: candidateId is required.')
  }
  return candidateId.trim()
}

function getStateVersion(candidateState) {
  const version = candidateState?.state_version ?? candidateState?.candidate_data_state?.state_version
  if (version === undefined || version === null || String(version).trim() === '') {
    throw new Error('TBZ SQLite candidate memory: candidateState.state_version is required.')
  }
  return String(version)
}

function parseCandidateState(candidateId, row) {
  if (!row) return null

  try {
    return JSON.parse(row.candidate_state)
  } catch (error) {
    throw new Error(
      `TBZ SQLite candidate memory: corrupted candidate state for "${candidateId}": ${error.message}`
    )
  }
}

export class SqliteCandidateMemoryRepository {
  constructor({ filename = ':memory:', database = null } = {}) {
    this.db = database || new Database(filename)
    this.ownsDatabase = !database

    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS candidate_memory (
        candidate_id TEXT PRIMARY KEY,
        state_version TEXT NOT NULL,
        candidate_state TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    this.selectStatement = this.db.prepare(`
      SELECT candidate_id, state_version, candidate_state, updated_at
      FROM candidate_memory
      WHERE candidate_id = ?
    `)

    this.insertStatement = this.db.prepare(`
      INSERT INTO candidate_memory (
        candidate_id,
        state_version,
        candidate_state,
        updated_at
      ) VALUES (?, ?, ?, ?)
    `)

    this.updateStatement = this.db.prepare(`
      UPDATE candidate_memory
      SET state_version = ?, candidate_state = ?, updated_at = ?
      WHERE candidate_id = ? AND state_version = ?
    `)

    this.forceUpdateStatement = this.db.prepare(`
      UPDATE candidate_memory
      SET state_version = ?, candidate_state = ?, updated_at = ?
      WHERE candidate_id = ?
    `)

    this.saveTransaction = this.db.transaction((candidateId, candidateState, expectedVersion) => {
      const current = this.selectStatement.get(candidateId)
      const nextVersion = getStateVersion(candidateState)
      const serializedState = JSON.stringify(candidateState)
      const updatedAt = new Date().toISOString()

      if (!current) {
        if (expectedVersion !== null && expectedVersion !== undefined) {
          throw new CandidateMemoryRepositoryConflictError(candidateId, expectedVersion, null)
        }

        this.insertStatement.run(candidateId, nextVersion, serializedState, updatedAt)
        return {
          candidate_id: candidateId,
          status: 'persisted',
          state_version: nextVersion,
          updated_at: updatedAt,
          created: true
        }
      }

      if (expectedVersion !== null && expectedVersion !== undefined) {
        if (String(expectedVersion) !== String(current.state_version)) {
          throw new CandidateMemoryRepositoryConflictError(
            candidateId,
            expectedVersion,
            current.state_version
          )
        }

        const result = this.updateStatement.run(
          nextVersion,
          serializedState,
          updatedAt,
          candidateId,
          String(expectedVersion)
        )

        if (result.changes !== 1) {
          const latest = this.selectStatement.get(candidateId)
          throw new CandidateMemoryRepositoryConflictError(
            candidateId,
            expectedVersion,
            latest?.state_version ?? null
          )
        }
      } else {
        this.forceUpdateStatement.run(
          nextVersion,
          serializedState,
          updatedAt,
          candidateId
        )
      }

      return {
        candidate_id: candidateId,
        status: 'persisted',
        state_version: nextVersion,
        updated_at: updatedAt,
        created: false
      }
    })
  }

  async get(candidateId) {
    const id = assertCandidateId(candidateId)
    const row = this.selectStatement.get(id)
    return parseCandidateState(id, row)
  }

  async save(candidateId, candidateState, expectedVersion = null) {
    const id = assertCandidateId(candidateId)

    if (!candidateState || typeof candidateState !== 'object' || Array.isArray(candidateState)) {
      throw new Error('TBZ SQLite candidate memory: candidateState must be an object.')
    }

    return this.saveTransaction(id, candidateState, expectedVersion)
  }

  close() {
    if (this.ownsDatabase && this.db.open) this.db.close()
  }
}

export function createSqliteCandidateMemoryRepository(options = {}) {
  return new SqliteCandidateMemoryRepository(options)
}
