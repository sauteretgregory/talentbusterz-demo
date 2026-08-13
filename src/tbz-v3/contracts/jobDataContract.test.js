import assert from 'node:assert/strict'

import {
  assertCanonicalJobDataState
} from './jobDataContract.js'

import {
  TBZ_ARTIFACT_TYPES
} from '../artifactTypes.js'

const validArtifact = {
  artifact_type: TBZ_ARTIFACT_TYPES.JOB,
  artifact_id: 'job_mock_001',
  state_version: 'v1.0',
  validation_report: {
    validation_status: 'passed'
  }
}

assert.throws(
  () => assertCanonicalJobDataState(null),
  /invalid canonical JOB artifact/
)

assert.throws(
  () =>
    assertCanonicalJobDataState({
      ...validArtifact,
      artifact_type: 'wrong_type'
    }),
  /canonical_job_data_state/
)

assert.throws(
  () => {
    const artifact = {
      ...validArtifact
    }

    delete artifact.artifact_id

    assertCanonicalJobDataState(artifact)
  },
  /artifact_id/
)

assert.throws(
  () => {
    const artifact = {
      ...validArtifact
    }

    delete artifact.state_version

    assertCanonicalJobDataState(artifact)
  },
  /state_version/
)

assert.throws(
  () =>
    assertCanonicalJobDataState({
      ...validArtifact,
      validation_report: {
        validation_status: 'failed'
      }
    }),
  /validation did not pass/
)

const result =
  assertCanonicalJobDataState(validArtifact)

assert.equal(
  result,
  validArtifact
)

console.log('✓ JOB DATA contract tests passed')
console.log('Valid artifact returned unchanged')
