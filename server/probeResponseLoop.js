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

export async function processProbeResponses({
  engineRegistry,
  candidateDataState,
  jobDataState,
  probePlan,
  responses
}) {
  if (!candidateDataState?.artifact_type) throw new Error('TBZ PROBE RESPONSE LOOP: canonical candidate data state is required.')
  if (jobDataState?.artifact_type !== 'canonical_job_data_state') throw new Error('TBZ PROBE RESPONSE LOOP: canonical job data state is required.')
  if (probePlan?.artifact_type !== 'canonical_probe_plan') throw new Error('TBZ PROBE RESPONSE LOOP: canonical probe plan is required.')
  if (!Array.isArray(responses) || !responses.some((item) => item?.question_id && item?.answer?.trim())) throw new Error('TBZ PROBE RESPONSE LOOP: at least one probe response is required.')

  const previousMatch = candidateDataState?.match_state || null

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

  const nextProbeExecution = await executeEngine(
    engineRegistry,
    ENGINE_IDS.PROBE,
    updatedMatch
  )

  if (nextProbeExecution.status !== 'completed' || !nextProbeExecution.output_artifact) throw new Error(nextProbeExecution.error || 'probe_engine_failed')

  const canonicalProbePlan = closeAnsweredQuestions(nextProbeExecution.output_artifact, updatedCandidate)
  const previousScore = getScore(previousMatch) ?? getScore(candidateDataState)
  const currentScore = getScore(updatedMatch)

  return {
    previous_match_state: previousMatch,
    previous_score: previousScore,
    current_score: currentScore,
    score_delta: previousScore !== null && currentScore !== null ? currentScore - previousScore : null,
    probe_cycle_status: canonicalProbePlan.loop_closure.status,
    canonical_candidate_data_state: updatedCandidate,
    canonical_match_state: updatedMatch,
    canonical_probe_plan: canonicalProbePlan
  }
}