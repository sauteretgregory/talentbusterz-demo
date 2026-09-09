import test from 'node:test'
import assert from 'node:assert/strict'

import { isBackendUnreachable, OFFLINE_DEMO_MESSAGE } from './offlineFallback.js'

test('isBackendUnreachable is true for a TypeError (fetch could not connect at all)', () => {
  assert.equal(isBackendUnreachable(new TypeError('Failed to fetch')), true)
  assert.equal(isBackendUnreachable(new TypeError('NetworkError when attempting to fetch resource.')), true)
  assert.equal(isBackendUnreachable(new TypeError('Load failed')), true)
})

test('isBackendUnreachable is false for a real API error (backend responded, just with an error)', () => {
  assert.equal(isBackendUnreachable(new Error('job_url_required')), false)
  assert.equal(isBackendUnreachable(new Error('Échec de l’analyse de l’offre.')), false)
})

test('isBackendUnreachable is false for non-error values', () => {
  assert.equal(isBackendUnreachable(undefined), false)
  assert.equal(isBackendUnreachable('Failed to fetch'), false)
})

test('OFFLINE_DEMO_MESSAGE is a non-empty, user-facing string (not a raw technical error)', () => {
  assert.equal(typeof OFFLINE_DEMO_MESSAGE, 'string')
  assert.ok(OFFLINE_DEMO_MESSAGE.length > 20)
  assert.ok(!OFFLINE_DEMO_MESSAGE.includes('TypeError'))
  assert.ok(!OFFLINE_DEMO_MESSAGE.includes('fetch'))
})
