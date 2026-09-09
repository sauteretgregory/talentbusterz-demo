import { TBZ_ARTIFACT_TYPES } from './artifactTypes.js'
import { validateCanonicalArtifact } from './artifactValidator.js'

export { TBZ_ARTIFACT_TYPES }

/**
 * TalentBusterZ V3 — Canonical Artifact Store
 *
 * Frontend boundary:
 * - stores canonical artifacts received from TBZ engines
 * - validates artifact type and version before ingestion
 * - does NOT perform matching
 * - does NOT enrich candidate/job state
 * - does NOT generate probe questions
 * - does NOT reinterpret canonical engine decisions
 */

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
  validateCanonicalArtifact(artifact)

  const slot = getArtifactSlot(artifact.artifact_type)

  if (!slot) {
    throw new Error(
      `TBZ V3: unsupported artifact_type "${artifact.artifact_type}".`
    )
  }

  return {
    ...store,
    [slot]: artifact
  }
}
