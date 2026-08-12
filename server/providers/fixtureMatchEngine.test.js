import assert from 'node:assert/strict'

import candidate from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }

import {
  createFixtureMatchEngineProvider
} from './fixtureMatchEngine.js'

const provider =
  createFixtureMatchEngineProvider()

const result = await provider({
  candidate_data_state: candidate,
  job_data_state: job
})

assert.equal(
  result.artifact_type,
  'canonical_match_state'
)

assert.equal(
  result.artifact_id,
  'match_gregory_sauteret_france_travail_210SDTY'
)

assert.equal(
  result.state_version,
  'v1.0'
)

assert.equal(
  result.validation_report.validation_status,
  'passed'
)

assert.equal(
  result.match_state.professional_compatibility
    .professional_match_score,
  74
)

console.log('✓ Fixture MATCH ENGINE tests passed')
console.log('Artifact:', result.artifact_id)
console.log(
  'Score:',
  result.match_state.professional_compatibility
    .professional_match_score
)
console.log(
  'Validation:',
  result.validation_report.validation_status
)
