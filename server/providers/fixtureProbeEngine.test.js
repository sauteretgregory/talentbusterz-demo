import assert from 'node:assert/strict'

import candidate from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with {
  type: 'json'
}

import job from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with {
  type: 'json'
}

import {
  createDeterministicMatchEngineProvider
} from './deterministicMatchEngine.js'

import {
  createFixtureProbeEngineProvider
} from './fixtureProbeEngine.js'

const matchEngine =
  createDeterministicMatchEngineProvider()

const probeEngine =
  createFixtureProbeEngineProvider()

const match =
  await matchEngine({
    candidate_data_state: candidate,
    job_data_state: job
  })

assert.equal(
  match.artifact_type,
  'canonical_match_state'
)

assert.equal(
  match.artifact_id,
  'match_gregory_sauteret_france_travail_210SDTY'
)

assert.equal(
  match.engine_version,
  'V1'
)

assert.equal(
  match.match_id,
  'match_gregory_sauteret_france_travail_210SDTY_v1'
)

const result =
  await probeEngine(match)

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
  result.engine_name,
  'TBZ_PROBE_ENGINE'
)

assert.equal(
  result.engine_version,
  'V1'
)

assert.equal(
  result.source_match_artifact.artifact_id,
  match.artifact_id
)

assert.equal(
  result.source_match_artifact.engine_version,
  match.engine_version
)

assert.equal(
  result.source_match_artifact.match_id,
  match.match_id
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

console.log(
  '✓ Fixture PROBE ENGINE linkage contract passed'
)

console.log(
  'MATCH:',
  match.artifact_id
)

console.log(
  'MATCH version:',
  match.engine_version
)

console.log(
  'PROBE:',
  result.artifact_id
)

console.log(
  'Questions:',
  critical.length + secondary.length
)

console.log(
  'Validation:',
  result.validation_report.validation_status
)
