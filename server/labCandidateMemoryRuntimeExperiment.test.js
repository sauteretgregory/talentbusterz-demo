import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import candidate from '../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }
import match from '../src/tbz-v3/fixtures/match-france-travail-210SDTY.json' with { type: 'json' }
import probe from '../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with { type: 'json' }
import { createTbzEngineRegistry } from './engineRegistry.js'
import { SqliteCandidateMemoryRepository } from './repositories/sqliteCandidateMemoryRepository.js'
import {
  processProbeResponsesFromCandidateMemory,
  rerunMatchFromCandidateMemory
} from './labCandidateMemoryRuntimeExperiment.js'

test('candidate-id runtime experiment removes candidate state from the inter-request payload and survives restart', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tbz-runtime-memory-lab-'))
  const databasePath = path.join(directory, 'candidate-memory.sqlite')
  const candidateId = candidate.candidate_data_state.candidate_id
  let repository = new SqliteCandidateMemoryRepository({ filename: databasePath })

  try {
    await repository.save(candidateId, candidate)

    const first = await processProbeResponsesFromCandidateMemory({
      repository,
      engineRegistry: registry,
      candidateId,
      jobDataState: job,
      probePlan: probe,
      previousMatchState: match,
      responses: [
        { question_id: 'MPC_FT_001', answer: 'Oui, j’ai recruté des profils IT dans un contexte ESN.' },
        { question_id: 'probe_ft_candidate_education_001', answer: 'Bac+5, niveau master.' },
        { question_id: 'probe_ft_candidate_student_status_001', answer: 'Non, je ne suis actuellement pas étudiant.' },
        { question_id: 'MPC_FT_002', answer: 'J’ai utilisé l’anglais professionnel avec des candidats internationaux.' },
        { question_id: 'MPC_FT_003', answer: 'Environ 10 entretiens par semaine et 5 recrutements par mois.' }
      ]
    })

    assert.equal(first.canonical_candidate_data_state.state_version, 'v1.4_probe_response_integration')
    assert.equal((await repository.get(candidateId)).state_version, 'v1.4_probe_response_integration')

    repository.close()
    repository = new SqliteCandidateMemoryRepository({ filename: databasePath })

    const second = await processProbeResponsesFromCandidateMemory({
      repository,
      engineRegistry: registry,
      candidateId,
      jobDataState: job,
      probePlan: first.canonical_probe_plan,
      previousMatchState: first.canonical_match_state,
      responses: [
        { question_id: 'probe_lab_generic_001', answer: 'Nouvelle information persistante capturée après rechargement.' }
      ],
      cycleNumber: 2
    })

    assert.equal(second.canonical_candidate_data_state.state_version, 'v1.5_probe_response_integration')
    const reloaded = await repository.get(candidateId)
    assert.equal(reloaded.state_version, 'v1.5_probe_response_integration')
    assert.equal(
      reloaded.candidate_data_state.continuous_enrichment_state.last_question_id,
      'probe_lab_generic_001'
    )

    repository.close()
    repository = new SqliteCandidateMemoryRepository({ filename: databasePath })

    const rerun = await rerunMatchFromCandidateMemory({
      repository,
      engineRegistry: registry,
      candidateId,
      jobDataState: job
    })

    assert.equal(rerun.artifact_type, 'canonical_match_state')
    assert.equal(typeof rerun.match_state?.professional_compatibility?.professional_match_score, 'number')
  } finally {
    repository.close()
    if (fs.existsSync(databasePath)) fs.rmSync(databasePath)
    if (fs.existsSync(`${databasePath}-wal`)) fs.rmSync(`${databasePath}-wal`)
    if (fs.existsSync(`${databasePath}-shm`)) fs.rmSync(`${databasePath}-shm`)
    if (fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true })
  }
})
