import probeFranceTravail from '../../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with { type: 'json' }

export function createFixtureProbeEngineProvider() {
  return async function fixtureProbeEngine(input) {
    const match =
      input?.artifact_type === 'canonical_match_state'
        ? input
        : input?.match?.artifact_type === 'canonical_match_state'
          ? input.match
          : input?.match_state?.artifact_type === 'canonical_match_state'
            ? input.match_state
            : null

    if (
      !match ||
      match.artifact_type !== 'canonical_match_state'
    ) {
      throw new Error(
        'TBZ fixture PROBE ENGINE: canonical match state is required.'
      )
    }

    if (
      match.artifact_id !==
      'match_gregory_sauteret_france_travail_210SDTY'
    ) {
      throw new Error(
        'TBZ fixture PROBE ENGINE: no fixture for this match.'
      )
    }

    return structuredClone(probeFranceTravail)
  }
}
