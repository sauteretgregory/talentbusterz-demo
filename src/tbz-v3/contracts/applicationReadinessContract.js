import { TBZ_ARTIFACT_TYPES } from '../artifactTypes.js'

export const APPLICATION_READINESS_CONTRACT_VERSION = 'v1.0'

export const APPLICATION_READINESS_STATUSES = Object.freeze([
  'ready',
  'needs_clarification',
  'not_ready'
])

export const APPLICATION_READINESS_DECISIONS = Object.freeze([
  'prepare_application',
  'clarification_required',
  'continue_probe'
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
  if (value !== null && typeof value !== 'number') {
    throw new Error(`TBZ: ${path} must be a number or null.`)
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
  probeFinalState
}) {
  assertCanonicalArtifact(
    candidateDataState,
    TBZ_ARTIFACT_TYPES.CANDIDATE,
    'candidate_data_state'
  )
  assertCanonicalArtifact(
    jobDataState,
    TBZ_ARTIFACT_TYPES.JOB,
    'job_data_state'
  )
  assertCanonicalArtifact(
    matchState,
    TBZ_ARTIFACT_TYPES.MATCH,
    'match_state'
  )
  assertObject(probeFinalState, 'probe_final_state')

  if (probeFinalState.contract_version !== 'v1.0') {
    throw new Error('TBZ: application readiness requires PROBE final state contract v1.0.')
  }

  const score = matchState?.match_state?.professional_compatibility?.professional_match_score
  assertNullableNumber(score, 'match_score')

  if (score === null) {
    throw new Error('TBZ: application readiness requires a canonical MATCH score.')
  }

  let status = 'not_ready'
  let decision = 'continue_probe'
  let reason = 'probe_cycle_remains_open'
  let blockers = ['probe_cycle_incomplete']

  if (probeFinalState.status === 'needs_clarification') {
    status = 'needs_clarification'
    decision = 'clarification_required'
    reason = 'probe_answers_require_clarification_before_application_preparation'
    blockers = ['probe_clarification_required']
  } else if (probeFinalState.status === 'complete') {
    status = 'ready'
    decision = 'prepare_application'
    reason = 'candidate_profile_and_match_evidence_are_stabilized_for_application_preparation'
    blockers = []
  } else if (probeFinalState.status !== 'open') {
    throw new Error('TBZ: unsupported PROBE final state status for application readiness.')
  }

  const artifactId = createArtifactId(candidateDataState, jobDataState)

  return {
    artifact_type: TBZ_ARTIFACT_TYPES.APPLICATION_READINESS,
    artifact_id: artifactId,
    artifact_filename: `${artifactId}.json`.replace('_v1.json', '_v1.0.json'),
    state_version: 'v1.0',
    contract_version: APPLICATION_READINESS_CONTRACT_VERSION,
    application_readiness: {
      status,
      decision,
      reason,
      blockers,
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

  const readiness = state.application_readiness
  assertObject(readiness, 'application_readiness')

  if (!APPLICATION_READINESS_STATUSES.includes(readiness.status)) {
    throw new Error('TBZ: application readiness has an unsupported status.')
  }

  if (!APPLICATION_READINESS_DECISIONS.includes(readiness.decision)) {
    throw new Error('TBZ: application readiness has an unsupported decision.')
  }

  if (typeof readiness.reason !== 'string' || !readiness.reason.trim()) {
    throw new Error('TBZ: application readiness reason is required.')
  }

  if (!Array.isArray(readiness.blockers) || readiness.blockers.some((item) => typeof item !== 'string')) {
    throw new Error('TBZ: application readiness blockers must be an array of strings.')
  }

  assertNullableNumber(readiness.match_score, 'application_readiness.match_score')

  if (typeof readiness.probe_status !== 'string' || typeof readiness.probe_decision !== 'string') {
    throw new Error('TBZ: application readiness PROBE state is required.')
  }

  const validCombination =
    (readiness.status === 'ready' && readiness.decision === 'prepare_application' && readiness.probe_status === 'complete') ||
    (readiness.status === 'needs_clarification' && readiness.decision === 'clarification_required' && readiness.probe_status === 'needs_clarification') ||
    (readiness.status === 'not_ready' && readiness.decision === 'continue_probe' && readiness.probe_status === 'open')

  if (!validCombination) {
    throw new Error('TBZ: application readiness status, decision and PROBE status are inconsistent.')
  }

  if (readiness.status === 'ready' && readiness.blockers.length > 0) {
    throw new Error('TBZ: ready application readiness cannot contain blockers.')
  }

  if (readiness.status !== 'ready' && readiness.blockers.length === 0) {
    throw new Error('TBZ: non-ready application readiness must contain at least one blocker.')
  }

  if (state.validation_report?.validation_status !== 'passed') {
    throw new Error('TBZ: application readiness canonical validation did not pass.')
  }

  return state
}
