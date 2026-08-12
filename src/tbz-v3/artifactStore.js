/**
 * TalentBusterZ V3 — Canonical Artifact Store
 *
 * Frontend boundary:
 * - stores canonical artifacts received from TBZ engines
 * - does NOT perform matching
 * - does NOT enrich candidate/job state
 * - does NOT generate probe questions
 * - does NOT reinterpret canonical engine decisions
 */

export const TBZ_ARTIFACT_TYPES = Object.freeze({
  CANDIDATE: 'canonical_candidate_state',
  JOB: 'canonical_job_state',
  MATCH: 'canonical_match_state',
  PROBE_PLAN: 'canonical_probe_plan',
  PROBE_DIALOG: 'canonical_probe_dialog_state'
})

export function createArtifactStore() {
  return {
    candidate: null,
    job: null,
    match: null,
    probePlan: null,
    probeDialog: null
  }
}

export function getArtifactSlot(artifactType) {
  switch (artifactType) {
    case TBZ_ARTIFACT_TYPES.CANDIDATE:
      return 'candidate'
    case TBZ_ARTIFACT_TYPES.JOB:
      return 'job'
    case TBZ_ARTIFACT_TYPES.MATCH:
      return 'match'
    case TBZ_ARTIFACT_TYPES.PROBE_PLAN:
      return 'probePlan'
    case TBZ_ARTIFACT_TYPES.PROBE_DIALOG:
      return 'probeDialog'
    default:
      return null
  }
}

export function ingestCanonicalArtifact(store, artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error('TBZ V3: artifact must be a JSON object.')
  }

  const artifactType = artifact.artifact_type

  if (!artifactType) {
    throw new Error('TBZ V3: artifact_type is missing.')
  }

  const slot = getArtifactSlot(artifactType)

  if (!slot) {
    throw new Error(
      `TBZ V3: unsupported artifact_type "${artifactType}".`
    )
  }

  return {
    ...store,
    [slot]: artifact
  }
}
