import {
  ENGINE_IDS,
  executeEngine
} from './engineGateway.js'

function getScore(match) {
  const value = match?.match_state?.professional_compatibility?.professional_match_score
  return typeof value === 'number' ? Math.round(value) : null
}

function getQuestionIds(probePlan) {
  const critical = probePlan?.probe_plan?.critical_questions || []
  const secondary = probePlan?.probe_plan?.secondary_questions || []
  return [...critical, ...secondary]
    .map((question) => question?.question_id)
    .filter(Boolean)
}

function normalizeAnswer(answer) {
  return String(answer || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isInsufficientAnswer(answer) {
  const normalized = normalizeAnswer(answer)
  return normalized.length < 2 || /^(je ne sais pas|je sais pas|aucune idee|pas d'idee|je ne peux pas|impossible|pas sur|je ne suis pas sur|inconnu|unknown|n\/a|na)$/i.test(normalized)
}

function isContradictoryAnswer(answer) {
  const normalized = normalizeAnswer(answer)
  const affirmative = /\b(oui|yes)\b/.test(normalized)
  const negative = /\b(non|no)\b/.test(normalized)
  return affirmative && negative
}

function classifyResponseQuality(responses) {
  const insufficientQuestionIds = responses
    .filter((response) => isInsufficientAnswer(response?.answer))
    .map((response) => response?.question_id)
    .filter(Boolean)

  const contradictoryQuestionIds = responses
    .filter((response) => isContradictoryAnswer(response?.answer))
    .map((response) => response?.question_id)
    .filter(Boolean)

  return {
    status: contradictoryQuestionIds.length
      ? 'contradictory'
      : insufficientQuestionIds.length
        ? 'insufficient'
        : 'usable',
    insufficient_question_ids: insufficientQuestionIds,
    contradictory_question_ids: contradictoryQuestionIds
  }
}

function closeAnsweredQuestions(probePlan, candidateDataState) {
  const answered = new Set(candidateDataState?.candidate_data_state?.probe_response_state?.applied_question_ids || [])
  const next = structuredClone(probePlan)
  const critical = next?.probe_plan?.critical_questions || []
  const secondary = next?.probe_plan?.secondary_questions || []
  const remainingCritical = critical.filter((question) => !answered.has(question?.question_id))
  const remainingSecondary = secondary.filter((question) => !answered.has(question?.question_id))
  const remainingIds = new Set([...remainingCritical, ...remainingSecondary].map((question) => question?.question_id).filter(Boolean))
  const originalIds = getQuestionIds(probePlan)

  next.probe_plan.critical_questions = remainingCritical
  next.probe_plan.secondary_questions = remainingSecondary
  next.probe_result = {
    ...(next.probe_result || {}),
    probe_triggered: remainingIds.size > 0,
    recommended_question_count: remainingIds.size,
    loop_status: remainingIds.size > 0 ? 'open' : 'complete',
    answered_question_count: originalIds.filter((id) => answered.has(id)).length,
    remaining_question_count: remainingIds.size
  }

  next.loop_closure = {
    status: remainingIds.size > 0 ? 'open' : 'complete',
    answered_question_ids: [...answered].filter((id) => originalIds.includes(id)),
    remaining_question_ids: [...remainingIds]
  }

  return next
}

function isProbeCycleComplete(probePlan) {
  return probePlan?.loop_closure?.status === 'complete' || (
    probePlan?.probe_result?.loop_status === 'complete' &&
    getQuestionIds(probePlan).length === 0
  )
}

function applyAdaptiveDecision(probePlan, originalProbePlan, responseQuality) {
  const next = structuredClone(probePlan)
  const clarificationIds = new Set([
    ...responseQuality.insufficient_question_ids,
    ...responseQuality.contradictory_question_ids
  ])

  if (clarificationIds.size > 0) {
    const originalCritical = originalProbePlan?.probe_plan?.critical_questions || []
    const originalSecondary = originalProbePlan?.probe_plan?.secondary_questions || []
    const currentCritical = next?.probe_plan?.critical_questions || []
    const currentSecondary = next?.probe_plan?.secondary_questions || []

    next.probe_plan.critical_questions = [
      ...currentCritical,
      ...originalCritical.filter((question) => clarificationIds.has(question?.question_id) && !currentCritical.some((item) => item?.question_id === question?.question_id))
    ]
    next.probe_plan.secondary_questions = [
      ...currentSecondary,
      ...originalSecondary.filter((question) => clarificationIds.has(question?.question_id) && !currentSecondary.some((item) => item?.question_id === question?.question_id))
    ]
  }

  const remaining = getQuestionIds(next)
  let decision = 'complete'
  let status = 'complete'
  if (responseQuality.status === 'contradictory' || responseQuality.status === 'insufficient') {
    decision = 'clarification_required'
    status = 'needs_clarification'
  } else if (remaining.length > 0) {
    decision = 'continue_probe'
    status = 'open'
  }

  next.loop_closure = {
    ...(next.loop_closure || {}),
    status,
    decision,
    decision_reason: responseQuality.status === 'contradictory'
      ? 'one_or_more_candidate_answers_contain_conflicting_assertions'
      : responseQuality.status === 'insufficient'
        ? 'one_or_more_candidate_answers_are_insufficient_to_stabilize_evidence'
        : remaining.length > 0
          ? 'material_candidate_answerable_gaps_remain'
          : 'no_answerable_probe_questions_remain_in_current_cycle',
    insufficient_question_ids: responseQuality.insufficient_question_ids,
    contradictory_question_ids: responseQuality.contradictory_question_ids,
    remaining_question_ids: remaining
  }

  next.probe_result = {
    ...(next.probe_result || {}),
    loop_status: status,
    adaptive_decision: decision,
    decision_reason: next.loop_closure.decision_reason,
    insufficient_question_count: responseQuality.insufficient_question_ids.length,
    contradictory_question_count: responseQuality.contradictory_question_ids.length,
    remaining_question_count: remaining.length,
    recommended_question_count: remaining.length,
    probe_triggered: remaining.length > 0
  }

  return next
}

export async function processProbeResponses({
  engineRegistry,
  candidateDataState,
  jobDataState,
  probePlan,
  responses,
  previousMatchState = null
}) {
  if (!candidateDataState?.artifact_type) throw new Error('TBZ PROBE RESPONSE LOOP: canonical candidate data state is required.')
  if (jobDataState?.artifact_type !== 'canonical_job_data_state') throw new Error('TBZ PROBE RESPONSE LOOP: canonical job data state is required.')
  if (probePlan?.artifact_type !== 'canonical_probe_plan') throw new Error('TBZ PROBE RESPONSE LOOP: canonical probe plan is required.')
  if (!Array.isArray(responses) || !responses.some((item) => item?.question_id && item?.answer?.trim())) throw new Error('TBZ PROBE RESPONSE LOOP: at least one probe response is required.')
  if (isProbeCycleComplete(probePlan)) throw new Error('TBZ PROBE RESPONSE LOOP: probe cycle is already complete.')

  const previousMatch = previousMatchState || candidateDataState?.match_state || null
  const responseQuality = classifyResponseQuality(responses)

  const candidateExecution = await executeEngine(
    engineRegistry,
    ENGINE_IDS.CANDIDATE,
    {
      candidate_data_state: candidateDataState,
      probe_responses: responses,
      source_probe_plan: probePlan
    }
  )

  if (candidateExecution.status !== 'completed' || !candidateExecution.output_artifact) throw new Error(candidateExecution.error || 'candidate_data_engine_failed')
  const updatedCandidate = candidateExecution.output_artifact

  const matchExecution = await executeEngine(
    engineRegistry,
    ENGINE_IDS.MATCH,
    {
      candidate_data_state: updatedCandidate,
      job_data_state: jobDataState
    }
  )

  if (matchExecution.status !== 'completed' || !matchExecution.output_artifact) throw new Error(matchExecution.error || 'match_engine_failed')
  const updatedMatch = matchExecution.output_artifact

  const candidateClosedProbePlan = closeAnsweredQuestions(probePlan, updatedCandidate)
  let canonicalProbePlan = candidateClosedProbePlan

  if (candidateClosedProbePlan.loop_closure.status !== 'complete' && responseQuality.status === 'usable') {
    const nextProbeExecution = await executeEngine(
      engineRegistry,
      ENGINE_IDS.PROBE,
      updatedMatch
    )

    if (nextProbeExecution.status !== 'completed' || !nextProbeExecution.output_artifact) throw new Error(nextProbeExecution.error || 'probe_engine_failed')

    canonicalProbePlan = closeAnsweredQuestions(nextProbeExecution.output_artifact, updatedCandidate)
  }

  canonicalProbePlan = applyAdaptiveDecision(canonicalProbePlan, probePlan, responseQuality)

  const previousScore = getScore(previousMatch)
  const currentScore = getScore(updatedMatch)

  return {
    previous_match_state: previousMatch,
    previous_score: previousScore,
    current_score: currentScore,
    score_delta: previousScore !== null && currentScore !== null ? currentScore - previousScore : null,
    probe_cycle_status: canonicalProbePlan.loop_closure.status,
    probe_adaptive_decision: canonicalProbePlan.loop_closure.decision,
    probe_response_quality: responseQuality,
    canonical_candidate_data_state: updatedCandidate,
    canonical_match_state: updatedMatch,
    canonical_probe_plan: canonicalProbePlan
  }
}
