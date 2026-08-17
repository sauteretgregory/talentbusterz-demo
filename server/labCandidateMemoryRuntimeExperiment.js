import { executeEngine, ENGINE_IDS } from './engineGateway.js'
import { processProbeResponses } from './probeResponseLoop.js'

function assertCandidateId(candidateId) {
  if (typeof candidateId !== 'string' || !candidateId.trim()) {
    throw new Error('TBZ LAB candidate memory runtime: candidateId is required.')
  }
  return candidateId.trim()
}

function getCandidateVersion(candidateArtifact) {
  const version = candidateArtifact?.state_version ?? candidateArtifact?.candidate_data_state?.state_version
  if (version === undefined || version === null || String(version).trim() === '') {
    throw new Error('TBZ LAB candidate memory runtime: candidate state_version is required.')
  }
  return String(version)
}

export async function persistCandidateArtifact(repository, candidateArtifact, expectedVersion = null) {
  const candidateId = assertCandidateId(candidateArtifact?.candidate_data_state?.candidate_id)
  return repository.save(candidateId, candidateArtifact, expectedVersion)
}

export async function processProbeResponsesFromCandidateMemory({
  repository,
  engineRegistry,
  candidateId,
  jobDataState,
  probePlan,
  responses = [],
  previousMatchState = null,
  continueEnrichment = null,
  cycleNumber = 1
}) {
  if (!repository || typeof repository.get !== 'function' || typeof repository.save !== 'function') {
    throw new Error('TBZ LAB candidate memory runtime: repository with get() and save() is required.')
  }

  const id = assertCandidateId(candidateId)
  const candidateDataState = await repository.get(id)

  if (!candidateDataState) {
    throw new Error(`TBZ LAB candidate memory runtime: candidate "${id}" was not found.`)
  }

  const expectedVersion = getCandidateVersion(candidateDataState)
  const result = await processProbeResponses({
    engineRegistry,
    candidateDataState,
    jobDataState,
    probePlan,
    responses,
    previousMatchState,
    continueEnrichment,
    cycleNumber
  })

  if (result.canonical_candidate_data_state !== candidateDataState) {
    await persistCandidateArtifact(
      repository,
      result.canonical_candidate_data_state,
      expectedVersion
    )
  }

  return result
}

export async function rerunMatchFromCandidateMemory({
  repository,
  engineRegistry,
  candidateId,
  jobDataState
}) {
  const id = assertCandidateId(candidateId)
  const candidateDataState = await repository.get(id)

  if (!candidateDataState) {
    throw new Error(`TBZ LAB candidate memory runtime: candidate "${id}" was not found.`)
  }

  const execution = await executeEngine(engineRegistry, ENGINE_IDS.MATCH, {
    candidate_data_state: candidateDataState,
    job_data_state: jobDataState
  })

  if (execution.status !== 'completed' || !execution.output_artifact) {
    throw new Error(execution.error || 'match_engine_failed')
  }

  return execution.output_artifact
}
