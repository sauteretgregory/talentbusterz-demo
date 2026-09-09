import assert from 'node:assert/strict'

import candidate from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with {
  type: 'json'
}

import job from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with {
  type: 'json'
}

import probe from '../../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with {
  type: 'json'
}

import {
  createDeterministicMatchEngineProvider
} from './deterministicMatchEngine.js'

const matchEngine =
  createDeterministicMatchEngineProvider()

const match =
  await matchEngine({
    candidate_data_state: candidate,
    job_data_state: job
  })

assert.equal(
  match.artifact_type,
  'canonical_match_state'
)

const requirements =
  match.match_state.requirements

const questions = [
  ...(probe.probe_plan?.critical_questions ?? []),
  ...(probe.probe_plan?.secondary_questions ?? [])
]

const requirementByConcept = new Map([
  [
    'it_recruitment_in_esn_context',
    'req_experience_it_esn_001'
  ],
  [
    'highest_completed_education_level',
    'req_bac5_001'
  ],
  [
    'current_student_status',
    'req_education_current_student_001'
  ],
  [
    'english_professional_level',
    'req_english_b2_001'
  ],
  [
    'sourcing_prospecting_cold_calling',
    'req_sourcing_prospecting_cold_calling_001'
  ],
  [
    'workload_capacity',
    'req_volume_pace_001'
  ]
])

console.log('===== MATCH → PROBE SEMANTIC VALIDATION =====')

for (const question of questions) {
  const linkedGap =
    question.linked_gap ?? question.linked_gap_id

  const requirementId =
    requirementByConcept.get(linkedGap)

  assert.ok(
    requirementId,
    `Unknown PROBE linked_gap: ${linkedGap}`
  )

  const requirement =
    requirements.find(
      r => r.requirement_id === requirementId
    )

  assert.ok(
    requirement,
    `No MATCH requirement mapped to PROBE gap: ${linkedGap}`
  )

  console.log(
    JSON.stringify({
      question_id:
        question.question_id ?? question.id,
      linked_gap: linkedGap,
      requirement_id: requirement.requirement_id,
      match_status: requirement.status,
      match_factor: requirement.factor
    })
  )

  assert.notEqual(
    requirement.status,
    'match',
    `PROBE question "${linkedGap}" targets a MATCH requirement already resolved as "match".`
  )

  assert.notEqual(
    requirement.status,
    'not_scored',
    `PROBE question "${linkedGap}" targets a non-scoring requirement.`
  )
}

console.log('')
console.log(
  `✓ MATCH → PROBE semantic validation passed (${questions.length} questions)`
)
