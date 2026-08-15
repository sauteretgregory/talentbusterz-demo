import test from 'node:test'
import assert from 'node:assert/strict'

import candidate from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }
import match from '../../src/tbz-v3/fixtures/match-france-travail-210SDTY.json' with { type: 'json' }
import probe from '../../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with { type: 'json' }

import { createTbzEngineRegistry } from '../engineRegistry.js'
import { processProbeResponses } from '../probeResponseLoop.js'

test('adaptive PROBE cycle continues when material candidate-answerable gaps remain', async () => {
  const result = await processProbeResponses({
    engineRegistry: createTbzEngineRegistry({ engineMode: 'deterministic' }),
    candidateDataState: candidate,
    jobDataState: job,
    probePlan: probe,
    previousMatchState: match,
    responses: [{
      question_id: 'MPC_FT_002',
      answer: 'Je me situe à un niveau B2 en anglais professionnel, utilisé régulièrement avec des candidats et clients internationaux.'
    }]
  })

  assert.equal(result.probe_cycle_status, 'open')
  assert.equal(result.probe_adaptive_decision, 'continue_probe')
  assert.equal(result.probe_response_quality.status, 'usable')
  assert.equal(result.canonical_probe_plan.probe_result.adaptive_decision, 'continue_probe')
  assert.equal(result.canonical_probe_plan.loop_closure.remaining_question_ids.length, 4)
})

test('adaptive PROBE cycle requires clarification for insufficient answers and does not launch another PROBE cycle', async () => {
  const result = await processProbeResponses({
    engineRegistry: createTbzEngineRegistry({ engineMode: 'deterministic' }),
    candidateDataState: candidate,
    jobDataState: job,
    probePlan: probe,
    previousMatchState: match,
    responses: [{
      question_id: 'MPC_FT_002',
      answer: 'Je ne sais pas'
    }]
  })

  assert.equal(result.probe_cycle_status, 'needs_clarification')
  assert.equal(result.probe_adaptive_decision, 'clarification_required')
  assert.equal(result.probe_response_quality.status, 'insufficient')
  assert.deepEqual(result.probe_response_quality.insufficient_question_ids, ['MPC_FT_002'])
  assert.equal(result.canonical_probe_plan.probe_result.adaptive_decision, 'clarification_required')
  assert.equal(result.canonical_probe_plan.probe_result.insufficient_question_count, 1)
})

test('adaptive PROBE cycle requires clarification for contradictory answers', async () => {
  const result = await processProbeResponses({
    engineRegistry: createTbzEngineRegistry({ engineMode: 'deterministic' }),
    candidateDataState: candidate,
    jobDataState: job,
    probePlan: probe,
    previousMatchState: match,
    responses: [{
      question_id: 'MPC_FT_001',
      answer: 'Oui, mais non, je n’ai finalement jamais recruté en contexte ESN.'
    }]
  })

  assert.equal(result.probe_cycle_status, 'needs_clarification')
  assert.equal(result.probe_adaptive_decision, 'clarification_required')
  assert.equal(result.probe_response_quality.status, 'contradictory')
  assert.deepEqual(result.probe_response_quality.contradictory_question_ids, ['MPC_FT_001'])
  assert.equal(result.canonical_probe_plan.probe_result.contradictory_question_count, 1)
})
