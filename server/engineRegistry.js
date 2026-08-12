import {
  ENGINE_IDS,
  createEngineRegistry,
  registerEngineProvider
} from './engineGateway.js'

import {
  createOpenAIJobDataEngineProvider
} from './providers/openaiJobDataEngine.js'

import {
  createFixtureJobDataEngineProvider
} from './providers/fixtureJobDataEngine.js'

import {
  createFixtureMatchEngineProvider
} from './providers/fixtureMatchEngine.js'

import {
  createFixtureProbeEngineProvider
} from './providers/fixtureProbeEngine.js'

export function createTbzEngineRegistry({
  engineMode = process.env.TBZ_ENGINE_MODE || 'fixture',
  openaiApiKey = process.env.OPENAI_API_KEY,
  openaiModel = process.env.OPENAI_MODEL,
  openaiClient = null
} = {}) {
  const registry = createEngineRegistry()

  if (engineMode === 'fixture') {
    registerEngineProvider(
      registry,
      ENGINE_IDS.JOB_DATA,
      createFixtureJobDataEngineProvider()
    )

    registerEngineProvider(
      registry,
      ENGINE_IDS.MATCH,
      createFixtureMatchEngineProvider()
    )

    registerEngineProvider(
      registry,
      ENGINE_IDS.PROBE,
      createFixtureProbeEngineProvider()
    )

    return registry
  }

  if (engineMode === 'openai') {
    if (
      (openaiApiKey || openaiClient) &&
      openaiModel
    ) {
      registerEngineProvider(
        registry,
        ENGINE_IDS.JOB_DATA,
        createOpenAIJobDataEngineProvider({
          apiKey: openaiApiKey,
          model: openaiModel,
          client: openaiClient
        })
      )
    }

    return registry
  }

  throw new Error(
    `TBZ: unsupported engine mode "${engineMode}".`
  )
}
