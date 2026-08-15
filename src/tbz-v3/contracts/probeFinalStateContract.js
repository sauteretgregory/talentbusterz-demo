export const PROBE_FINAL_STATE_CONTRACT_VERSION =
  'v1.0'

export const PROBE_FINAL_STATE_STATUSES = [
  'open',
  'needs_clarification',
  'complete'
]

export const PROBE_FINAL_STATE_DECISIONS = [
  'continue_probe',
  'clarification_required',
  'complete'
]

function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`TBZ: PROBE final state ${fieldName} must be an array of strings.`)
  }
}

export function createProbeFinalState(probePlan) {
  if (!probePlan || typeof probePlan !== 'object') {
    throw new Error('TBZ: PROBE final state requires a canonical probe plan.')
  }

  if (probePlan.artifact_type !== 'canonical_probe_plan') {
    throw new Error('TBZ: PROBE final state requires canonical_probe_plan.')
  }

  const closure = probePlan.loop_closure || {}
  const result = probePlan.probe_result || {}
  const status = closure.status || result.loop_status
  const decision = closure.decision || result.adaptive_decision

  if (!PROBE_FINAL_STATE_STATUSES.includes(status)) {
    throw new Error('TBZ: PROBE final state has an unsupported status.')
  }

  if (!PROBE_FINAL_STATE_DECISIONS.includes(decision)) {
    throw new Error('TBZ: PROBE final state has an unsupported decision.')
  }

  const answeredQuestionIds = Array.isArray(closure.answered_question_ids) ? closure.answered_question_ids : []
  const remainingQuestionIds = Array.isArray(closure.remaining_question_ids) ? closure.remaining_question_ids : []
  const insufficientQuestionIds = Array.isArray(closure.insufficient_question_ids) ? closure.insufficient_question_ids : []
  const contradictoryQuestionIds = Array.isArray(closure.contradictory_question_ids) ? closure.contradictory_question_ids : []

  assertStringArray(answeredQuestionIds, 'answered_question_ids')
  assertStringArray(remainingQuestionIds, 'remaining_question_ids')
  assertStringArray(insufficientQuestionIds, 'insufficient_question_ids')
  assertStringArray(contradictoryQuestionIds, 'contradictory_question_ids')

  return {
    contract_version: PROBE_FINAL_STATE_CONTRACT_VERSION,
    status,
    decision,
    decision_reason: closure.decision_reason || result.decision_reason || '',
    answered_question_ids: [...answeredQuestionIds],
    remaining_question_ids: [...remainingQuestionIds],
    insufficient_question_ids: [...insufficientQuestionIds],
    contradictory_question_ids: [...contradictoryQuestionIds],
    answered_question_count: answeredQuestionIds.length,
    remaining_question_count: remainingQuestionIds.length,
    insufficient_question_count: insufficientQuestionIds.length,
    contradictory_question_count: contradictoryQuestionIds.length
  }
}

export function assertProbeFinalState(state) {
  if (!state || typeof state !== 'object') throw new Error('TBZ: PROBE final state is required.')
  if (state.contract_version !== PROBE_FINAL_STATE_CONTRACT_VERSION) throw new Error('TBZ: unsupported PROBE final state contract.')
  if (!PROBE_FINAL_STATE_STATUSES.includes(state.status)) throw new Error('TBZ: PROBE final state has an unsupported status.')
  if (!PROBE_FINAL_STATE_DECISIONS.includes(state.decision)) throw new Error('TBZ: PROBE final state has an unsupported decision.')
  assertStringArray(state.answered_question_ids, 'answered_question_ids')
  assertStringArray(state.remaining_question_ids, 'remaining_question_ids')
  assertStringArray(state.insufficient_question_ids, 'insufficient_question_ids')
  assertStringArray(state.contradictory_question_ids, 'contradictory_question_ids')
  for (const [field, expected] of [
    ['answered_question_count', state.answered_question_ids.length],
    ['remaining_question_count', state.remaining_question_ids.length],
    ['insufficient_question_count', state.insufficient_question_ids.length],
    ['contradictory_question_count', state.contradictory_question_ids.length]
  ]) {
    if (state[field] !== expected) throw new Error(`TBZ: PROBE final state ${field} is inconsistent with its question ids.`)
  }
  return state
}
