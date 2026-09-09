import probeFranceTravail from '../../src/tbz-v3/fixtures/probe-france-travail-210SDTY.json' with {
  type: 'json'
}

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

    const expectedSource =
      probeFranceTravail.source_match_artifact

    if (!expectedSource) {
      throw new Error(
        'TBZ fixture PROBE ENGINE: probe fixture source_match_artifact is missing.'
      )
    }

    if (
      match.artifact_id !==
      expectedSource.artifact_id
    ) {
      throw new Error(
        `TBZ fixture PROBE ENGINE: match artifact_id mismatch. Expected ${expectedSource.artifact_id}, received ${match.artifact_id}.`
      )
    }

    if (
      match.engine_version !==
      expectedSource.engine_version
    ) {
      throw new Error(
        `TBZ fixture PROBE ENGINE: match engine_version mismatch. Expected ${expectedSource.engine_version}, received ${match.engine_version}.`
      )
    }

    if (
      match.match_id !==
      expectedSource.match_id
    ) {
      throw new Error(
        `TBZ fixture PROBE ENGINE: match_id mismatch. Expected ${expectedSource.match_id}, received ${match.match_id}.`
      )
    }

    return structuredClone(probeFranceTravail)
  }
}
