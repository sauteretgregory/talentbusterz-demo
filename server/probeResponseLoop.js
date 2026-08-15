import {
  ENGINE_IDS,
  executeEngine
} from './engineGateway.js'

export async function processProbeResponses({
  engineRegistry,
  candidateDataState,
  jobDataState,
  probePlan,
  responses
}) {
  if (!candidateDataState?.artifact_type) {
    throw new Error('TBZ PROBE RESPONSE LOOP: canonical candidate data state is required.')
  }
  if (jobDataState?.artifact_type !== 'canonical_job_data_state') {
    throw new Error('TBZ PROBE RESPONSE LOOP: canonical job data state is required.')
  }
  if (probePlan?.artifact_type !== 'canonical_probe_plan') {
    throw new Error('TBZ PROBE RESPONSE LOOP: canonical probe plan is required.')
  }
  if (!Array.isArray(responses) || !responses.some((item) => item?.question_id && item?.answer?.trim())) {
    throw new Error('TBZ PROBE RESPONSE LOOP: at least one probe response is required.')
  }

  const candidateExecution = await executeEngine(
    engineRegistry,
    ENGINE_IDS.CANDIDATE,
    {
      candidate_data_state: candidateDataState,
      probe_responses: responses,
      source_probe_plan: probePlan
    }
  )

  if (candidateExecution.status !== 'completed' || !candidateExecution.output_artifact) {
    throw new Error(candidateExecution.error || 'candidate_data_engine_failed')
  }

  const updatedCandidate = candidateExecution.output_artifact

  const matchExecution = await executeEngine(
    engineRegistry,
    ENGINE_IDS.MATCH,
    {
      candidate_data_state: updatedCandidate,
      job_data_state: jobDataState
    }
  )

  if (matchExecution.status !== 'completed' || !matchExecution.output_artifact) {
    throw new Error(matchExecution.error || 'match_engine_failed')
  }

  const updatedMatch = matchExecution.output_artifact

  const nextProbeExecution = await executeEngine(
    engineRegistry,
    ENGINE_IDS.PROBE,
    updatedMatch
  )

  if (nextProbeExecution.status !== 'completed' || !nextProbeExecution.output_artifact) {
    throw new Error(nextProbeExecution.error || 'probe_engine_failed')
  }

  return {
    canonical_candidate_data_state: updatedCandidate,
    canonical_match_state: updatedMatch,
    canonical_probe_plan: nextProbeExecution.output_artifact
  }
}
