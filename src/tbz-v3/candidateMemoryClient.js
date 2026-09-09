const DEFAULT_API_BASE = 'http://localhost:8787'

/**
 * TalentBusterZ V3 — Candidate memory client (browser side)
 *
 * Talks to GET /api/candidate-memory/:candidateId to find out whether a
 * persistent candidate profile already exists on the server before the app
 * falls back to the bundled demo fixture. Pure functions, fetch injected,
 * so they are testable without a browser or a running server.
 */

export async function fetchPersistedCandidateMemory({
  candidateId,
  fetchImpl = fetch,
  apiBase = DEFAULT_API_BASE
} = {}) {
  if (!candidateId) {
    return { found: false, reason: 'candidate_id_required' }
  }

  let response

  try {
    response = await fetchImpl(
      `${apiBase}/api/candidate-memory/${encodeURIComponent(candidateId)}`
    )
  } catch (error) {
    return { found: false, reason: 'network_error', error: error.message }
  }

  if (response.status === 404) {
    return { found: false, reason: 'not_found' }
  }

  if (!response.ok) {
    return { found: false, reason: 'request_failed', status: response.status }
  }

  const body = await response.json()

  if (!body?.canonical_candidate_data_state) {
    return { found: false, reason: 'invalid_response' }
  }

  return {
    found: true,
    candidate: body.canonical_candidate_data_state
  }
}

/**
 * Decision used on mount: try the persistent profile first, fall back to the
 * bundled demo candidate if nothing was persisted yet (first-ever visit) or
 * the lookup failed for any reason.
 */
export async function resolveInitialCandidateState({
  candidateId,
  fallbackCandidate,
  fetchImpl = fetch,
  apiBase = DEFAULT_API_BASE
} = {}) {
  const result = await fetchPersistedCandidateMemory({
    candidateId,
    fetchImpl,
    apiBase
  })

  if (result.found) {
    return {
      candidateState: result.candidate,
      candidateLoaded: true,
      memorySource: 'persistent_memory',
      rehydratedOnMount: true
    }
  }

  return {
    candidateState: fallbackCandidate,
    candidateLoaded: false,
    memorySource: 'none',
    rehydratedOnMount: false
  }
}
