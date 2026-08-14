export const JOB_ENGINE_INPUT_ARTIFACT_TYPE =
  'job_data_engine_input_payload'

export const JOB_ENGINE_INPUT_CONTRACT_VERSION =
  'v1.0'

export function assertJobEngineInputPayload(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('TBZ: JOB DATA ENGINE input is required.')
  }

  if (
    input.artifact_type !==
    JOB_ENGINE_INPUT_ARTIFACT_TYPE
  ) {
    throw new Error(
      'TBZ: expected job_data_engine_input_payload.'
    )
  }

  if (
    input.input_contract_version !==
    JOB_ENGINE_INPUT_CONTRACT_VERSION
  ) {
    throw new Error(
      'TBZ: unsupported JOB DATA ENGINE input contract.'
    )
  }

  return input
}
