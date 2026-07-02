// Unit tests for the safe request-body reader. The critical case: Vercel's
// req.body getter THROWS on a JSON content-type with an invalid body — that
// must become an empty object (-> downstream 4xx), never an unhandled crash.
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBody } from '../api/_body.js';

test('malformed JSON (throwing body getter) yields {} instead of crashing', () => {
  const req = {};
  Object.defineProperty(req, 'body', { get() { throw new Error('Invalid JSON'); } });
  assert.deepEqual(readBody(req), {});
});

test('object body passes through', () => {
  assert.deepEqual(readBody({ body: { a: 1 } }), { a: 1 });
});

test('valid JSON string body is parsed', () => {
  assert.deepEqual(readBody({ body: '{"email":"x@y.z"}' }), { email: 'x@y.z' });
});

test('invalid JSON string body yields {}', () => {
  assert.deepEqual(readBody({ body: '{broken' }), {});
});

test('missing/null/non-object bodies yield {}', () => {
  assert.deepEqual(readBody({ body: undefined }), {});
  assert.deepEqual(readBody({ body: null }), {});
  assert.deepEqual(readBody({ body: 42 }), {});
});
