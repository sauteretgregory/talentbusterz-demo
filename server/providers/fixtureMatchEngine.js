import matchFranceTravail from '../../src/tbz-v3/fixtures/match-france-travail-210SDTY.json' with { type: 'json' }

export function createFixtureMatchEngineProvider() {
  return async function fixtureMatchEngine(input) {
    if (!input || typeof input !== 'object') {
      throw new Error(
        'TBZ fixture MATCH ENGINE: invalid input.'
      )
    }

    const candidate =
      input.candidate_data_state ||
      input.candidate ||
      null

    const job =
      input.job_data_state ||
      input.job ||
      null

    if (
      candidate?.artifact_type !==
        'canonical_candidate_data_state' ||
      job?.artifact_type !==
        'canonical_job_data_state'
    ) {
      throw new Error(
        'TBZ fixture MATCH ENGINE: canonical candidate and job states are required.'
      )
    }

    if (
      job.artifact_id !==
      'job_france_travail_talent_acquisition_210SDTY'
    ) {
      throw new Error(
        'TBZ fixture MATCH ENGINE: no fixture for this job.'
      )
    }

    if (
      candidate.artifact_id !==
      'candidate_gregory_sauteret_v1'
    ) {
      throw new Error(
        'TBZ fixture MATCH ENGINE: no fixture for this candidate.'
      )
    }

    return structuredClone(matchFranceTravail)
  }
}
