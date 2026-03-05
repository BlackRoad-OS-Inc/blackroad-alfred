/**
 * BlackRoad Alfred Worker - Unit Tests
 * Run with: node --test tests/worker.test.js
 *
 * Copyright (c) 2024-2026 BlackRoad OS, Inc. All Rights Reserved.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Mock environment
const mockEnv = {
  API_SECRET: 'test-secret',
  WEBHOOK_SECRET: 'test-webhook-secret',
  STRIPE_WEBHOOK_SECRET: 'test-stripe-secret',
  VERSION: '1.0.0-test',
  ALLOWED_ORIGIN: '*',
  TASKS_KV: {
    _store: new Map(),
    async put(key, value, options) {
      this._store.set(key, value);
    },
    async get(key, type) {
      const val = this._store.get(key);
      if (!val) return null;
      return type === 'json' ? JSON.parse(val) : val;
    },
  },
};

// Mock context
const mockCtx = {
  waitUntil: () => {},
};

// Import the worker
const worker = require('../workers/alfred-worker.js');

// Helper to create mock Request objects
function createRequest(path, options = {}) {
  const url = `https://test.workers.dev${path}`;
  return new Request(url, options);
}

describe('Health Check', () => {
  it('should return 200 with status ok', async () => {
    const request = createRequest('/api/health');
    const response = await worker.default.fetch(request, mockEnv, mockCtx);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'blackroad-alfred');
    assert.equal(body.version, '1.0.0-test');
    assert.ok(body.timestamp);
  });
});

describe('Task Queue', () => {
  it('should reject unauthenticated requests', async () => {
    const request = createRequest('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'deploy', payload: {} }),
    });
    const response = await worker.default.fetch(request, mockEnv, mockCtx);

    assert.equal(response.status, 401);
  });

  it('should accept authenticated task submissions', async () => {
    const request = createRequest('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret',
      },
      body: JSON.stringify({ type: 'deploy', payload: { service: 'test' } }),
    });
    const response = await worker.default.fetch(request, mockEnv, mockCtx);
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.status, 'queued');
    assert.ok(body.taskId);
  });

  it('should return 404 for unknown task IDs', async () => {
    const emptyEnv = { ...mockEnv, TASKS_KV: { async get() { return null; } } };
    const request = createRequest('/api/tasks/nonexistent-id');
    const response = await worker.default.fetch(request, emptyEnv, mockCtx);

    assert.equal(response.status, 404);
  });
});

describe('Webhooks', () => {
  it('should reject deploy webhook without auth', async () => {
    const request = createRequest('/api/webhook/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'deploy' }),
    });
    const response = await worker.default.fetch(request, mockEnv, mockCtx);

    assert.equal(response.status, 401);
  });

  it('should accept authenticated deploy webhooks', async () => {
    const request = createRequest('/api/webhook/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-webhook-secret',
      },
      body: JSON.stringify({ event: 'deploy', service: 'test' }),
    });
    const response = await worker.default.fetch(request, mockEnv, mockCtx);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.received, true);
  });

  it('should reject Stripe webhook without signature', async () => {
    const request = createRequest('/api/webhook/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    const response = await worker.default.fetch(request, mockEnv, mockCtx);

    assert.equal(response.status, 400);
  });
});

describe('CORS', () => {
  it('should return 204 for OPTIONS preflight', async () => {
    const request = createRequest('/api/health', { method: 'OPTIONS' });
    const response = await worker.default.fetch(request, mockEnv, mockCtx);

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get('Access-Control-Allow-Methods'),
      'GET, POST, OPTIONS'
    );
  });
});

describe('404 Handling', () => {
  it('should return 404 with endpoint list for unknown paths', async () => {
    const request = createRequest('/unknown');
    const response = await worker.default.fetch(request, mockEnv, mockCtx);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, 'Not found');
    assert.ok(body.availableEndpoints);
    assert.ok(body.availableEndpoints.length > 0);
  });
});
