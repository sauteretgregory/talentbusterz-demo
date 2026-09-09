import assert from 'node:assert/strict'

import candidateArtifact from '../fixtures/doctrine/candidate.json' with {
  type: 'json'
}

import jobArtifact from '../fixtures/job-france-travail-210SDTY.json' with {
  type: 'json'
}

import {
  createDeterministicMatchContext,
  EDUCATION_LEVEL_ORDER,
  normalizeText
} from './deterministicMatch.js'

import {
  EDUCATION_LEVEL_ORDER as CANONICAL_EDUCATION_LEVEL_ORDER,
  EDUCATION_LEVELS
} from '../contracts/educationLevelVocabulary.js'

assert.strictEqual(
  EDUCATION_LEVEL_ORDER,
  CANONICAL_EDUCATION_LEVEL_ORDER
)

assert.deepEqual(EDUCATION_LEVELS, [
  'below_bac',
  'bac',
  'bac_plus_1',
  'bac_plus_2',
  'bac_plus_3',
  'bac_plus_4',
  'bac_plus_5',
  'bac_plus_8'
])

assert.equal(
  normalizeText('Préqualification & Entretiens'),
  'prequalification entretiens'
)

const context = createDeterministicMatchContext({
  candidateState: candidateArtifact.candidate_data_state,
  jobState: jobArtifact.job_data_state
})

assert.equal(
  context.requirements.length,
  13
)

assert.ok(
  context.candidateEvidence.length > 20
)

const critical = context.requirements.filter(
  (requirement) =>
    requirement.importance === 'critical'
)

assert.equal(critical.length, 2)

assert.ok(
  context.candidateEvidence.some(
    (evidence) =>
      evidence.text.includes('recherche booleenne')
  )
)

console.log('✓ Deterministic MATCH context tests passed')
console.log(
  'Requirements:',
  context.requirements.length
)
console.log(
  'Candidate evidence:',
  context.candidateEvidence.length
)
console.log(
  'Critical requirements:',
  critical.length
)

import {
  evaluateDeterministicMatch
} from './deterministicMatch.js'

const candidateStateBeforeEvaluation = structuredClone(
  candidateArtifact.candidate_data_state
)

const evaluation = evaluateDeterministicMatch({
  candidateState: candidateArtifact.candidate_data_state,
  jobState: jobArtifact.job_data_state
})

assert.equal(evaluation.requirements.length, 13)

assert.equal(
  Object.values(evaluation.summary)
    .reduce((sum, value) => sum + value, 0),
  13
)

console.log('\nRequirement evaluation:')
console.table(
  evaluation.requirements.map((item) => ({
    id: item.requirement_id,
    importance: item.importance,
    status: item.status,
    confidence: item.confidence,
    evidence: item.evidence?.text || '—'
  }))
)

console.log('Summary:', evaluation.summary)

import {
  getRequirementRouteKey
} from './deterministicMatch.js'

const expectedRoutes = new Set([
  'structured_verifiable:current_education_status',
  'evidence_supported:domain_experience',
  'self_declared:professional_interest',
  'evidence_supported:professional_practice',
  'evidence_supported:language_communication',
  'structured_verifiable:language_level',
  'evidence_supported:workload_capacity',
  'non_scoring:behavioral_traits',
  'evidence_supported:digital_environment',
  'structured_verifiable:experience_duration',
  'structured_verifiable:education_level'
])

const actualRoutes = new Set(
  context.requirements.map(getRequirementRouteKey)
)

assert.deepEqual(actualRoutes, expectedRoutes)

console.log(
  '✓ Requirement routing matrix covered:',
  actualRoutes.size,
  'routes'
)

const experienceDurationResult =
  evaluation.requirements.find(
    (result) =>
      result.requirement_id ===
      'req_experience_2_years_001'
  )

assert.ok(
  experienceDurationResult,
  'experience_duration result must exist'
)

assert.equal(
  experienceDurationResult.status,
  'match'
)

assert.equal(
  experienceDurationResult.confidence,
  0.95
)

console.log(
  '✓ experience_duration canonical evaluator passed'
)

const educationLevelResult =
  evaluation.requirements.find(
    (result) =>
      result.requirement_id === 'req_bac5_001'
  )

assert.ok(
  educationLevelResult,
  'education_level result must exist'
)

assert.equal(
  educationLevelResult.status,
  'unknown'
)

assert.equal(
  educationLevelResult.confidence, 0)

assert.deepEqual(
  educationLevelResult.evidence.confirmed_completed_levels,
  []
)

assert.deepEqual(
  candidateArtifact.candidate_data_state,
  candidateStateBeforeEvaluation
)

assert.equal(
  MATCH_ROUTE_POLICIES[
    'structured_verifiable:education_level'
  ], 'evaluator')

const educationJobState = {
  requirements_explicit: [
    jobArtifact.job_data_state.requirements_explicit.find(
      (requirement) =>
        requirement.requirement_id === 'req_bac5_001'
    )
  ]
}

const confirmedBac5Result = evaluateDeterministicMatch({
  candidateState: {
    education_state: [
      {
        education_id: 'edu_master_confirmed',
        completed_level: {
          value: 'bac_plus_5',
          evidence_status: 'confirmed'
        },
        completion_status: {
          value: 'completed',
          evidence_status: 'confirmed'
        }
      },
      {
        education_id: 'edu_btsa_interrupted',
        completed_level: {
          value: 'bac_plus_2',
          evidence_status: 'confirmed'
        },
        completion_status: {
          value: 'not_completed',
          evidence_status: 'confirmed'
        }
      }
    ]
  },
  jobState: educationJobState
}).requirements[0]

assert.equal(confirmedBac5Result.status, 'match')
assert.equal(confirmedBac5Result.confidence, 0.95)
assert.deepEqual(
  confirmedBac5Result.evidence.confirmed_completed_levels,
  [
    {
      source: 'edu_master_confirmed',
      level: 'bac_plus_5'
    }
  ]
)

const confirmedBac2Result = evaluateDeterministicMatch({
  candidateState: {
    education_state: [
      {
        education_id: 'edu_bts_confirmed',
        completed_level: {
          value: 'bac_plus_2',
          evidence_status: 'confirmed'
        },
        completion_status: {
          value: 'completed',
          evidence_status: 'confirmed'
        }
      }
    ]
  },
  jobState: educationJobState
}).requirements[0]

assert.equal(confirmedBac2Result.status, 'mismatch')
assert.equal(confirmedBac2Result.confidence, 0.95)

const highestCompletedLevelResult =
  evaluateDeterministicMatch({
    candidateState: {
      highest_completed_education_level: {
        value: 'bac_plus_5',
        evidence_status: 'confirmed'
      },
      education_state: []
    },
    jobState: educationJobState
  }).requirements[0]

assert.equal(highestCompletedLevelResult.status, 'match')
assert.deepEqual(
  highestCompletedLevelResult.evidence
    .confirmed_completed_levels,
  [
    {
      source: 'highest_completed_education_level',
      level: 'bac_plus_5'
    }
  ]
)

const invalidEducationJobState = structuredClone(
  educationJobState
)

invalidEducationJobState.requirements_explicit[0]
  .structured_parameters.minimum_level = 'master'

assert.throws(
  () =>
    evaluateDeterministicMatch({
      candidateState: {
        education_state: []
      },
      jobState: invalidEducationJobState
    }),
  /education_level requires valid canonical minimum_level/
)

console.log(
  '✓ education_level canonical evaluator passed'
)

const domainExperienceResult =
  evaluation.requirements.find(
    (result) =>
      result.requirement_id ===
      'req_experience_it_esn_001'
  )

assert.ok(
  domainExperienceResult,
  'domain_experience result must exist'
)

assert.equal(
  domainExperienceResult.status,
  'partial_match'
)

assert.equal(
  domainExperienceResult.confidence,
  0.8
)

assert.equal(
  domainExperienceResult.evidence.logic,
  'all'
)

assert.deepEqual(
  domainExperienceResult.evidence.components.map(
    (component) => ({
      component_type: component.component_type,
      value: component.value,
      evidenced: component.evidenced
    })
  ),
  [
    {
      component_type: 'professional_domain',
      value: 'recruitment_it',
      evidenced: true
    },
    {
      component_type: 'employment_context',
      value: 'esn',
      evidenced: false
    }
  ]
)

console.log(
  '✓ domain_experience canonical evaluator passed'
)

const nonScoringResults =
  evaluation.requirements.filter(
    (result) =>
      result.evaluation_mode === 'non_scoring'
  )

assert.equal(
  nonScoringResults.length,
  3
)

for (const result of nonScoringResults) {
  assert.equal(result.status, 'not_scored')
  assert.equal(result.confidence, 0)
  assert.equal(result.weight, 0)
  assert.equal(result.factor, 0)
  assert.equal(result.evidence, null)
}

assert.equal(
  evaluation.summary.not_scored,
  3
)

console.log(
  '✓ non_scoring requirements excluded from scoring'
)

const selfDeclaredResults =
  evaluation.requirements.filter(
    (result) =>
      result.evaluation_mode === 'self_declared'
  )

assert.equal(
  selfDeclaredResults.length,
  1
)

for (const result of selfDeclaredResults) {
  assert.equal(result.status, 'unknown')
  assert.equal(result.confidence, 0)
  assert.equal(result.evidence, null)
}

console.log(
  '✓ self_declared requirements excluded from inference'
)

const professionalPracticeResult =
  evaluation.requirements.find(
    (result) =>
      result.requirement_type ===
      'professional_practice'
  )

assert.ok(
  professionalPracticeResult,
  'professional_practice result must exist'
)

assert.equal(
  professionalPracticeResult.status,
  'match'
)

assert.equal(
  professionalPracticeResult.confidence,
  0.95
)

assert.deepEqual(
  professionalPracticeResult.evidence.concepts.map(
    (item) => item.evidenced
  ),
  [true, true, true]
)

assert.ok(
  professionalPracticeResult.evidence.concepts.some(
    (item) =>
      item.concept === 'cold_calling' &&
      item.evidence?.text === 'prospection téléphonique'
  )
)

console.log(
  '✓ professional_practice canonical evaluator passed'
)

const languageCommunicationResult =
  evaluation.requirements.find(
    (result) =>
      result.requirement_type ===
      'language_communication'
  )

assert.ok(
  languageCommunicationResult,
  'language_communication result must exist'
)

assert.equal(
  languageCommunicationResult.status,
  'unknown'
)

assert.equal(
  languageCommunicationResult.confidence,
  0
)

assert.equal(
  languageCommunicationResult.evidence.language,
  'français'
)

assert.equal(
  languageCommunicationResult.evidence.proficiency_confirmed,
  false
)

console.log(
  '✓ language_communication canonical evaluator passed'
)

import {
  REQUIREMENT_TYPE_EVALUATION_MODES
} from '../contracts/jobDataContract.js'

import {
  MATCH_ROUTE_POLICIES
} from './deterministicMatch.js'

const canonicalContractRoutes = new Set(
  Object.entries(
    REQUIREMENT_TYPE_EVALUATION_MODES
  ).flatMap(
    ([requirementType, modes]) =>
      modes.map(
        (mode) =>
          `${mode}:${requirementType}`
      )
  )
)

const declaredMatchRoutes =
  new Set(
    Object.keys(MATCH_ROUTE_POLICIES)
  )

assert.deepEqual(
  declaredMatchRoutes,
  canonicalContractRoutes
)

assert.equal(
  Object.keys(MATCH_ROUTE_POLICIES).length,
  17
)

console.log(
  '✓ MATCH handling policies exhaust canonical JOB routes:',
  declaredMatchRoutes.size
)

const digitalEnvironmentResult =
  evaluation.requirements.find(
    (result) =>
      result.requirement_type ===
      'digital_environment'
  )

assert.ok(
  digitalEnvironmentResult,
  'digital_environment result must exist'
)

assert.equal(
  digitalEnvironmentResult.status,
  'partial_match'
)

assert.equal(
  digitalEnvironmentResult.confidence,
  0.8
)

assert.equal(
  digitalEnvironmentResult.evidence.concept,
  'digital_environment'
)

assert.ok(
  digitalEnvironmentResult.evidence.evidence.length > 0
)

console.log(
  '✓ digital_environment canonical evaluator passed'
)
