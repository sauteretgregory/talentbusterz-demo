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
  },
  job_data_state: {
    requirements_explicit: [
      {
        requirement_id: 'req_mock_001',
        requirement: '2 ans d’expérience',
        requirement_type: 'experience_duration',
        evaluation_mode: 'structured_verifiable',
        structured_parameters: {
          minimum_months: 24
        }
      }
    ]
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


function cloneValidArtifact() {
  return structuredClone(validArtifact)
}

{
  const artifact = cloneValidArtifact()

  artifact.job_data_state.requirements_explicit[0].requirement_type =
    'unsupported_type'

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /requirement_type is unsupported/
  )
}

{
  const artifact = cloneValidArtifact()

  artifact.job_data_state.requirements_explicit[0].evaluation_mode =
    'unsupported_mode'

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /evaluation_mode is unsupported/
  )
}

{
  const artifact = cloneValidArtifact()

  artifact.job_data_state.requirements_explicit[0].evaluation_mode =
    'evidence_supported'

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /incompatible requirement_type\/evaluation_mode/
  )
}

{
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type =
    'professional_practice'
  requirement.evaluation_mode =
    'evidence_supported'
  requirement.structured_parameters = {
    target_concepts: [
      'sourcing',
      'prospecting'
    ]
  }

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /logic must be "all" or "any"/
  )
}

{
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.structured_parameters = {
    minimum_months: 24,
    minimum_month: 24
  }

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /unsupported structured parameter/
  )
}

{
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type =
    'domain_experience'
  requirement.evaluation_mode =
    'evidence_supported'
  requirement.structured_parameters = {
    required_components: [
      {
        component_type: 'professional_domain',
        value: ''
      }
    ]
  }

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /component.*value.*non-empty string/
  )
}

{
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type =
    'workload_capacity'
  requirement.evaluation_mode =
    'evidence_supported'
  requirement.structured_parameters = {
    target_concepts: [
      'high_volume',
      ''
    ],
    logic: 'all'
  }

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /target_concepts.*non-empty array of non-empty strings/
  )
}

console.log('✓ JOB DATA contract rejection tests passed')

console.log('✓ JOB DATA contract tests passed')
console.log('Valid artifact returned unchanged')
