import { ENGINE_IDS, executeEngine } from './engineGateway.js'
import { createProbeFinalState, assertProbeFinalState } from '../src/tbz-v3/contracts/probeFinalStateContract.js'
import { ENRICHMENT_CYCLE_SIZE, ENRICHMENT_DECISIONS, selectEnrichmentBatch, getRemainingEnrichmentCount, estimatePotentialScoreGain, createOfferIndependentEnrichmentPlan } from '../src/tbz-v3/enrichmentCycle.js'

function getScore(match) { const value = match?.match_state?.professional_compatibility?.professional_match_score; return typeof value === 'number' ? Math.round(value) : null }
function getQuestionIds(plan) { return [...(plan?.probe_plan?.critical_questions || []), ...(plan?.probe_plan?.secondary_questions || [])].map((q) => q?.question_id).filter(Boolean) }
function normalizeAnswer(answer) { return String(answer || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() }
function isInsufficientAnswer(answer) { const n = normalizeAnswer(answer); return n.length < 2 || /^(je ne sais pas|je sais pas|aucune idee|pas d'idee|je ne peux pas|impossible|pas sur|je ne suis pas sur|inconnu|unknown|n\/a|na)$/i.test(n) }
function isPassAnswer(answer) { return /^(passer|passe|skip|je passe|sans reponse)$/i.test(normalizeAnswer(answer)) }
function isContradictoryAnswer(answer) { const n = normalizeAnswer(answer); return /\b(oui|yes)\b/.test(n) && /\b(non|no)\b/.test(n) }
function classifyResponseQuality(responses) { const usable = responses.filter((r) => !r?.skipped && !isPassAnswer(r?.answer)); const insufficientQuestionIds = usable.filter((r) => isInsufficientAnswer(r?.answer)).map((r) => r?.question_id).filter(Boolean); const contradictoryQuestionIds = usable.filter((r) => isContradictoryAnswer(r?.answer)).map((r) => r?.question_id).filter(Boolean); return { status: contradictoryQuestionIds.length ? 'contradictory' : insufficientQuestionIds.length ? 'insufficient' : 'usable', insufficient_question_ids: insufficientQuestionIds, contradictory_question_ids: contradictoryQuestionIds } }

function closeAnsweredQuestions(probePlan, candidateDataState) {
  const answered = new Set(candidateDataState?.candidate_data_state?.probe_response_state?.applied_question_ids || [])
  const next = structuredClone(probePlan)
  const critical = next?.probe_plan?.critical_questions || []
  const secondary = next?.probe_plan?.secondary_questions || []
  const remainingCritical = critical.filter((q) => !answered.has(q?.question_id))
  const remainingSecondary = secondary.filter((q) => !answered.has(q?.question_id))
  const originalIds = getQuestionIds(probePlan)
  const remainingIds = new Set([...remainingCritical, ...remainingSecondary].map((q) => q?.question_id).filter(Boolean))
  next.probe_plan.critical_questions = remainingCritical
  next.probe_plan.secondary_questions = remainingSecondary
  next.probe_result = { ...(next.probe_result || {}), probe_triggered: remainingIds.size > 0, recommended_question_count: Math.min(ENRICHMENT_CYCLE_SIZE, remainingIds.size), loop_status: remainingIds.size > 0 ? 'open' : 'complete', answered_question_count: originalIds.filter((id) => answered.has(id)).length, remaining_question_count: remainingIds.size }
  next.loop_closure = { ...(next.loop_closure || {}), status: remainingIds.size > 0 ? 'open' : 'complete', answered_question_ids: [...answered].filter((id) => originalIds.includes(id)), remaining_question_ids: [...remainingIds] }
  return next
}

function markCycleContinuation(probePlan, originalProbePlan, cycleNumber, candidateDataState, currentScore) {
  const next = structuredClone(probePlan)
  const applied = candidateDataState?.candidate_data_state?.probe_response_state?.applied_question_ids || []
  const cycleIds = getQuestionIds(originalProbePlan)
  const answeredThisCycle = cycleIds.filter((id) => applied.includes(id)).length
  const cycleComplete = cycleIds.length > 0 && answeredThisCycle >= cycleIds.length
  const remainingQuestionCount = getRemainingEnrichmentCount(next, applied)
  const potentialScoreGain = cycleComplete ? Math.max(10, estimatePotentialScoreGain({ remainingQuestionCount, currentScore })) : 0
  const batch = selectEnrichmentBatch(next, applied)
  const status = cycleComplete ? 'awaiting_continuation' : (remainingQuestionCount > 0 ? 'open' : 'complete')
  const decision = cycleComplete ? ENRICHMENT_DECISIONS.CONTINUE : (remainingQuestionCount > 0 ? 'continue_probe' : 'complete')
  next.loop_closure = { ...(next.loop_closure || {}), status, decision, decision_reason: cycleComplete ? 'five_question_enrichment_cycle_completed_waiting_for_candidate_choice' : 'material_candidate_answerable_gaps_remain', remaining_question_ids: batch.map((q) => q.question_id) }
  next.probe_result = { ...(next.probe_result || {}), loop_status: status, adaptive_decision: decision, remaining_question_count: remainingQuestionCount, recommended_question_count: Math.min(ENRICHMENT_CYCLE_SIZE, remainingQuestionCount), enrichment_cycle: { cycle_number: cycleNumber, cycle_size: ENRICHMENT_CYCLE_SIZE, answered_question_count: answeredThisCycle, estimated_potential_score_gain: potentialScoreGain, estimated_gain_basis: cycleComplete ? 'continued_enrichment_is_estimated_to_be_capable_of_adding_up_to_ten_match_points' : 'cycle_in_progress', profile_scope: 'persistent_candidate_profile', offer_scope: 'current_match_context_only' } }
  return next
}

function applyAdaptiveDecision(probePlan, responseQuality, originalProbePlan) {
  if (responseQuality.status === 'usable') return probePlan
  const next = structuredClone(probePlan)
  const ids = new Set([...responseQuality.insufficient_question_ids, ...responseQuality.contradictory_question_ids])
  const originalCritical = originalProbePlan?.probe_plan?.critical_questions || []
  const originalSecondary = originalProbePlan?.probe_plan?.secondary_questions || []
  const currentCritical = next?.probe_plan?.critical_questions || []
  const currentSecondary = next?.probe_plan?.secondary_questions || []
  next.probe_plan.critical_questions = [...currentCritical, ...originalCritical.filter((q) => ids.has(q?.question_id) && !currentCritical.some((x) => x?.question_id === q?.question_id))]
  next.probe_plan.secondary_questions = [...currentSecondary, ...originalSecondary.filter((q) => ids.has(q?.question_id) && !currentSecondary.some((x) => x?.question_id === q?.question_id))]
  next.loop_closure = { ...(next.loop_closure || {}), status: 'needs_clarification', decision: 'clarification_required', decision_reason: responseQuality.status === 'contradictory' ? 'one_or_more_candidate_answers_contain_conflicting_assertions' : 'one_or_more_candidate_answers_are_insufficient_to_stabilize_evidence', insufficient_question_ids: responseQuality.insufficient_question_ids, contradictory_question_ids: responseQuality.contradictory_question_ids, remaining_question_ids: getQuestionIds(next) }
  next.probe_result = { ...(next.probe_result || {}), loop_status: 'needs_clarification', adaptive_decision: 'clarification_required', decision_reason: next.loop_closure.decision_reason, remaining_question_count: getQuestionIds(next).length }
  return next
}

async function runMatch(engineRegistry, candidateDataState, jobDataState) { const execution = await executeEngine(engineRegistry, ENGINE_IDS.MATCH, { candidate_data_state: candidateDataState, job_data_state: jobDataState }); if (execution.status !== 'completed' || !execution.output_artifact) throw new Error(execution.error || 'match_engine_failed'); return execution.output_artifact }
async function generateNextProbe(engineRegistry, matchState, candidateDataState, cycleNumber) { const execution = await executeEngine(engineRegistry, ENGINE_IDS.PROBE, matchState); if (execution.status !== 'completed' || !execution.output_artifact) throw new Error(execution.error || 'probe_engine_failed'); const candidateSpecificPlan = closeAnsweredQuestions(execution.output_artifact, candidateDataState); return getQuestionIds(candidateSpecificPlan).length ? candidateSpecificPlan : createOfferIndependentEnrichmentPlan(cycleNumber) }

export async function processProbeResponses({ engineRegistry, candidateDataState, jobDataState, probePlan, responses = [], previousMatchState = null, continueEnrichment = null, cycleNumber = 1 }) {
  const control = responses.find((r) => r?.control === ENRICHMENT_DECISIONS.CONTINUE || r?.control === ENRICHMENT_DECISIONS.STOP)?.control || continueEnrichment
  const actualResponses = responses.filter((r) => !r?.control)
  if (!candidateDataState?.artifact_type) throw new Error('TBZ PROBE RESPONSE LOOP: canonical candidate data state is required.')
  if (jobDataState?.artifact_type !== 'canonical_job_data_state') throw new Error('TBZ PROBE RESPONSE LOOP: canonical job data state is required.')
  if (probePlan?.artifact_type !== 'canonical_probe_plan') throw new Error('TBZ PROBE RESPONSE LOOP: canonical probe plan is required.')
  if (!control && probePlan?.loop_closure?.status === 'complete') throw new Error('TBZ PROBE RESPONSE LOOP: probe cycle is already complete.')
  const previousMatch = previousMatchState || candidateDataState?.match_state || null
  const previousScore = getScore(previousMatch)

  if (control === ENRICHMENT_DECISIONS.STOP) {
    const finalPlan = structuredClone(probePlan)
    finalPlan.loop_closure = { ...(finalPlan.loop_closure || {}), status: 'complete', decision: ENRICHMENT_DECISIONS.STOP, decision_reason: 'candidate_declined_further_profile_enrichment' }
    finalPlan.probe_result = { ...(finalPlan.probe_result || {}), loop_status: 'complete', adaptive_decision: ENRICHMENT_DECISIONS.STOP }
    const finalState = assertProbeFinalState(createProbeFinalState(finalPlan))
    return { previous_match_state: previousMatch, previous_score: previousScore, current_score: previousScore, score_delta: 0, probe_cycle_status: 'complete', probe_adaptive_decision: ENRICHMENT_DECISIONS.STOP, enrichment_cycle: finalPlan.probe_result.enrichment_cycle, probe_final_state: finalState, application_stage: 'cv_ready', next_stage: 'render_ready', canonical_candidate_data_state: candidateDataState, canonical_match_state: previousMatch, canonical_probe_plan: finalPlan }
  }

  if (control === ENRICHMENT_DECISIONS.CONTINUE && actualResponses.length === 0) {
    const nextPlan = await generateNextProbe(engineRegistry, previousMatch, candidateDataState, cycleNumber + 1)
    nextPlan.loop_closure = { ...(nextPlan.loop_closure || {}), status: 'open', decision: nextPlan.loop_closure?.decision === 'continue_enrichment' ? 'continue_enrichment' : 'continue_probe', decision_reason: 'new_five_question_enrichment_cycle_ready' }
    nextPlan.probe_result = { ...(nextPlan.probe_result || {}), loop_status: 'open', adaptive_decision: nextPlan.loop_closure.decision, recommended_question_count: ENRICHMENT_CYCLE_SIZE }
    const finalState = assertProbeFinalState(createProbeFinalState(nextPlan))
    return { previous_match_state: previousMatch, previous_score: previousScore, current_score: previousScore, score_delta: 0, probe_cycle_status: 'open', probe_adaptive_decision: nextPlan.loop_closure.decision, enrichment_cycle: { ...(nextPlan.probe_result.enrichment_cycle || {}), cycle_number: cycleNumber + 1, cycle_size: ENRICHMENT_CYCLE_SIZE }, probe_final_state: finalState, application_stage: 'enrichment_open', next_stage: null, canonical_candidate_data_state: candidateDataState, canonical_match_state: previousMatch, canonical_probe_plan: nextPlan }
  }

  if (!actualResponses.some((item) => item?.question_id && (item?.answer?.trim() || item?.skipped))) throw new Error('TBZ PROBE RESPONSE LOOP: at least one answered or skipped question is required.')
  const responseQuality = classifyResponseQuality(actualResponses)
  const candidateExecution = await executeEngine(engineRegistry, ENGINE_IDS.CANDIDATE, { candidate_data_state: candidateDataState, probe_responses: actualResponses, source_probe_plan: probePlan })
  if (candidateExecution.status !== 'completed' || !candidateExecution.output_artifact) throw new Error(candidateExecution.error || 'candidate_data_engine_failed')
  const updatedCandidate = candidateExecution.output_artifact
  const updatedMatch = await runMatch(engineRegistry, updatedCandidate, jobDataState)
  const currentScore = getScore(updatedMatch)
  const scoreDelta = previousScore !== null && currentScore !== null ? currentScore - previousScore : null
  let canonicalProbePlan = closeAnsweredQuestions(probePlan, updatedCandidate)
  canonicalProbePlan = applyAdaptiveDecision(canonicalProbePlan, responseQuality, probePlan)
  if (responseQuality.status === 'usable') canonicalProbePlan = markCycleContinuation(canonicalProbePlan, probePlan, cycleNumber, updatedCandidate, currentScore)
  const finalState = assertProbeFinalState(createProbeFinalState(canonicalProbePlan))
  return { previous_match_state: previousMatch, previous_score: previousScore, current_score: currentScore, score_delta: scoreDelta, probe_cycle_status: finalState.status, probe_adaptive_decision: finalState.decision, probe_response_quality: responseQuality, enrichment_cycle: canonicalProbePlan.probe_result.enrichment_cycle, remaining_enrichment_question_count: canonicalProbePlan.probe_result.remaining_question_count || 0, estimated_potential_score_gain: canonicalProbePlan.probe_result.enrichment_cycle?.estimated_potential_score_gain || 0, probe_final_state: finalState, application_stage: 'enrichment_open', next_stage: null, canonical_candidate_data_state: updatedCandidate, canonical_match_state: updatedMatch, canonical_probe_plan: canonicalProbePlan }
}
