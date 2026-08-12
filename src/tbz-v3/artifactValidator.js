import { TBZ_ARTIFACT_TYPES } from './artifactStore.js'

const SUPPORTED_TYPES = new Set(Object.values(TBZ_ARTIFACT_TYPES))

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message)
  }
}

export function validateCanonicalArtifact(artifact) {
  assertObject(
    artifact,
    'TBZ V3: canonical artifact must be a JSON object.'
  )

  const { artifact_type, state_version } = artifact

  if (!artifact_type || typeof artifact_type !== 'string') {
    throw new Error('TBZ V3: artifact_type is missing or invalid.')
  }

  if (!SUPPORTED_TYPES.has(artifact_type)) {
    throw new Error(
      `TBZ V3: unsupported artifact_type "${artifact_type}".`
    )
  }

  if (!state_version || typeof state_version !== 'string') {
    throw new Error('TBZ V3: state_version is missing or invalid.')
  }

  return {
    valid: true,
    artifact_type,
    state_version
  }
}
