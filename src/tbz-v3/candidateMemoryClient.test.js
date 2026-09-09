import test from 'node:test'
import assert from 'node:assert/strict'

import {
  fetchPersistedCandidateMemory,
  resolveInitialCandidateState
} from './candidateMemoryClient.js'

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body
  }
}

test('fetchPersistedCandidateMemory returns found:true with the candidate when the server has a persisted profile', async () => {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    return jsonResponse(200, {
      status: 'completed',
      canonical_candidate_data_state: {
        artifact_type: 'canonical_candidate_data_state',
        candidate_data_state: { candidate_id: 'candidate_gregory_sauteret_v1' }
      }
    })
  }

  const result = await fetchPersistedCandidateMemory({
    candidateId: 'candidate_gregory_sauteret_v1',
    fetchImpl,
    apiBase: 'http://localhost:8787'
  })

  assert.equal(result.found, true)
  assert.equal(result.candidate.candidate_data_state.candidate_id, 'candidate_gregory_sauteret_v1')
  assert.deepEqual(calls, [
    'http://localhost:8787/api/candidate-memory/candidate_gregory_sauteret_v1'
  ])
})

test('fetchPersistedCandidateMemory returns found:false when the server responds 404 (no profile yet)', async () => {
  const fetchImpl = async () => jsonResponse(404, { status: 'not_found' })

  const result = await fetchPersistedCandidateMemory({
    candidateId: 'candidate_never_seen',
    fetchImpl
  })

  assert.equal(result.found, false)
  assert.equal(result.reason, 'not_found')
})

test('fetchPersistedCandidateMemory returns found:false without throwing when the server is unreachable', async () => {
  const fetchImpl = async () => {
    throw new Error('fetch failed: connection refused')
  }

  const result = await fetchPersistedCandidateMemory({
    candidateId: 'candidate_gregory_sauteret_v1',
    fetchImpl
  })

  assert.equal(result.found, false)
  assert.equal(result.reason, 'network_error')
})

test('fetchPersistedCandidateMemory requires a candidate_id and never calls fetch without one', async () => {
  let called = false
  const fetchImpl = async () => {
    called = true
    return jsonResponse(200, {})
  }

  const result = await fetchPersistedCandidateMemory({ candidateId: null, fetchImpl })

  assert.equal(result.found, false)
  assert.equal(result.reason, 'candidate_id_required')
  assert.equal(called, false)
})

test('resolveInitialCandidateState uses the persisted profile and flags rehydratedOnMount when one is found', async () => {
  const persisted = {
    artifact_type: 'canonical_candidate_data_state',
    candidate_data_state: {
      candidate_id: 'candidate_gregory_sauteret_v1',
      probe_response_state: { applied_question_ids: ['probe_ft_candidate_education_001'] }
    }
  }

  const fetchImpl = async () => jsonResponse(200, {
    status: 'completed',
    canonical_candidate_data_state: persisted
  })

  const result = await resolveInitialCandidateState({
    candidateId: 'candidate_gregory_sauteret_v1',
    fallbackCandidate: { candidate_data_state: { candidate_id: 'candidate_gregory_sauteret_v1' } },
    fetchImpl
  })

  assert.equal(result.candidateLoaded, true)
  assert.equal(result.memorySource, 'persistent_memory')
  assert.equal(result.rehydratedOnMount, true)
  assert.deepEqual(
    result.candidateState.candidate_data_state.probe_response_state.applied_question_ids,
    ['probe_ft_candidate_education_001']
  )
})

test('resolveInitialCandidateState falls back to the bundled fixture and candidateLoaded:false on a first-ever visit', async () => {
  const fallbackCandidate = { candidate_data_state: { candidate_id: 'candidate_gregory_sauteret_v1' } }
  const fetchImpl = async () => jsonResponse(404, { status: 'not_found' })

  const result = await resolveInitialCandidateState({
    candidateId: 'candidate_gregory_sauteret_v1',
    fallbackCandidate,
    fetchImpl
  })

  assert.equal(result.candidateLoaded, false)
  assert.equal(result.memorySource, 'none')
  assert.equal(result.rehydratedOnMount, false)
  assert.equal(result.candidateState, fallbackCandidate)
})
