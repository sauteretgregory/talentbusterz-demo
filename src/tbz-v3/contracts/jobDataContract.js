import {
  TBZ_ARTIFACT_TYPES
} from '../artifactTypes.js'

export function assertCanonicalJobDataState(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error(
      'TBZ: invalid canonical JOB artifact.'
    )
  }

  if (artifact.artifact_type !== TBZ_ARTIFACT_TYPES.JOB) {
    throw new Error(
      'TBZ: output is not canonical_job_data_state.'
    )
  }

  if (!artifact.artifact_id) {
    throw new Error(
      'TBZ: JOB artifact_id is missing.'
    )
  }

  if (!artifact.state_version) {
    throw new Error(
      'TBZ: JOB state_version is missing.'
    )
  }

  if (
    artifact?.validation_report?.validation_status !== 'passed'
  ) {
    throw new Error(
      'TBZ: JOB canonical validation did not pass.'
    )
  }

  return artifact
}
