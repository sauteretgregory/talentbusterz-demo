export const ENRICHMENT_CYCLE_SIZE = 5
export const ENRICHMENT_DECISIONS = Object.freeze({
  CONTINUE: 'continue_enrichment',
  STOP: 'stop_enrichment'
})

export function getProbeQuestions(probePlan) {
  const critical = probePlan?.probe_plan?.critical_questions || []
  const secondary = probePlan?.probe_plan?.secondary_questions || []
  return [...critical, ...secondary].filter((question) => question?.question_id && question?.question)
}

export function selectEnrichmentBatch(probePlan, appliedQuestionIds = [], batchSize = ENRICHMENT_CYCLE_SIZE) {
  const answered = new Set(appliedQuestionIds)
  return getProbeQuestions(probePlan)
    .filter((question) => !answered.has(question.question_id))
    .slice(0, batchSize)
}

export function getRemainingEnrichmentCount(probePlan, appliedQuestionIds = []) {
  return selectEnrichmentBatch(
    {
      probe_plan: {
        critical_questions: getProbeQuestions(probePlan),
        secondary_questions: []
      }
    },
    appliedQuestionIds,
    Number.MAX_SAFE_INTEGER
  ).length
}

export function estimatePotentialScoreGain({ remainingQuestionCount, currentScore }) {
  if (!remainingQuestionCount) return 0
  if (typeof currentScore !== 'number') return 10
  return Math.min(10, Math.max(2, remainingQuestionCount * 2))
}

export function buildEnrichmentCycleState({
  probePlan,
  candidateDataState,
  currentScore,
  cycleNumber = 1,
  decision = null
}) {
  const applied = candidateDataState?.candidate_data_state?.probe_response_state?.applied_question_ids || []
  const remainingQuestionCount = getRemainingEnrichmentCount(probePlan, applied)
  const batch = selectEnrichmentBatch(probePlan, applied)
  const potentialScoreGain = estimatePotentialScoreGain({ remainingQuestionCount, currentScore })
  const cycleComplete = batch.length === 0

  return {
    cycle_number: cycleNumber,
    cycle_size: ENRICHMENT_CYCLE_SIZE,
    question_count: batch.length,
    question_ids: batch.map((question) => question.question_id),
    remaining_question_count: remainingQuestionCount,
    estimated_potential_score_gain: potentialScoreGain,
    estimated_gain_basis: potentialScoreGain > 0
      ? 'candidate_profile_enrichment_can_resolve_remaining_material_gaps'
      : 'no_material_answerable_gap_remaining',
    decision: decision || (cycleComplete ? ENRICHMENT_DECISIONS.STOP : null),
    cycle_complete: cycleComplete,
    profile_scope: 'persistent_candidate_profile',
    offer_scope: 'current_match_context_only'
  }
}
