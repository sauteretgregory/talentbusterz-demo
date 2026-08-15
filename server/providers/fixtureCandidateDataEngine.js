import candidateFixture from '../../src/tbz-v3/fixtures/doctrine/candidate.json' with {
  type: 'json'
}

function assertCanonicalCandidateDataState(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error(
      'TBZ fixture CANDIDATE DATA ENGINE: canonical candidate state is required.'
    )
  }

  if (artifact.artifact_type !== 'canonical_candidate_data_state') {
    throw new Error(
      'TBZ fixture CANDIDATE DATA ENGINE: invalid artifact_type.'
    )
  }

  if (artifact.engine_name !== 'TBZ_CANDIDATE_DATA_ENGINE') {
    throw new Error(
      'TBZ fixture CANDIDATE DATA ENGINE: invalid engine_name.'
    )
  }

  if (!artifact.artifact_filename) {
    throw new Error(
      'TBZ fixture CANDIDATE DATA ENGINE: artifact_filename is required.'
    )
  }

  if (!artifact.candidate_data_state?.candidate_id) {
    throw new Error(
      'TBZ fixture CANDIDATE DATA ENGINE: candidate_data_state.candidate_id is required.'
    )
  }

  return artifact
}

export function createFixtureCandidateDataEngineProvider() {
  return async function fixtureCandidateDataEngine(input = {}) {
    const candidate =
      input?.candidate_data_state ||
      input?.candidate ||
      candidateFixture

    if (
      candidate?.artifact_type === 'canonical_candidate_data_state'
    ) {
      return structuredClone(
        assertCanonicalCandidateDataState(candidate)
      )
    }

    throw new Error(
      'TBZ fixture CANDIDATE DATA ENGINE: canonical candidate state is required.'
    )
  }
}
