import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createApplicationReadinessState,
  assertApplicationReadinessState
} from './applicationReadinessContract.js'

function makeCandidate() {
  return {
    artifact_type: 'canonical_candidate_data_state',
    artifact_id: 'candidate_gregory_sauteret_v1'
  }
}

function makeJob() {
  return {
    artifact_type: 'canonical_job_data_state',
    artifact_id: 'job_france_travail_talent_acquisition_210SDTY'
  }
}

function makeMatch(score = 74) {
  return {
    artifact_type: 'canonical_match_state',
    match_state: {
      professional_compatibility: {
        professional_match_score: score
      }
    }
  }
}

function makeProbe(status = 'complete', decision = 'complete') {
  return {
    contract_version: 'v1.0',
    status,
    decision
  }
}

test('application readiness is ready when PROBE is complete', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(74),
    probeFinalState: makeProbe('complete', 'complete')
  })

  assert.equal(state.artifact_type, 'canonical_application_readiness_state')
  assert.equal(state.application_readiness.status, 'ready')
  assert.equal(state.application_readiness.recommendation, 'prepare_application')
  assert.deepEqual(state.application_readiness.attention_points, [])
  assert.equal(state.application_readiness.match_score, 74)
  assert.equal(state.artifact_filename, 'application_readiness_candidate_gregory_sauteret_v1_job_france_travail_talent_acquisition_210SDTY_v1.0.json')
  assertApplicationReadinessState(state)
})

test('application readiness recommends clarification when PROBE needs clarification', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(74),
    probeFinalState: makeProbe('needs_clarification', 'clarification_required')
  })

  assert.equal(state.application_readiness.status, 'needs_clarification')
  assert.equal(state.application_readiness.recommendation, 'clarification_recommended')
  assert.deepEqual(state.application_readiness.attention_points, ['probe_clarification_required'])
  assertApplicationReadinessState(state)
})

test('application readiness recommends continued enrichment while PROBE remains open', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(74),
    probeFinalState: makeProbe('open', 'continue_probe')
  })

  assert.equal(state.application_readiness.status, 'not_ready')
  assert.equal(state.application_readiness.recommendation, 'continue_enrichment')
  assert.deepEqual(state.application_readiness.attention_points, [])
  assertApplicationReadinessState(state)
})

test('application readiness rejects missing MATCH score', () => {
  assert.throws(
    () => createApplicationReadinessState({
      candidateDataState: makeCandidate(),
      jobDataState: makeJob(),
      matchState: makeMatch(null),
      probeFinalState: makeProbe('complete', 'complete')
    }),
    /canonical MATCH score/
  )
})

test('application readiness rejects unsupported PROBE final status', () => {
  assert.throws(
    () => createApplicationReadinessState({
      candidateDataState: makeCandidate(),
      jobDataState: makeJob(),
      matchState: makeMatch(74),
      probeFinalState: makeProbe('unsupported', 'complete')
    }),
    /unsupported PROBE final state status/
  )
})

test('application readiness validator accepts empty attention points for non-ready states', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(74),
    probeFinalState: makeProbe('open', 'continue_probe')
  })

  assert.deepEqual(state.application_readiness.attention_points, [])
  assert.doesNotThrow(() => assertApplicationReadinessState(state))
})

test('application readiness validator rejects status and PROBE status mismatch', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(74),
    probeFinalState: makeProbe('complete', 'complete')
  })

  state.application_readiness.status = 'not_ready'

  assert.throws(
    () => assertApplicationReadinessState(state),
    /status and PROBE status are inconsistent/
  )
})

test('application readiness validator rejects unsupported recommendation', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(74),
    probeFinalState: makeProbe('complete', 'complete')
  })

  state.application_readiness.recommendation = 'continue_probe'

  assert.throws(
    () => assertApplicationReadinessState(state),
    /unsupported recommendation/
  )
})

test('application readiness validator rejects non-finite MATCH score', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(74),
    probeFinalState: makeProbe('complete', 'complete')
  })

  state.application_readiness.match_score = NaN

  assert.throws(
    () => assertApplicationReadinessState(state),
    /finite number or null/
  )
})