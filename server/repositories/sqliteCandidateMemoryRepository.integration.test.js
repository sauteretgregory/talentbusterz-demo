import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import candidate from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with { type: 'json' }
import job from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }
import match from '../../src/tbz-v3/fixtures/match-france-travail-210SDTY.json' with { type: 'json' }
import probe from '../../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with { type: 'json' }
import { createTbzEngineRegistry } from '../engineRegistry.js'
import { executeEngine, ENGINE_IDS } from '../engineGateway.js'
import { processProbeResponses } from '../probeResponseLoop.js'
import { SqliteCandidateMemoryRepository } from './sqliteCandidateMemoryRepository.js'

test('PROBE -> Candidate Data -> SQLite -> reload -> MATCH works in the isolated lab', async () => {
  const registry = createTbzEngineRegistry({ engineMode: 'deterministic' })
  const result = await processProbeResponses({
    engineRegistry: registry,
    candidateDataState: candidate,
    jobDataState: job,
    probePlan: probe,
    previousMatchState: match,
    responses: [
      { question_id: 'MPC_FT_001', answer: 'Oui, j’ai recruté des profils IT dans un contexte ESN et société de services chez Anywr.' },
      { question_id: 'probe_ft_candidate_education_001', answer: 'Mon plus haut niveau validé est Bac+5, avec un diplôme de niveau master.' },
      { question_id: 'probe_ft_candidate_student_status_001', answer: 'Non, je ne suis actuellement pas étudiant et je ne suis pas en formation active.' },
      { question_id: 'MPC_FT_002', answer: 'J’ai travaillé en anglais en Australie et dans le recrutement avec des candidats et parties prenantes internationaux.' },
      { question_id: 'MPC_FT_003', answer: 'Je gérais environ 10 entretiens par semaine et 5 recrutements par mois.' }
    ]
  })

  assert.equal(result.canonical_candidate_data_state.artifact_type, 'canonical_candidate_data_state')
  assert.equal(result.canonical_candidate_data_state.state_version, 'v1.4_probe_response_integration')

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tbz-memory-lab-'))
  const databasePath = path.join(directory, 'candidate-memory.sqlite')
  const repository = new SqliteCandidateMemoryRepository({ filename: databasePath })
  const candidateId = result.canonical_candidate_data_state.candidate_data_state.candidate_id

  try {
    await repository.save(candidateId, result.canonical_candidate_data_state)
    repository.close()

    const reopenedRepository = new SqliteCandidateMemoryRepository({ filename: databasePath })
    try {
      const reloaded = await reopenedRepository.get(candidateId)
      assert.deepEqual(reloaded, result.canonical_candidate_data_state)

      const matchExecution = await executeEngine(registry, ENGINE_IDS.MATCH, {
        candidate_data_state: reloaded,
        job_data_state: job
      })

      assert.equal(matchExecution.status, 'completed')
      assert.equal(matchExecution.output_artifact.artifact_type, 'canonical_match_state')
      assert.equal(typeof matchExecution.output_artifact.match_state?.professional_compatibility?.professional_match_score, 'number')
    } finally {
      reopenedRepository.close()
    }
  } finally {
    if (fs.existsSync(databasePath)) fs.rmSync(databasePath)
    if (fs.existsSync(`${databasePath}-wal`)) fs.rmSync(`${databasePath}-wal`)
    if (fs.existsSync(`${databasePath}-shm`)) fs.rmSync(`${databasePath}-shm`)
    if (fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true })
  }
})
