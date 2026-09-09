import {
  TBZ_ARTIFACT_TYPES
} from '../artifactTypes.js'

import {
  compareEducationLevels,
  isCanonicalEducationLevel
} from './educationLevelVocabulary.js'

export const REQUIREMENT_TYPES = Object.freeze([
  'current_education_status',
  'domain_experience',
  'professional_interest',
  'professional_practice',
  'language_communication',
  'language_level',
  'workload_capacity',
  'behavioral_traits',
  'digital_environment',
  'experience_duration',
  'education_level',
  'education_field',
  'professional_qualification',
  'technology_skill',
  'methodology_skill',
  'regulatory_eligibility',
  'unclassified'
])

export const EVALUATION_MODES = Object.freeze([
  'structured_verifiable',
  'evidence_supported',
  'self_declared',
  'non_scoring',
  'unclassified'
])

export const REQUIREMENT_TYPE_EVALUATION_MODES = Object.freeze({
  current_education_status: ['structured_verifiable'],
  domain_experience: ['evidence_supported'],
  professional_interest: ['self_declared'],
  professional_practice: ['evidence_supported'],
  language_communication: ['evidence_supported'],
  language_level: ['structured_verifiable'],
  workload_capacity: ['evidence_supported'],
  behavioral_traits: ['non_scoring'],
  digital_environment: ['evidence_supported'],
  experience_duration: ['structured_verifiable'],
  education_level: ['structured_verifiable'],
  education_field: ['structured_verifiable'],
  professional_qualification: ['structured_verifiable'],
  technology_skill: ['evidence_supported'],
  methodology_skill: ['evidence_supported'],
  regulatory_eligibility: ['structured_verifiable'],
  unclassified: ['unclassified']
})

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function assertNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `TBZ: ${path} must be a non-empty string.`
    )
  }
}

function assertNonEmptyStringArray(value, path) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      item =>
        typeof item !== 'string' ||
        item.trim() === ''
    )
  ) {
    throw new Error(
      `TBZ: ${path} must be a non-empty array of non-empty strings.`
    )
  }
}

function assertCanonicalEducationLevel(value, path) {
  assertNonEmptyString(value, path)

  if (!isCanonicalEducationLevel(value)) {
    throw new Error(
      `TBZ: ${path} must be a supported canonical education level.`
    )
  }
}

function assertRequiredComponents(value, path) {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new Error(
      `TBZ: ${path} must be a non-empty array.`
    )
  }

  value.forEach((component, index) => {
    if (!isPlainObject(component)) {
      throw new Error(
        `TBZ: ${path}[${index}] must be an object.`
      )
    }

    assertNonEmptyString(
      component.component_type,
      `${path}[${index}].component_type`
    )

    assertNonEmptyString(
      component.value,
      `${path}[${index}].value`
    )
  })
}

function assertLogicWhenComposite(params, key, path) {
  if (
    Array.isArray(params[key]) &&
    params[key].length > 1 &&
    !['all', 'any'].includes(params.logic)
  ) {
    throw new Error(
      `TBZ: ${path}.logic must be "all" or "any" when ${key} contains multiple items.`
    )
  }
}

function assertAllowedKeys(params, allowedKeys, path) {
  const unknownKeys =
    Object.keys(params).filter(
      key => !allowedKeys.includes(key)
    )

  if (unknownKeys.length > 0) {
    throw new Error(
      `TBZ: ${path} contains unsupported structured parameter(s): ${unknownKeys.join(', ')}.`
    )
  }
}

function assertStructuredVerifiableParameters(
  requirement,
  path
) {
  const params = requirement.structured_parameters

  switch (requirement.requirement_type) {
    case 'current_education_status':
      assertAllowedKeys(
        params,
        ['allowed_statuses'],
        path
      )

      assertNonEmptyStringArray(
        params.allowed_statuses,
        `${path}.allowed_statuses`
      )
      break

    case 'language_level':
      assertAllowedKeys(
        params,
        ['language', 'minimum_level'],
        path
      )
      assertNonEmptyString(
        params.language,
        `${path}.language`
      )
      assertNonEmptyString(
        params.minimum_level,
        `${path}.minimum_level`
      )
      break

    case 'experience_duration':
      assertAllowedKeys(
        params,
        [
          'minimum_months',
          'experience_scope',
          'accepted_contexts'
        ],
        path
      )

      if (
        !Number.isInteger(params.minimum_months) ||
        params.minimum_months < 0
      ) {
        throw new Error(
          `TBZ: ${path}.minimum_months must be a non-negative integer.`
        )
      }

      if (
        'experience_scope' in params &&
        (
          typeof params.experience_scope !== 'string' ||
          params.experience_scope.trim() === ''
        )
      ) {
        throw new Error(
          `TBZ: ${path}.experience_scope must be a non-empty string when present.`
        )
      }

      if ('accepted_contexts' in params) {
        assertNonEmptyStringArray(
          params.accepted_contexts,
          `${path}.accepted_contexts`
        )
      }
      break

    case 'education_level':
      assertAllowedKeys(
        params,
        ['minimum_level', 'maximum_level'],
        path
      )
      assertCanonicalEducationLevel(
        params.minimum_level,
        `${path}.minimum_level`
      )

      if ('maximum_level' in params) {
        assertCanonicalEducationLevel(
          params.maximum_level,
          `${path}.maximum_level`
        )

        if (
          compareEducationLevels(
            params.minimum_level,
            params.maximum_level
          ) > 0
        ) {
          throw new Error(
            `TBZ: ${path}.minimum_level must not exceed maximum_level.`
          )
        }
      }
      break

    case 'education_field':
      assertAllowedKeys(
        params,
        ['accepted_fields', 'logic'],
        path
      )

      assertNonEmptyStringArray(
        params.accepted_fields,
        `${path}.accepted_fields`
      )

      assertLogicWhenComposite(
        params,
        'accepted_fields',
        path
      )
      break

    case 'professional_qualification':
      assertAllowedKeys(
        params,
        ['accepted_qualifications', 'logic'],
        path
      )

      assertNonEmptyStringArray(
        params.accepted_qualifications,
        `${path}.accepted_qualifications`
      )

      assertLogicWhenComposite(
        params,
        'accepted_qualifications',
        path
      )
      break

    case 'regulatory_eligibility':
      assertAllowedKeys(
        params,
        ['eligibility_type', 'accepted_values'],
        path
      )

      assertNonEmptyString(
        params.eligibility_type,
        `${path}.eligibility_type`
      )

      assertNonEmptyStringArray(
        params.accepted_values,
        `${path}.accepted_values`
      )
      break

    default:
      throw new Error(
        `TBZ: ${path} has no structured_verifiable contract for requirement_type "${requirement.requirement_type}".`
      )
  }
}

function assertEvidenceSupportedParameters(
  requirement,
  path
) {
  const params = requirement.structured_parameters

  if (requirement.requirement_type === 'domain_experience') {
    assertRequiredComponents(
      params.required_components,
      `${path}.required_components`
    )

    assertLogicWhenComposite(
      params,
      'required_components',
      path
    )

    return
  }

  assertAllowedKeys(
    params,
    ['target_concepts', 'logic'],
    path
  )

  assertNonEmptyStringArray(
    params.target_concepts,
    `${path}.target_concepts`
  )

  assertLogicWhenComposite(
    params,
    'target_concepts',
    path
  )
}

function assertRequirement(requirement, index) {
  const path = `requirements_explicit[${index}]`

  if (!isPlainObject(requirement)) {
    throw new Error(
      `TBZ: ${path} must be an object.`
    )
  }

  assertNonEmptyString(
    requirement.requirement_id,
    `${path}.requirement_id`
  )

  assertNonEmptyString(
    requirement.requirement,
    `${path}.requirement`
  )

  if (
    !REQUIREMENT_TYPES.includes(
      requirement.requirement_type
    )
  ) {
    throw new Error(
      `TBZ: ${path}.requirement_type is unsupported.`
    )
  }

  if (
    !EVALUATION_MODES.includes(
      requirement.evaluation_mode
    )
  ) {
    throw new Error(
      `TBZ: ${path}.evaluation_mode is unsupported.`
    )
  }

  const allowedModes =
    REQUIREMENT_TYPE_EVALUATION_MODES[
      requirement.requirement_type
    ]

  if (
    !allowedModes.includes(
      requirement.evaluation_mode
    )
  ) {
    throw new Error(
      `TBZ: ${path} has incompatible requirement_type/evaluation_mode.`
    )
  }

  if (!isPlainObject(requirement.structured_parameters)) {
    throw new Error(
      `TBZ: ${path}.structured_parameters must be an object.`
    )
  }

  if (
    requirement.evaluation_mode ===
    'structured_verifiable'
  ) {
    assertStructuredVerifiableParameters(
      requirement,
      `${path}.structured_parameters`
    )
  }

  if (
    requirement.evaluation_mode ===
    'evidence_supported'
  ) {
    assertEvidenceSupportedParameters(
      requirement,
      `${path}.structured_parameters`
    )
  }
}

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

  const requirements =
    artifact?.job_data_state?.requirements_explicit

  if (
    !Array.isArray(requirements) ||
    requirements.length === 0
  ) {
    throw new Error(
      'TBZ: JOB job_data_state.requirements_explicit must be a non-empty array.'
    )
  }

  requirements.forEach(
    assertRequirement
  )

  return artifact
}
