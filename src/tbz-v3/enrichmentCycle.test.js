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
  return { probe_plan: { critical_questions: [
    { question_id: 'q1', question: 'Question 1' }, { question_id: 'q2', question: 'Question 2' }, { question_id: 'q3', question: 'Question 3' }
  ], secondary_questions: [
    { question_id: 'q4', question: 'Question 4' }, { question_id: 'q5', question: 'Question 5' }, { question_id: 'q6', question: 'Question 6' }
  ] } }
}

test('continuous enrichment selects at most five questions', () => {
  assert.equal(ENRICHMENT_CYCLE_SIZE, 5)
  assert.deepEqual(selectEnrichmentBatch(makePlan(), []).map((q) => q.question_id), ['q1', 'q2', 'q3', 'q4', 'q5'])
})

test('answered questions remain excluded from later enrichment cycles', () => {
  assert.deepEqual(selectEnrichmentBatch(makePlan(), ['q1', 'q2', 'q3', 'q4', 'q5']).map((q) => q.question_id), ['q6'])
})

test('enrichment state belongs to persistent candidate profile, not one offer', () => {
  const state = buildEnrichmentCycleState({ probePlan: makePlan(), candidateDataState: { candidate_data_state: { probe_response_state: { applied_question_ids: ['q1'] } } }, currentScore: 74 })
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

test('a new cycle can be generated independently of the current offer', () => {
  const plan = createOfferIndependentEnrichmentPlan(2)
  const questions = [...plan.probe_plan.critical_questions, ...plan.probe_plan.secondary_questions]
  assert.equal(questions.length, 5)
  assert.equal(plan.loop_closure.decision, 'continue_enrichment')
  assert.ok(questions.every((question) => question.question_id.startsWith('GENERIC_PROFILE_CYCLE_2_')))
})
