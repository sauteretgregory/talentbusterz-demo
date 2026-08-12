import assert from 'node:assert/strict'
import {
  createArtifactStore,
  ingestCanonicalArtifact,
  TBZ_ARTIFACT_TYPES
} from './artifactStore.js'

const candidate = {
  artifact_type: TBZ_ARTIFACT_TYPES.CANDIDATE,
  state_version: '1.3',
  candidate_data: { name: 'TEST' }
}

const store = createArtifactStore()

assert.deepEqual(store, {
  candidate: null,
  job: null,
  match: null,
  probePlan: null,
  probeDialog: null
})

const updated = ingestCanonicalArtifact(store, candidate)

assert.equal(updated.candidate, candidate)
assert.equal(store.candidate, null)

assert.throws(
  () => ingestCanonicalArtifact(store, {}),
  /artifact_type/
)

assert.throws(
  () =>
    ingestCanonicalArtifact(store, {
      artifact_type: 'unknown_artifact',
      state_version: '1.0'
    }),
  /unsupported artifact_type/
)

assert.throws(
  () =>
    ingestCanonicalArtifact(store, {
      artifact_type: TBZ_ARTIFACT_TYPES.CANDIDATE
    }),
  /state_version/
)

console.log('✓ TBZ V3 canonical artifact tests passed')
