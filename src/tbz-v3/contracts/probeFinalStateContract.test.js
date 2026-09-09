import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PROBE_FINAL_STATE_CONTRACT_VERSION,
  assertProbeFinalState,
  createProbeFinalState
} from './probeFinalStateContract.js'

function makeProbePlan(overrides = {}) {
  return {
    artifact_type: 'canonical_probe_plan',
    probe_result: {
      loop_status: 'open',
      adaptive_decision: 'continue_probe'
    },
    loop_closure: {
      status: 'open',
      decision: 'continue_probe',
      decision_reason: 'material_candidate_answerable_gaps_remain',
      answered_question_ids: ['q1'],
      remaining_question_ids: ['q2'],
      insufficient_question_ids: [],
      contradictory_question_ids: []
    },
    ...overrides
  }
}

test('PROBE final state contract creates a stable continuation state', () => {
  const state = createProbeFinalState(makeProbePlan())

  assert.equal(state.contract_version, PROBE_FINAL_STATE_CONTRACT_VERSION)
  assert.equal(state.status, 'open')
  assert.equal(state.decision, 'continue_probe')
  assert.deepEqual(state.answered_question_ids, ['q1'])
  assert.deepEqual(state.remaining_question_ids, ['q2'])
  assert.equal(state.answered_question_count, 1)
  assert.equal(state.remaining_question_count, 1)
  assert.deepEqual(assertProbeFinalState(state), state)
})

test('PROBE final state contract preserves clarification causes', () => {
  const state = createProbeFinalState(makeProbePlan({
    probe_result: {
      loop_status: 'needs_clarification',
      adaptive_decision: 'clarification_required'
    },
    loop_closure: {
      status: 'needs_clarification',
      decision: 'clarification_required',
      decision_reason: 'one_or_more_candidate_answers_are_insufficient_to_stabilize_evidence',
      answered_question_ids: ['q1'],
      remaining_question_ids: ['q2'],
      insufficient_question_ids: ['q2'],
      contradictory_question_ids: []
    }
  }))

  assert.equal(state.status, 'needs_clarification')
  assert.equal(state.decision, 'clarification_required')
  assert.deepEqual(state.insufficient_question_ids, ['q2'])
  assert.equal(state.insufficient_question_count, 1)
  assert.doesNotThrow(() => assertProbeFinalState(state))
})

test('PROBE final state contract rejects inconsistent counts', () => {
  assert.throws(
    () => assertProbeFinalState({
      ...createProbeFinalState(makeProbePlan()),
      remaining_question_count: 99
    }),
    /remaining_question_count is inconsistent/
  )
})

test('PROBE final state contract rejects unsupported terminal state values', () => {
  assert.throws(
    () => createProbeFinalState(makeProbePlan({
      loop_closure: {
        status: 'invalid',
        decision: 'complete',
        answered_question_ids: [],
        remaining_question_ids: [],
        insufficient_question_ids: [],
        contradictory_question_ids: []
      }
    })),
    /unsupported status/
  )
})
