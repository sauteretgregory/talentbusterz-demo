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
    artifact_id: 'match_candidate_gregory_sauteret_job_france_travail_talent_acquisition_210SDTY_v1',
    state_version: 'v1.0',
    engine_name: 'TBZ_MATCH_ENGINE',
    engine_version: 'V4',
    match_state: {
      professional_compatibility: {
        professional_match_score: score
      }
    }
  }
}

function makeProbe(status = 'complete', decision = 'complete') {
  return {
    contract_version: 'v1.1',
    artifact_id: 'probe_candidate_gregory_sauteret_job_france_travail_talent_acquisition_210SDTY_v1',
    state_version: 'v1.0',
    engine_name: 'TBZ_PROBE_ENGINE',
    engine_version: 'V1',
    status,
    decision,
    answered_question_ids: [],
    remaining_question_ids: [],
    insufficient_question_ids: [],
    contradictory_question_ids: [],
    answered_question_count: 0,
    remaining_question_count: 0,
    insufficient_question_count: 0,
    contradictory_question_count: 0
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
  assert.equal(state.application_readiness.match_score, 74)
  assert.equal(state.artifact_filename, 'application_readiness_candidate_gregory_sauteret_v1_job_france_travail_talent_acquisition_210SDTY_v1.0.json')
  assert.equal(state.source_alignment.match.artifact_id, makeMatch().artifact_id)
  assert.equal(state.source_alignment.probe.artifact_id, makeProbe().artifact_id)
  assertApplicationReadinessState(state)
})

test('application readiness recommends clarification when PROBE needs clarification', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(),
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
    matchState: makeMatch(),
    probeFinalState: makeProbe('open', 'continue_probe')
  })

  assert.equal(state.application_readiness.status, 'not_ready')
  assert.equal(state.application_readiness.recommendation, 'continue_enrichment')
  assertApplicationReadinessState(state)
})

test('application readiness remains not ready while a completed enrichment cycle awaits continuation', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(),
    probeFinalState: makeProbe('awaiting_continuation', 'continue_enrichment')
  })

  assert.equal(state.application_readiness.status, 'not_ready')
  assert.equal(state.application_readiness.recommendation, 'continue_enrichment')
  assert.equal(state.application_readiness.probe_status, 'awaiting_continuation')
  assert.deepEqual(state.application_readiness.attention_points, ['enrichment_continuation_choice_required'])
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

test('application readiness rejects missing source provenance', () => {
  const probe = makeProbe()
  delete probe.engine_name

  assert.throws(
    () => createApplicationReadinessState({
      candidateDataState: makeCandidate(),
      jobDataState: makeJob(),
      matchState: makeMatch(),
      probeFinalState: probe
    }),
    /source_alignment\.probe\.engine_name is required/
  )
})

test('application readiness validator rejects status and PROBE status mismatch', () => {
  const state = createApplicationReadinessState({
    candidateDataState: makeCandidate(),
    jobDataState: makeJob(),
    matchState: makeMatch(),
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
    matchState: makeMatch(),
    probeFinalState: makeProbe('complete', 'complete')
  })

  state.application_readiness.recommendation = 'continue_probe'

  assert.throws(
    () => assertApplicationReadinessState(state),
    /unsupported recommendation/
  )
})
