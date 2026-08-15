import { ENGINE_IDS, executeEngine } from './engineGateway.js'
import { createProbeFinalState, assertProbeFinalState } from '../src/tbz-v3/contracts/probeFinalStateContract.js'
import { ENRICHMENT_CYCLE_SIZE, ENRICHMENT_DECISIONS, selectEnrichmentBatch, getRemainingEnrichmentCount, estimatePotentialScoreGain } from '../src/tbz-v3/enrichmentCycle.js'

function getScore(match) {
  const value = match?.match_state?.professional_compatibility?.professional_match_score
  return typeof value === 'number' ? Math.round(value) : null
}

function getQuestionIds(probePlan) {
  return [...(probePlan?.probe_plan?.critical_questions || []), ...(probePlan?.probe_plan?.secondary_questions || [])]
    .map((question) => question?.question_id).filter(Boolean)
}

function normalizeAnswer(answer) {
  return String(answer || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function isInsufficientAnswer(answer) {
  const normalized = normalizeAnswer(answer)
  return normalized.length < 2 || /^(je ne sais pas|je sais pas|aucune idee|pas d'idee|je ne peux pas|impossible|pas sur|je ne suis pas sur|inconnu|unknown|n\/a|na)$/i.test(normalized)
}

function isPassAnswer(answer) {
  return /^(passer|passe|skip|je passe|sans reponse)$/i.test(normalizeAnswer(answer))
}

function isContradictoryAnswer(answer) {
  const normalized = normalizeAnswer(answer)
  return /\b(oui|yes)\b/.test(normalized) && /\b(non|no)\b/.test(normalized)
}

function classifyResponseQuality(responses) {
  const usable = responses.filter((response) => !response?.skipped && !isPassAnswer(response?.answer))
  const insufficientQuestionIds = usable.filter((response) => isInsufficientAnswer(response?.answer)).map((response) => response?.question_id).filter(Boolean)
  const contradictoryQuestionIds = usable.filter((response) => isContradictoryAnswer(response?.answer)).map((response) => response?.question_id).filter(Boolean)
  return {
    status: contradictoryQuestionIds.length ? 'contradictory' : insufficientQuestionIds.length ? 'insufficient' : 'usable',
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
  const originalIds = getQuestionIds(probePlan)
  const remainingIds = new Set([...remainingCritical, ...remainingSecondary].map((question) => question?.question_id).filter(Boolean))

  next.probe_plan.critical_questions = remainingCritical
  next.probe_plan.secondary_questions = remainingSecondary
  next.probe_result = {
    ...(next.probe_result || {}),
    probe_triggered: remainingIds.size > 0,
    recommended_question_count: Math.min(ENRICHMENT_CYCLE_SIZE, remainingIds.size),
    loop_status: remainingIds.size > 0 ? 'open' : 'complete',
    answered_question_count: originalIds.filter((id) => answered.has(id)).length,
    remaining_question_count: remainingIds.size
  }
  next.loop_closure = {
    ...(next.loop_closure || {}),
    status: remainingIds.size > 0 ? 'open' : 'complete',
    answered_question_ids: [...answered].filter((id) => originalIds.includes(id)),
    remaining_question_ids: [...remainingIds]
  }
  return next
}

function markAwaitingContinuation(probePlan, cycleNumber, candidateDataState, currentScore) {
  const next = structuredClone(probePlan)
  const applied = candidateDataState?.candidate_data_state?.probe_response_state?.applied_question_ids || []
  const remainingQuestionCount = getRemainingEnrichmentCount(next, applied)
  const potentialScoreGain = estimatePotentialScoreGain({ remainingQuestionCount, currentScore })
  const batch = selectEnrichmentBatch(next, applied)
  const status = remainingQuestionCount > 0 ? 'awaiting_continuation' : 'complete'
  const decision = remainingQuestionCount > 0 ? ENRICHMENT_DECISIONS.CONTINUE : 'complete'

  next.loop_closure = {
    ...(next.loop_closure || {}),
    status,
    decision,
    decision_reason: remainingQuestionCount > 0 ? 'five_question_enrichment_cycle_completed_waiting_for_candidate_choice' : 'no_remaining_candidate_answerable_gap',
    remaining_question_ids: batch.map((question) => question.question_id)
  }
  next.probe_result = {
    ...(next.probe_result || {}),
    loop_status: status,
    adaptive_decision: decision,
    remaining_question_count: remainingQuestionCount,
    recommended_question_count: Math.min(ENRICHMENT_CYCLE_SIZE, remainingQuestionCount),
    enrichment_cycle: {
      cycle_number: cycleNumber,
      cycle_size: ENRICHMENT_CYCLE_SIZE,
      answered_question_count: applied.length,
      estimated_potential_score_gain: potentialScoreGain,
      estimated_gain_basis: potentialScoreGain > 0 ? 'candidate_profile_enrichment_can_resolve_remaining_material_gaps' : 'no_material_answerable_gap_remaining',
      profile_scope: 'persistent_candidate_profile',
      offer_scope: 'current_match_context_only'
    }
  }
  return next
}

function applyAdaptiveDecision(probePlan, responseQuality) {
  if (responseQuality.status === 'usable') return probePlan
  const next = structuredClone(probePlan)
  next.loop_closure = {
    ...(next.loop_closure || {}),
    status: 'needs_clarification',
    decision: 'clarification_required',
    decision_reason: responseQuality.status === 'contradictory' ? 'one_or_more_candidate_answers_contain_conflicting_assertions' : 'one_or_more_candidate_answers_are_insufficient_to_stabilize_evidence',
    insufficient_question_ids: responseQuality.insufficient_question_ids,
    contradictory_question_ids: responseQuality.contradictory_question_ids
  }
  next.probe_result = {
    ...(next.probe_result || {}),
    loop_status: 'needs_clarification',
    adaptive_decision: 'clarification_required',
    decision_reason: next.loop_closure.decision_reason
  }
  return next
}

async function runMatch(engineRegistry, candidateDataState, jobDataState) {
  const execution = await executeEngine(engineRegistry, ENGINE_IDS.MATCH, { candidate_data_state: candidateDataState, job_data_state: jobDataState })
  if (execution.status !== 'completed' || !execution.output_artifact) throw new Error(execution.error || 'match_engine_failed')
  return execution.output_artifact
}

async function generateNextProbe(engineRegistry, matchState, candidateDataState) {
  const execution = await executeEngine(engineRegistry, ENGINE_IDS.PROBE, matchState)
  if (execution.status !== 'completed' || !execution.output_artifact) throw new Error(execution.error || 'probe_engine_failed')
  return closeAnsweredQuestions(execution.output_artifact, candidateDataState)
}

export async function processProbeResponses({
  engineRegistry,
  candidateDataState,
  jobDataState,
  probePlan,
  responses = [],
  previousMatchState = null,
  continueEnrichment = null,
  cycleNumber = 1
}) {
  if (!candidateDataState?.artifact_type) throw new Error('TBZ PROBE RESPONSE LOOP: canonical candidate data state is required.')
  if (jobDataState?.artifact_type !== 'canonical_job_data_state') throw new Error('TBZ PROBE RESPONSE LOOP: canonical job data state is required.')
  if (probePlan?.artifact_type !== 'canonical_probe_plan') throw new Error('TBZ PROBE RESPONSE LOOP: canonical probe plan is required.')

  const previousMatch = previousMatchState || candidateDataState?.match_state || null
  const previousScore = getScore(previousMatch)

  if (continueEnrichment === ENRICHMENT_DECISIONS.STOP) {
    const finalPlan = markAwaitingContinuation(probePlan, cycleNumber, candidateDataState, previousScore)
    finalPlan.loop_closure.status = 'complete'
    finalPlan.loop_closure.decision = ENRICHMENT_DECISIONS.STOP
    finalPlan.loop_closure.decision_reason = 'candidate_declined_further_profile_enrichment'
    finalPlan.probe_result.loop_status = 'complete'
    finalPlan.probe_result.adaptive_decision = ENRICHMENT_DECISIONS.STOP
    const finalState = assertProbeFinalState(createProbeFinalState(finalPlan))
    return {
      previous_match_state: previousMatch, previous_score: previousScore, current_score: previousScore, score_delta: 0,
      probe_cycle_status: 'complete', probe_adaptive_decision: ENRICHMENT_DECISIONS.STOP,
      enrichment_cycle: finalPlan.probe_result.enrichment_cycle, probe_final_state: finalState,
      application_stage: 'cv_ready', next_stage: 'render_ready',
      canonical_candidate_data_state: candidateDataState, canonical_match_state: previousMatch, canonical_probe_plan: finalPlan
    }
  }

  if (continueEnrichment === ENRICHMENT_DECISIONS.CONTINUE && responses.length === 0) {
    const nextProbe = await generateNextProbe(engineRegistry, previousMatch, candidateDataState)
    const nextPlan = markAwaitingContinuation(nextProbe, cycleNumber + 1, candidateDataState, previousScore)
    const finalState = assertProbeFinalState(createProbeFinalState(nextPlan))
    return {
      previous_match_state: previousMatch, previous_score: previousScore, current_score: previousScore, score_delta: 0,
      probe_cycle_status: nextPlan.loop_closure.status, probe_adaptive_decision: nextPlan.loop_closure.decision,
      enrichment_cycle: nextPlan.probe_result.enrichment_cycle, probe_final_state: finalState,
      application_stage: 'enrichment_open', next_stage: null,
      canonical_candidate_data_state: candidateDataState, canonical_match_state: previousMatch, canonical_probe_plan: nextPlan
    }
  }

  if (!Array.isArray(responses) || !responses.some((item) => item?.question_id && (item?.answer?.trim() || item?.skipped))) {
    throw new Error('TBZ PROBE RESPONSE LOOP: at least one answered or skipped question is required.')
  }

  const responseQuality = classifyResponseQuality(responses)
  const candidateExecution = await executeEngine(engineRegistry, ENGINE_IDS.CANDIDATE, {
    candidate_data_state: candidateDataState, probe_responses: responses, source_probe_plan: probePlan
  })
  if (candidateExecution.status !== 'completed' || !candidateExecution.output_artifact) throw new Error(candidateExecution.error || 'candidate_data_engine_failed')
  const updatedCandidate = candidateExecution.output_artifact
  const updatedMatch = await runMatch(engineRegistry, updatedCandidate, jobDataState)
  const currentScore = getScore(updatedMatch)
  const scoreDelta = previousScore !== null && currentScore !== null ? currentScore - previousScore : null

  let canonicalProbePlan = closeAnsweredQuestions(probePlan, updatedCandidate)
  canonicalProbePlan = applyAdaptiveDecision(canonicalProbePlan, responseQuality)
  if (responseQuality.status === 'usable') canonicalProbePlan = markAwaitingContinuation(canonicalProbePlan, cycleNumber, updatedCandidate, currentScore)

  const finalState = assertProbeFinalState(createProbeFinalState(canonicalProbePlan))
  return {
    previous_match_state: previousMatch, previous_score: previousScore, current_score: currentScore, score_delta: scoreDelta,
    probe_cycle_status: finalState.status, probe_adaptive_decision: finalState.decision,
    probe_response_quality: responseQuality,
    enrichment_cycle: canonicalProbePlan.probe_result.enrichment_cycle,
    remaining_enrichment_question_count: canonicalProbePlan.probe_result.remaining_question_count || 0,
    estimated_potential_score_gain: canonicalProbePlan.probe_result.enrichment_cycle?.estimated_potential_score_gain || 0,
    probe_final_state: finalState, application_stage: 'enrichment_open', next_stage: null,
    canonical_candidate_data_state: updatedCandidate, canonical_match_state: updatedMatch, canonical_probe_plan: canonicalProbePlan
  }
}
