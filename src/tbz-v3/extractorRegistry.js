import {
  createExtractorRegistry,
  registerExtractor
} from './extractorGateway.js'

import {
  franceTravailExtractor
} from './providersFranceTravail.js'

export function createTbzExtractorRegistry() {
  const registry = createExtractorRegistry()

  registerExtractor(
    registry,
    'france_travail',
    franceTravailExtractor
  )

  return registry
}
