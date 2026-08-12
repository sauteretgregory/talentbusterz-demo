import {
  ENGINE_IDS,
  createEngineRegistry,
  registerEngineProvider
} from './engineGateway.js'

import {
  createOpenAIJobDataEngineProvider
} from './providers/openaiJobDataEngine.js'

export function createTbzEngineRegistry({
  openaiApiKey = process.env.OPENAI_API_KEY,
  openaiModel = process.env.OPENAI_MODEL,
  openaiClient = null
} = {}) {
  const registry = createEngineRegistry()

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
