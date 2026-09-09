import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ENRICHMENT_CYCLE_SIZE,
  ENRICHMENT_DECISIONS,
  selectEnrichmentBatch,
  buildEnrichmentCycleState,
  estimatePotentialScoreGain,
  createOfferIndependentEnrichmentPlan
} from './enrichmentCycle.js'

function makePlan() {
  return {
    probe_plan: {
      critical_questions: [
        { question_id: 'q1', question: 'Question 1' },
        { question_id: 'q2', question: 'Question 2' },
        { question_id: 'q3', question: 'Question 3' }
      ],
      secondary_questions: [
        { question_id: 'q4', question: 'Question 4' },
        { question_id: 'q5', question: 'Question 5' },
        { question_id: 'q6', question: 'Question 6' }
      ]
    }
  }
}

test('continuous enrichment selects at most five questions', () => {
  assert.equal(ENRICHMENT_CYCLE_SIZE, 5)
  assert.deepEqual(
    selectEnrichmentBatch(makePlan(), []).map((q) => q.question_id),
    ['q1', 'q2', 'q3', 'q4', 'q5']
  )
})

test('answered questions remain excluded from later enrichment cycles', () => {
  assert.deepEqual(
    selectEnrichmentBatch(makePlan(), ['q1', 'q2', 'q3', 'q4', 'q5']).map((q) => q.question_id),
    ['q6']
  )
})

test('enrichment state belongs to persistent candidate profile, not one offer', () => {
  const state = buildEnrichmentCycleState({
    probePlan: makePlan(),
    candidateDataState: { candidate_data_state: { probe_response_state: { applied_question_ids: ['q1'] } } },
    currentScore: 74
  })
  assert.equal(state.profile_scope, 'persistent_candidate_profile')
  assert.equal(state.offer_scope, 'current_match_context_only')
  assert.equal(state.cycle_size, 5)
  assert.equal(state.decision, null)
})

test('additional enrichment exposes a ten-point potential gain estimate', () => {
  assert.equal(estimatePotentialScoreGain({ remainingQuestionCount: 5, currentScore: 74 }), 10)
  assert.equal(ENRICHMENT_DECISIONS.CONTINUE, 'continue_enrichment')
  assert.equal(ENRICHMENT_DECISIONS.STOP, 'stop_enrichment')
})

test('each continued cycle is generated independently of the current offer', () => {
  const cycle2 = createOfferIndependentEnrichmentPlan(2)
  const cycle3 = createOfferIndependentEnrichmentPlan(3)
  const questions2 = [...cycle2.probe_plan.critical_questions, ...cycle2.probe_plan.secondary_questions]
  const questions3 = [...cycle3.probe_plan.critical_questions, ...cycle3.probe_plan.secondary_questions]

  assert.equal(questions2.length, 5)
  assert.equal(questions3.length, 5)
  assert.ok(questions2.every((question) => question.scope === 'persistent_candidate_profile'))
  assert.ok(questions2.every((question) => question.question_id.startsWith('GENERIC_PROFILE_CYCLE_2_')))
  assert.ok(questions3.every((question) => question.question_id.startsWith('GENERIC_PROFILE_CYCLE_3_')))
  assert.equal(
    new Set([...questions2, ...questions3].map((question) => question.question)).size,
    10
  )
  assert.equal(cycle2.loop_closure.decision, 'continue_enrichment')
  assert.equal(cycle2.probe_result.enrichment_cycle.estimated_potential_score_gain, 10)
})
