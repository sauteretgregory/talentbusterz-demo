import { TBZ_ARTIFACT_TYPES } from '../artifactTypes.js'
import { assertProbeFinalState } from './probeFinalStateContract.js'

export const APPLICATION_READINESS_CONTRACT_VERSION = 'v1.0'
export const APPLICATION_READINESS_ENGINE_NAME = 'applicationReadinessContract'
export const APPLICATION_READINESS_ENGINE_VERSION = APPLICATION_READINESS_CONTRACT_VERSION

export const APPLICATION_READINESS_STATUSES = Object.freeze([
  'ready',
  'needs_clarification',
  'not_ready'
])

export const APPLICATION_READINESS_RECOMMENDATIONS = Object.freeze([
  'prepare_application',
  'clarification_recommended',
  'continue_enrichment'
])

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`TBZ: ${path} must be an object.`)
  }
}

function assertCanonicalArtifact(value, artifactType, path) {
  assertObject(value, path)
  if (value.artifact_type !== artifactType) {
    throw new Error(`TBZ: ${path} must be ${artifactType}.`)
  }
}

function assertNullableNumber(value, path) {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`TBZ: ${path} must be a finite number or null.`)
  }
}

function assertProvenance(value, path) {
  assertObject(value, path)

  for (const field of ['artifact_id', 'state_version', 'engine_name', 'engine_version']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) {
      throw new Error(`TBZ: ${path}.${field} is required.`)
    }
  }
}

function createArtifactId(candidate, job) {
  const candidateId = candidate.artifact_id || candidate.candidate_data_state?.candidate_identity?.candidate_id
  const jobId = job.artifact_id || job.job_data_state?.job_identity?.job_id

  if (!candidateId || !jobId) {
    throw new Error('TBZ: application readiness requires candidate and job artifact identifiers.')
  }

  return `application_readiness_${candidateId}_${jobId}_v1`
}

export function createApplicationReadinessState({
  candidateDataState,
  jobDataState,
  matchState,
  probeFinalState,
  generatedAt = new Date().toISOString()
}) {
  assertCanonicalArtifact(candidateDataState, TBZ_ARTIFACT_TYPES.CANDIDATE, 'candidate_data_state')
  assertCanonicalArtifact(jobDataState, TBZ_ARTIFACT_TYPES.JOB, 'job_data_state')
  assertCanonicalArtifact(matchState, TBZ_ARTIFACT_TYPES.MATCH, 'match_state')
  assertProbeFinalState(probeFinalState)

  if (typeof generatedAt !== 'string' || !generatedAt.trim() || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error('TBZ: application readiness generated_at must be a valid ISO date string.')
  }

  const score = matchState?.match_state?.professional_compatibility?.professional_match_score
  assertNullableNumber(score, 'match_score')

  if (score === null) {
    throw new Error('TBZ: application readiness requires a canonical MATCH score.')
  }

  const matchProvenance = {
    artifact_id: matchState.artifact_id,
    state_version: matchState.state_version || 'v1.0',
    engine_name: matchState.engine_name,
    engine_version: matchState.engine_version
  }
  const probeProvenance = {
    artifact_id: probeFinalState.artifact_id,
    state_version: probeFinalState.state_version,
    engine_name: probeFinalState.engine_name,
    engine_version: probeFinalState.engine_version
  }

  assertProvenance(matchProvenance, 'source_alignment.match')
  assertProvenance(probeProvenance, 'source_alignment.probe')

  let status = 'not_ready'
  let recommendation = 'continue_enrichment'
  let reason = 'probe_cycle_remains_open'
  let attentionPoints = []

  if (probeFinalState.status === 'needs_clarification') {
    status = 'needs_clarification'
    recommendation = 'clarification_recommended'
    reason = 'probe_answers_require_clarification_before_application_preparation'
    attentionPoints = ['probe_clarification_required']
  } else if (probeFinalState.status === 'complete') {
    status = 'ready'
    recommendation = 'prepare_application'
    reason = 'candidate_profile_and_match_evidence_are_stabilized_for_application_preparation'
    attentionPoints = []
  } else if (probeFinalState.status === 'awaiting_continuation') {
    status = 'not_ready'
    recommendation = 'continue_enrichment'
    reason = 'completed_enrichment_cycle_is_waiting_for_candidate_continuation_choice'
    attentionPoints = ['enrichment_continuation_choice_required']
  } else if (probeFinalState.status === 'open') {
    status = 'not_ready'
    recommendation = 'continue_enrichment'
    reason = 'probe_cycle_remains_open'
    attentionPoints = []
  } else {
    throw new Error('TBZ: unsupported PROBE final state status for application readiness.')
  }

  const artifactId = createArtifactId(candidateDataState, jobDataState)

  return {
    artifact_type: TBZ_ARTIFACT_TYPES.APPLICATION_READINESS,
    artifact_id: artifactId,
    artifact_filename: `${artifactId}.json`.replace('_v1.json', '_v1.0.json'),
    state_version: 'v1.0',
    contract_version: APPLICATION_READINESS_CONTRACT_VERSION,
    engine_name: APPLICATION_READINESS_ENGINE_NAME,
    engine_version: APPLICATION_READINESS_ENGINE_VERSION,
    generated_at: generatedAt,
    source_alignment: {
      match: matchProvenance,
      probe: probeProvenance
    },
    application_readiness: {
      status,
      recommendation,
      reason,
      attention_points: attentionPoints,
      match_score: score,
      probe_status: probeFinalState.status,
      probe_decision: probeFinalState.decision
    },
    validation_report: {
      validation_status: 'passed'
    }
  }
}

export function assertApplicationReadinessState(state) {
  assertObject(state, 'application_readiness_state')

  if (state.artifact_type !== TBZ_ARTIFACT_TYPES.APPLICATION_READINESS) {
    throw new Error('TBZ: output is not canonical_application_readiness_state.')
  }

  if (state.contract_version !== APPLICATION_READINESS_CONTRACT_VERSION) {
    throw new Error('TBZ: unsupported application readiness contract.')
  }

  if (state.state_version !== 'v1.0') {
    throw new Error('TBZ: unsupported application readiness state version.')
  }

  if (typeof state.artifact_id !== 'string' || !state.artifact_id.trim()) {
    throw new Error('TBZ: application readiness artifact_id is required.')
  }

  if (typeof state.artifact_filename !== 'string' || !state.artifact_filename.endsWith('.json')) {
    throw new Error('TBZ: application readiness artifact_filename must be a JSON filename.')
  }

  if (state.engine_name !== APPLICATION_READINESS_ENGINE_NAME) {
    throw new Error('TBZ: application readiness engine_name is invalid.')
  }

  if (state.engine_version !== APPLICATION_READINESS_ENGINE_VERSION) {
    throw new Error('TBZ: application readiness engine_version is invalid.')
  }

  if (typeof state.generated_at !== 'string' || Number.isNaN(Date.parse(state.generated_at))) {
    throw new Error('TBZ: application readiness generated_at must be a valid ISO date string.')
  }

  assertObject(state.source_alignment, 'source_alignment')
  assertProvenance(state.source_alignment.match, 'source_alignment.match')
  assertProvenance(state.source_alignment.probe, 'source_alignment.probe')

  const readiness = state.application_readiness
  assertObject(readiness, 'application_readiness')

  if (!APPLICATION_READINESS_STATUSES.includes(readiness.status)) {
    throw new Error('TBZ: application readiness has an unsupported status.')
  }

  if (!APPLICATION_READINESS_RECOMMENDATIONS.includes(readiness.recommendation)) {
    throw new Error('TBZ: application readiness has an unsupported recommendation.')
  }

  if (typeof readiness.reason !== 'string' || !readiness.reason.trim()) {
    throw new Error('TBZ: application readiness reason is required.')
  }

  if (!Array.isArray(readiness.attention_points) || readiness.attention_points.some((item) => typeof item !== 'string')) {
    throw new Error('TBZ: application readiness attention_points must be an array of strings.')
  }

  assertNullableNumber(readiness.match_score, 'application_readiness.match_score')

  if (typeof readiness.probe_status !== 'string' || typeof readiness.probe_decision !== 'string') {
    throw new Error('TBZ: application readiness PROBE state is required.')
  }

  const validCombination =
    (readiness.status === 'ready' && readiness.probe_status === 'complete') ||
    (readiness.status === 'needs_clarification' && readiness.probe_status === 'needs_clarification') ||
    (readiness.status === 'not_ready' && ['open', 'awaiting_continuation'].includes(readiness.probe_status))

  if (!validCombination) {
    throw new Error('TBZ: application readiness status and PROBE status are inconsistent.')
  }

  if (state.validation_report?.validation_status !== 'passed') {
    throw new Error('TBZ: application readiness canonical validation did not pass.')
  }

  return state
}
