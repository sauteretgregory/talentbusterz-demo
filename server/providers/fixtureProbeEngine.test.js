import assert from 'node:assert/strict'

import match from '../../src/tbz-v3/fixtures/match-france-travail-210SDTY.json' with { type: 'json' }

import {
  createFixtureProbeEngineProvider
} from './fixtureProbeEngine.js'

const provider =
  createFixtureProbeEngineProvider()

const result = await provider(match)

assert.equal(
  result.artifact_type,
  'canonical_probe_plan'
)

assert.equal(
  result.artifact_id,
  'probe_gregory_sauteret_france_travail_210SDTY_v1_0'
)

assert.equal(
  result.state_version,
  'v1.0'
)

assert.equal(
  result.validation_report.validation_status,
  'passed'
)

const critical =
  result.probe_plan.critical_questions || []

const secondary =
  result.probe_plan.secondary_questions || []

assert.equal(
  critical.length + secondary.length,
  5
)

console.log('✓ Fixture PROBE ENGINE tests passed')
console.log('Artifact:', result.artifact_id)
console.log('Questions:', critical.length + secondary.length)
console.log(
  'Validation:',
  result.validation_report.validation_status
)
