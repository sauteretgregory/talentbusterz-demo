export const ENGINE_IDS = Object.freeze({
  JOB_DATA: 'TBZ_JOB_DATA_ENGINE',
  MATCH: 'TBZ_MATCH_ENGINE',
  PROBE: 'TBZ_PROBE_ENGINE'
})

export function createEngineRegistry() {
  return new Map()
}

export function registerEngineProvider(
  registry,
  engineId,
  provider
) {
  if (!(registry instanceof Map)) {
    throw new Error('TBZ: invalid engine registry.')
  }

  if (!engineId || typeof engineId !== 'string') {
    throw new Error('TBZ: engine_id is required.')
  }

  if (typeof provider !== 'function') {
    throw new Error('TBZ: engine provider must be a function.')
  }

  registry.set(engineId, provider)
  return registry
}

export async function executeEngine(
  registry,
  engineId,
  input
) {
  const provider = registry.get(engineId)

  if (!provider) {
    return {
      status: 'engine_not_configured',
      engine_id: engineId,
      output_artifact: null,
      error: 'no_engine_provider_registered'
    }
  }

  try {
    const result = await provider(input)

    if (!result || typeof result !== 'object') {
      throw new Error('Engine provider returned an invalid result.')
    }

    return {
      status: 'completed',
      engine_id: engineId,
      output_artifact: result,
      error: null
    }
  } catch (error) {
    return {
      status: 'failed',
      engine_id: engineId,
      output_artifact: null,
      error: error.message
    }
  }
}
