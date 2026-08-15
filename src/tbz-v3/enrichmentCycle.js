export const ENRICHMENT_CYCLE_SIZE = 5
export const ENRICHMENT_DECISIONS = Object.freeze({ CONTINUE: 'continue_enrichment', STOP: 'stop_enrichment' })

export function getProbeQuestions(probePlan) {
  return [...(probePlan?.probe_plan?.critical_questions || []), ...(probePlan?.probe_plan?.secondary_questions || [])]
    .filter((question) => question?.question_id && question?.question)
}

export function selectEnrichmentBatch(probePlan, appliedQuestionIds = [], batchSize = ENRICHMENT_CYCLE_SIZE) {
  const answered = new Set(appliedQuestionIds)
  return getProbeQuestions(probePlan).filter((question) => !answered.has(question.question_id)).slice(0, batchSize)
}

export function getRemainingEnrichmentCount(probePlan, appliedQuestionIds = []) {
  return selectEnrichmentBatch({ probe_plan: { critical_questions: getProbeQuestions(probePlan), secondary_questions: [] } }, appliedQuestionIds, Number.MAX_SAFE_INTEGER).length
}

export function estimatePotentialScoreGain({ remainingQuestionCount, currentScore }) {
  if (!remainingQuestionCount) return 0
  if (typeof currentScore !== 'number') return 10
  return Math.min(10, Math.max(2, remainingQuestionCount * 2))
}

export function createOfferIndependentEnrichmentPlan(cycleNumber = 1) {
  const prefix = `GENERIC_PROFILE_CYCLE_${cycleNumber}`
  const questions = [
    ['01', 'Y a-t-il une expérience, mission ou réalisation importante qui ne figure pas encore dans votre CV ou votre profil ?'],
    ['02', 'Quelle réalisation professionnelle pourriez-vous concrètement défendre comme une réussite personnelle ?'],
    ['03', 'Quels outils, méthodes ou environnements de travail maîtrisez-vous réellement et que votre profil ne décrit pas assez ?'],
    ['04', 'Quelle compétence ou expérience souhaitez-vous davantage valoriser dans vos prochaines candidatures ?'],
    ['05', 'Quel exemple concret montre le mieux votre capacité à produire un résultat dans un contexte professionnel exigeant ?']
  ]
  return {
    artifact_type: 'canonical_probe_plan',
    artifact_id: `probe_candidate_enrichment_cycle_${cycleNumber}`,
    artifact_filename: `probe_candidate_enrichment_cycle_${cycleNumber}_v1.0.json`,
    engine_name: 'TBZ_PROBE_ENGINE',
    engine_version: 'V1',
    state_version: 'v1.0_continuous_candidate_enrichment',
    probe_plan: {
      critical_questions: questions.slice(0, 2).map(([id, question]) => ({ question_id: `${prefix}_${id}`, question, priority: 'critical', scope: 'persistent_candidate_profile' })),
      secondary_questions: questions.slice(2).map(([id, question]) => ({ question_id: `${prefix}_${id}`, question, priority: 'secondary', scope: 'persistent_candidate_profile' }))
    },
    probe_result: { probe_triggered: true, loop_status: 'open', adaptive_decision: 'continue_enrichment', recommended_question_count: ENRICHMENT_CYCLE_SIZE, remaining_question_count: ENRICHMENT_CYCLE_SIZE },
    loop_closure: { status: 'open', decision: 'continue_enrichment', decision_reason: 'offer_independent_candidate_profile_enrichment_cycle', answered_question_ids: [], remaining_question_ids: questions.map(([id]) => `${prefix}_${id}`), insufficient_question_ids: [], contradictory_question_ids: [] }
  }
}

export function buildEnrichmentCycleState({ probePlan, candidateDataState, currentScore, cycleNumber = 1, decision = null }) {
  const applied = candidateDataState?.candidate_data_state?.probe_response_state?.applied_question_ids || []
  const remainingQuestionCount = getRemainingEnrichmentCount(probePlan, applied)
  const batch = selectEnrichmentBatch(probePlan, applied)
  const potentialScoreGain = estimatePotentialScoreGain({ remainingQuestionCount, currentScore })
  const cycleComplete = batch.length === 0
  return { cycle_number: cycleNumber, cycle_size: ENRICHMENT_CYCLE_SIZE, question_count: batch.length, question_ids: batch.map((question) => question.question_id), remaining_question_count: remainingQuestionCount, estimated_potential_score_gain: potentialScoreGain, estimated_gain_basis: potentialScoreGain > 0 ? 'candidate_profile_enrichment_can_resolve_remaining_material_gaps' : 'no_material_answerable_gap_remaining', decision: decision || (cycleComplete ? ENRICHMENT_DECISIONS.STOP : null), cycle_complete: cycleComplete, profile_scope: 'persistent_candidate_profile', offer_scope: 'current_match_context_only' }
}
