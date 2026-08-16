import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_MEMORY_DIR = path.resolve('server/output/candidate-memory')

function assertCanonicalCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('TBZ CANDIDATE MEMORY: canonical candidate data state is required.')
  }
  if (candidate.artifact_type !== 'canonical_candidate_data_state') {
    throw new Error('TBZ CANDIDATE MEMORY: invalid candidate artifact_type.')
  }
  if (!candidate.candidate_data_state?.candidate_id) {
    throw new Error('TBZ CANDIDATE MEMORY: candidate_id is required.')
  }
  return candidate
}

function safeCandidateId(candidateId) {
  const value = String(candidateId || '').trim()
  if (!value) throw new Error('TBZ CANDIDATE MEMORY: candidate_id is required.')
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function createCandidateMemoryStore({ directory = DEFAULT_MEMORY_DIR } = {}) {
  async function load(candidateId) {
    const filePath = path.join(directory, `${safeCandidateId(candidateId)}.json`)
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      return assertCanonicalCandidate(JSON.parse(raw))
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }

  async function save(candidateArtifact) {
    const canonical = assertCanonicalCandidate(candidateArtifact)
    await fs.mkdir(directory, { recursive: true })
    const filePath = path.join(directory, `${safeCandidateId(canonical.candidate_data_state.candidate_id)}.json`)
    await fs.writeFile(filePath, JSON.stringify(canonical, null, 2) + '\n', 'utf8')
    return canonical
  }

  async function resolve({ candidate = null, candidateId = null } = {}) {
    const explicitCandidate = candidate ? assertCanonicalCandidate(candidate) : null
    const resolvedCandidateId = candidateId || explicitCandidate?.candidate_data_state?.candidate_id
    if (!resolvedCandidateId) throw new Error('TBZ CANDIDATE MEMORY: candidate_id is required to resolve profile memory.')

    const stored = await load(resolvedCandidateId)
    if (stored) return { candidate: stored, source: 'persistent_memory', persisted: true }
    if (explicitCandidate) {
      await save(explicitCandidate)
      return { candidate: explicitCandidate, source: 'initial_candidate', persisted: true }
    }
    return { candidate: null, source: 'missing', persisted: false }
  }

  return { load, save, resolve }
}

export const candidateMemoryStore = createCandidateMemoryStore()
