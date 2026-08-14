import assert from 'node:assert/strict'

import {
  assertCanonicalJobDataState
} from './jobDataContract.js'

import {
  TBZ_ARTIFACT_TYPES
} from '../artifactTypes.js'

import {
  EDUCATION_LEVELS
} from './educationLevelVocabulary.js'

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

function configureEducationLevelRequirement(
  artifact,
  structuredParameters
) {
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type = 'education_level'
  requirement.evaluation_mode = 'structured_verifiable'
  requirement.structured_parameters = structuredParameters
}

for (const level of EDUCATION_LEVELS) {
  const artifact = cloneValidArtifact()

  configureEducationLevelRequirement(artifact, {
    minimum_level: level
  })

  assert.equal(
    assertCanonicalJobDataState(artifact),
    artifact
  )
}

{
  const artifact = cloneValidArtifact()

  configureEducationLevelRequirement(artifact, {
    minimum_level: 'master'
  })

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /minimum_level must be a supported canonical education level/
  )
}

{
  const artifact = cloneValidArtifact()

  configureEducationLevelRequirement(artifact, {
    minimum_level: 'bac',
    maximum_level: 'master'
  })

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /maximum_level must be a supported canonical education level/
  )
}

{
  const artifact = cloneValidArtifact()

  configureEducationLevelRequirement(artifact, {
    minimum_level: 'bac_plus_5',
    maximum_level: 'bac_plus_2'
  })

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /minimum_level must not exceed maximum_level/
  )
}

for (const structuredParameters of [
  {
    minimum_level: 'bac_plus_5',
    maximum_level: 'bac_plus_5'
  },
  {
    minimum_level: 'bac_plus_2',
    maximum_level: 'bac_plus_5'
  }
]) {
  const artifact = cloneValidArtifact()

  configureEducationLevelRequirement(
    artifact,
    structuredParameters
  )

  assert.equal(
    assertCanonicalJobDataState(artifact),
    artifact
  )
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


// ------------------------------------------------------------
// Generic requirement vocabulary expansion
// ------------------------------------------------------------

const newValidRequirements = [
  {
    requirement_type: 'education_field',
    evaluation_mode: 'structured_verifiable',
    structured_parameters: {
      accepted_fields: ['biostatistics']
    }
  },
  {
    requirement_type: 'professional_qualification',
    evaluation_mode: 'structured_verifiable',
    structured_parameters: {
      accepted_qualifications: [
        'state_registered_nurse'
      ]
    }
  },
  {
    requirement_type: 'technology_skill',
    evaluation_mode: 'evidence_supported',
    structured_parameters: {
      target_concepts: ['python']
    }
  },
  {
    requirement_type: 'methodology_skill',
    evaluation_mode: 'evidence_supported',
    structured_parameters: {
      target_concepts: ['mbse']
    }
  },
  {
    requirement_type: 'regulatory_eligibility',
    evaluation_mode: 'structured_verifiable',
    structured_parameters: {
      eligibility_type: 'work_authorization',
      accepted_values: ['france']
    }
  }
]

for (const newRequirement of newValidRequirements) {
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type =
    newRequirement.requirement_type
  requirement.evaluation_mode =
    newRequirement.evaluation_mode
  requirement.structured_parameters =
    newRequirement.structured_parameters

  assert.equal(
    assertCanonicalJobDataState(artifact),
    artifact
  )
}

{
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type =
    'technology_skill'
  requirement.evaluation_mode =
    'structured_verifiable'
  requirement.structured_parameters = {
    target_concepts: ['python']
  }

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
    'education_field'
  requirement.evaluation_mode =
    'structured_verifiable'
  requirement.structured_parameters = {
    accepted_fields: []
  }

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /accepted_fields.*non-empty array/
  )
}

{
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type =
    'professional_qualification'
  requirement.evaluation_mode =
    'structured_verifiable'
  requirement.structured_parameters = {
    accepted_qualifications: [
      'qualification_a',
      'qualification_b'
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

  requirement.requirement_type =
    'technology_skill'
  requirement.evaluation_mode =
    'evidence_supported'
  requirement.structured_parameters = {
    target_concepts: [
      'python',
      'sql'
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

  requirement.requirement_type =
    'methodology_skill'
  requirement.evaluation_mode =
    'evidence_supported'
  requirement.structured_parameters = {
    target_concepts: ['mbse'],
    unsupported_key: true
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
    'regulatory_eligibility'
  requirement.evaluation_mode =
    'structured_verifiable'
  requirement.structured_parameters = {
    eligibility_type: '',
    accepted_values: ['france']
  }

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /eligibility_type.*non-empty string/
  )
}

{
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type =
    'regulatory_eligibility'
  requirement.evaluation_mode =
    'structured_verifiable'
  requirement.structured_parameters = {
    eligibility_type: 'security_clearance',
    accepted_values: []
  }

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /accepted_values.*non-empty array/
  )
}

{
  const artifact = cloneValidArtifact()
  const requirement =
    artifact.job_data_state.requirements_explicit[0]

  requirement.requirement_type =
    'education_field'
  requirement.evaluation_mode =
    'structured_verifiable'
  requirement.structured_parameters = {
    accepted_fields: ['electronics'],
    unexpected: 'value'
  }

  assert.throws(
    () => assertCanonicalJobDataState(artifact),
    /unsupported structured parameter/
  )
}

console.log(
  '✓ Generic JOB requirement vocabulary tests passed'
)

console.log('✓ JOB DATA contract rejection tests passed')

console.log('✓ JOB DATA contract tests passed')
console.log('Valid artifact returned unchanged')
