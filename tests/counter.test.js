const request = require('supertest');

// mockClient prefix allows use inside jest.mock factory despite hoisting
const mockClient = {
  get: jest.fn(),
  set: jest.fn(),
  smembers: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  del: jest.fn(),
  ttl: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockClient));

const redis = require('../src/redis');
const app = require('../src/index');

describe('Click Counter Feature', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ── redis layer ────────────────────────────────────────────────────────

  test('redis.list() returns entries with clicks field as number', async () => {
    mockClient.smembers.mockResolvedValue(['abc123']);
    mockClient.get.mockResolvedValue(
      JSON.stringify({ url: 'https://example.com', createdAt: new Date().toISOString(), clicks: 5 })
    );

    const entries = await redis.list();

    expect(entries[0]).toHaveProperty('clicks');
    expect(typeof entries[0].clicks).toBe('number');
  });

  test('redis.list() returns correct clicks value', async () => {
    mockClient.smembers.mockResolvedValue(['abc123']);
    mockClient.get.mockResolvedValue(
      JSON.stringify({ url: 'https://example.com', createdAt: new Date().toISOString(), clicks: 42 })
    );

    const entries = await redis.list();

    expect(entries[0].clicks).toBe(42);
  });

  test('redis.list() returns clicks: 0 when field is absent', async () => {
    mockClient.smembers.mockResolvedValue(['abc123']);
    mockClient.get.mockResolvedValue(
      JSON.stringify({ url: 'https://example.com', createdAt: new Date().toISOString() })
    );

    const entries = await redis.list();

    expect(entries[0].clicks).toBe(0);
  });

  test('redis.incrementClick() increments clicks in stored JSON', async () => {
    const stored = { url: 'https://example.com', createdAt: new Date().toISOString(), clicks: 3 };
    mockClient.get.mockResolvedValue(JSON.stringify(stored));
    mockClient.ttl.mockResolvedValue(3600);
    mockClient.set.mockResolvedValue('OK');

    await redis.incrementClick('abc123');

    const saved = JSON.parse(mockClient.set.mock.calls[0][1]);
    expect(saved.clicks).toBe(4);
  });

  test('redis.incrementClick() initialises clicks to 1 when field is absent', async () => {
    const stored = { url: 'https://example.com', createdAt: new Date().toISOString() };
    mockClient.get.mockResolvedValue(JSON.stringify(stored));
    mockClient.ttl.mockResolvedValue(3600);
    mockClient.set.mockResolvedValue('OK');

    await redis.incrementClick('abc123');

    const saved = JSON.parse(mockClient.set.mock.calls[0][1]);
    expect(saved.clicks).toBe(1);
  });

  test('redis.incrementClick() does nothing when code not found', async () => {
    mockClient.get.mockResolvedValue(null);

    await redis.incrementClick('notfound');

    expect(mockClient.set).not.toHaveBeenCalled();
  });

  // ── HTTP layer ─────────────────────────────────────────────────────────

  test('GET /:code calls incrementClick with the correct code', async () => {
    mockClient.get.mockResolvedValue(
      JSON.stringify({ url: 'https://example.com', createdAt: new Date().toISOString() })
    );
    mockClient.ttl.mockResolvedValue(3600);
    mockClient.set.mockResolvedValue('OK');

    await request(app).get('/abc123');

    const saved = JSON.parse(mockClient.set.mock.calls[0][1]);
    expect(saved.clicks).toBe(1);
  });

  test('GET /:code does not increment when code not found', async () => {
    mockClient.get.mockResolvedValue(null);

    await request(app).get('/notfound');

    expect(mockClient.set).not.toHaveBeenCalled();
  });

  test('GET /api/urls returns entries with clicks field', async () => {
    mockClient.smembers.mockResolvedValue(['abc123']);
    mockClient.get.mockResolvedValue(
      JSON.stringify({ url: 'https://example.com', createdAt: new Date().toISOString(), clicks: 7 })
    );

    const res = await request(app).get('/api/urls');

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('clicks');
    expect(typeof res.body[0].clicks).toBe('number');
  });

  test('GET /api/urls returns correct clicks value', async () => {
    mockClient.smembers.mockResolvedValue(['abc123']);
    mockClient.get.mockResolvedValue(
      JSON.stringify({ url: 'https://example.com', createdAt: new Date().toISOString(), clicks: 42 })
    );

    const res = await request(app).get('/api/urls');

    expect(res.body[0].clicks).toBe(42);
  });
});
