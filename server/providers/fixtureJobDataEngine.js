import jobFranceTravail from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }

export function createFixtureJobDataEngineProvider() {
  return async function fixtureJobDataEngine(input) {
    if (
      !input ||
      input.artifact_type !== 'job_data_engine_input_payload'
    ) {
      throw new Error(
        'TBZ fixture JOB DATA ENGINE: invalid input artifact.'
      )
    }

    const offerId =
      input?.provider_payload?.offer_id

    if (offerId !== '210SDTY') {
      throw new Error(
        `TBZ fixture JOB DATA ENGINE: no fixture for offer ${offerId || 'unknown'}.`
      )
    }

    return structuredClone(jobFranceTravail)
  }
}
