import test from 'node:test'
import assert from 'node:assert/strict'

import candidate from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }
import match from '../../src/tbz-v3/fixtures/match-france-travail-210SDTY.json' with { type: 'json' }
import probe from '../../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with { type: 'json' }
import { createTbzEngineRegistry } from '../engineRegistry.js'
import { processProbeResponses } from '../probeResponseLoop.js'

test('five answered questions are reingested, MATCH is rerun, then continuation is offered', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })
  const result = await processProbeResponses({ engineRegistry: registry, candidateDataState: candidate, jobDataState: job, probePlan: probe, previousMatchState: match, responses: [
    { question_id: 'MPC_FT_001', answer: 'Oui, j’ai recruté des profils IT dans un contexte ESN et société de services chez Anywr.' },
    { question_id: 'probe_ft_candidate_education_001', answer: 'Mon plus haut niveau validé est Bac+5, avec un diplôme de niveau master.' },
    { question_id: 'probe_ft_candidate_student_status_001', answer: 'Non, je ne suis actuellement pas étudiant et je ne suis pas en formation active.' },
    { question_id: 'MPC_FT_002', answer: 'J’ai obtenu 20/20 à un oral d’anglais pendant mon BTS. J’ai vécu et travaillé environ deux ans en Australie, où j’ai vendu des abonnements satellite en anglais. J’ai aussi recruté en anglais avec des candidats et parties prenantes au Vietnam, au Canada, en Inde et au Pakistan.' },
    { question_id: 'MPC_FT_003', answer: 'Je gérais environ 10 entretiens par semaine et 5 recrutements par mois, avec des pics de charge réguliers.' }
  ] })

  assert.equal(result.canonical_candidate_data_state.state_version, 'v1.4_probe_response_integration')
  assert.equal(result.canonical_candidate_data_state.artifact_filename, 'candidate_gregory_sauteret_v1.4.json')
  const state = result.canonical_candidate_data_state.candidate_data_state
  assert.equal(state.highest_completed_education_level.value, 'bac_plus_5')
  assert.equal(state.current_student_status.active, false)
  assert.deepEqual(state.probe_response_state.applied_question_ids, ['MPC_FT_001', 'probe_ft_candidate_education_001', 'probe_ft_candidate_student_status_001', 'MPC_FT_002', 'MPC_FT_003'])
  assert.equal(result.previous_score, 74)
  assert.equal(typeof result.current_score, 'number')
  assert.equal(result.score_delta, result.current_score - result.previous_score)
  assert.equal(result.probe_cycle_status, 'awaiting_continuation')
  assert.equal(result.probe_adaptive_decision, 'continue_enrichment')
  assert.equal(result.canonical_probe_plan.probe_result.loop_status, 'awaiting_continuation')
  assert.equal(result.canonical_probe_plan.probe_result.remaining_question_count, 0)
})

test('an individual answer reruns MATCH without closing the five-question cycle', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })
  const result = await processProbeResponses({ engineRegistry: registry, candidateDataState: candidate, jobDataState: job, probePlan: probe, previousMatchState: match, responses: [{ question_id: 'MPC_FT_002', answer: 'Je me situe à un niveau B2 en anglais professionnel, utilisé régulièrement avec des candidats et clients internationaux.' }] })
  const state = result.canonical_candidate_data_state.candidate_data_state
  assert.deepEqual(state.probe_response_state.applied_question_ids, ['MPC_FT_002'])
  assert.equal(result.previous_score, 74)
  assert.equal(typeof result.current_score, 'number')
  assert.equal(result.score_delta, result.current_score - result.previous_score)
  assert.equal(result.probe_cycle_status, 'open')
  assert.equal(result.canonical_probe_plan.probe_plan.secondary_questions.some((question) => question.question_id === 'MPC_FT_002'), false)
  assert.equal(result.canonical_probe_plan.probe_plan.critical_questions.length, 3)
  assert.equal(result.canonical_probe_plan.probe_plan.secondary_questions.length, 1)
})

test('an already completed probe cycle is rejected before engines are rerun', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })
  const completedProbe = structuredClone(probe)
  completedProbe.probe_plan.critical_questions = []
  completedProbe.probe_plan.secondary_questions = []
  completedProbe.probe_result.loop_status = 'complete'
  completedProbe.probe_result.probe_triggered = false
  completedProbe.loop_closure = { status: 'complete', decision: 'complete', answered_question_ids: [], remaining_question_ids: [] }
  await assert.rejects(processProbeResponses({ engineRegistry: registry, candidateDataState: candidate, jobDataState: job, probePlan: completedProbe, previousMatchState: match, responses: [{ question_id: 'MPC_FT_002', answer: 'B2' }] }), /probe cycle is already complete/)
})

test('candidate-declared CEFR remains canonical when explicitly provided', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })
  const result = await processProbeResponses({ engineRegistry: registry, candidateDataState: candidate, jobDataState: job, probePlan: probe, previousMatchState: match, responses: [{ question_id: 'MPC_FT_002', answer: 'Je me situe à un niveau B2 en anglais professionnel, utilisé régulièrement avec des candidats et clients internationaux.' }] })
  const english = result.canonical_candidate_data_state.candidate_data_state.language_state.find((entry) => entry.language === 'anglais')
  assert.equal(english.cefr_level, 'B2')
  assert.equal(english.proficiency_confirmed, true)
  assert.equal(english.evidence_items.at(-1).interpretation_status, 'candidate_declared_cefr_level_present')
})
