import test from 'node:test'
import assert from 'node:assert/strict'

import candidate from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }
import probe from '../../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with { type: 'json' }

import { createTbzEngineRegistry } from '../engineRegistry.js'
import { processProbeResponses } from '../probeResponseLoop.js'

test('probe responses are reingested, MATCH is rerun, and a new PROBE is produced', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })

  const result = await processProbeResponses({
    engineRegistry: registry,
    candidateDataState: candidate,
    jobDataState: job,
    probePlan: probe,
    responses: [
      {
        question_id: 'MPC_FT_001',
        answer: 'Oui, j’ai recruté des profils IT dans un contexte ESN et société de services chez Anywr.'
      },
      {
        question_id: 'probe_ft_candidate_education_001',
        answer: 'Mon plus haut niveau validé est Bac+5, avec un diplôme de niveau master.'
      },
      {
        question_id: 'probe_ft_candidate_student_status_001',
        answer: 'Non, je ne suis actuellement pas étudiant et je ne suis pas en formation active.'
      },
      {
        question_id: 'MPC_FT_002',
        answer: 'J’ai obtenu 20/20 à un oral d’anglais pendant mon BTS. J’ai vécu et travaillé environ deux ans en Australie, où j’ai vendu des abonnements satellite en anglais. J’ai aussi recruté en anglais avec des candidats et parties prenantes au Vietnam, au Canada, en Inde et au Pakistan.'
      },
      {
        question_id: 'MPC_FT_003',
        answer: 'Je gérais environ 10 entretiens par semaine et 5 recrutements par mois, avec des pics de charge réguliers.'
      }
    ]
  })

  assert.equal(result.canonical_candidate_data_state.artifact_type, 'canonical_candidate_data_state')
  assert.equal(result.canonical_candidate_data_state.state_version, 'v1.4_probe_response_integration')
  assert.equal(result.canonical_candidate_data_state.artifact_filename, 'candidate_gregory_sauteret_v1.4.json')

  const state = result.canonical_candidate_data_state.candidate_data_state
  assert.equal(state.highest_completed_education_level.value, 'bac_plus_5')
  assert.equal(state.current_student_status.active, false)

  const english = state.language_state.find((entry) => entry.language === 'anglais')
  assert.ok(english)
  assert.equal(english.cefr_level, undefined)
  assert.equal(english.proficiency_confirmed, undefined)
  assert.equal(english.evidence_status, 'confirmed')
  assert.equal(english.evidence_origin_type, 'direct_user_statement')
  assert.equal(english.evidence_items.length, 1)
  assert.equal(english.evidence_items[0].interpretation_status, 'not_cefr_mapped')
  assert.equal(english.evidence_items[0].signals.english_exam_score_20_20, true)
  assert.equal(english.evidence_items[0].signals.australia_lived_or_worked, true)
  assert.equal(english.evidence_items[0].signals.english_sales_experience, true)
  assert.equal(english.evidence_items[0].signals.english_international_recruitment, true)

  const experience = state.experience_state.find((entry) => entry.experience_id === 'exp_anywr_2022_2025')
  assert.ok(experience.probe_response_state.context_confirmed)

  assert.equal(result.canonical_match_state.artifact_type, 'canonical_match_state')
  assert.equal(result.canonical_probe_plan.artifact_type, 'canonical_probe_plan')
})

test('candidate-declared CEFR remains canonical when explicitly provided', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })
  const result = await processProbeResponses({
    engineRegistry: registry,
    candidateDataState: candidate,
    jobDataState: job,
    probePlan: probe,
    responses: [{
      question_id: 'MPC_FT_002',
      answer: 'Je me situe à un niveau B2 en anglais professionnel, utilisé régulièrement avec des candidats et clients internationaux.'
    }]
  })

  const english = result.canonical_candidate_data_state.candidate_data_state.language_state.find((entry) => entry.language === 'anglais')
  assert.equal(english.cefr_level, 'B2')
  assert.equal(english.proficiency_confirmed, true)
  assert.equal(english.evidence_items.at(-1).interpretation_status, 'candidate_declared_cefr_level_present')
})
