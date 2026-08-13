import assert from 'node:assert/strict'

import candidateArtifact from '../fixtures/doctrine/candidate.json' with {
  type: 'json'
}

import jobArtifact from '../fixtures/job-france-travail-210SDTY.json' with {
  type: 'json'
}

import {
  createDeterministicMatchContext,
  normalizeText
} from './deterministicMatch.js'

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
  12
)

console.log(
  '✓ MATCH handling policies exhaust canonical JOB routes:',
  declaredMatchRoutes.size
)
