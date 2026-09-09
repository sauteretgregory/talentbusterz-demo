import jobFranceTravail from '../../src/tbz-v3/fixtures/job-france-travail-210SDTY.json' with { type: 'json' }

import {
  assertCanonicalJobDataState
} from '../../src/tbz-v3/contracts/jobDataContract.js'

import {
  assertJobEngineInputPayload
} from '../../src/tbz-v3/contracts/jobEngineInputContract.js'

export function createFixtureJobDataEngineProvider() {
  return async function fixtureJobDataEngine(input) {
    assertJobEngineInputPayload(input)

    const offerId =
      input?.provider_payload?.offer_id

    if (offerId !== '210SDTY') {
      throw new Error(
        `TBZ fixture JOB DATA ENGINE: no fixture for offer ${offerId || 'unknown'}.`
      )
    }

    return assertCanonicalJobDataState(
      structuredClone(jobFranceTravail)
    )
  }
}
