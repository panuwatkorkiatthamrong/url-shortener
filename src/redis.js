const Redis = require('ioredis');

const client = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
});

const DEFAULT_TTL = 604800; // 7 days
const CODES_SET = '__codes__';

const redis = {
  async set(code, url, ttlSeconds = DEFAULT_TTL) {
    const entry = JSON.stringify({
      url,
      createdAt: new Date().toISOString(),
      enabled: true,
      clicks: 0
    });

    await client.set(code, entry, 'EX', ttlSeconds);
    await client.sadd(CODES_SET, code);
    return true;
  },

  async get(code) {
    const raw = await client.get(code);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (parsed.enabled === false) return null;

    return parsed.url;
  }, // ✅ ต้องมี comma

  async list() {
    const codes = await client.smembers(CODES_SET);

    const entries = await Promise.all(codes.map(async (code) => {
      const raw = await client.get(code);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      return {
        code,
        url: parsed.url,
        createdAt: parsed.createdAt,
        enabled: parsed.enabled !== false,
        clicks: parsed.clicks || 0
      };
    }));

    return entries
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // ✅ fix
  },

  async toggle(code) {
    const raw = await client.get(code);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    parsed.enabled = !parsed.enabled;

    const ttl = await client.ttl(code);
    await client.set(code, JSON.stringify(parsed), 'EX', ttl > 0 ? ttl : DEFAULT_TTL);

    return parsed.enabled;
  },

  async incrementClick(code) {
    const raw = await client.get(code);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    parsed.clicks = (parsed.clicks || 0) + 1;

    const ttl = await client.ttl(code);
    await client.set(code, JSON.stringify(parsed), 'EX', ttl > 0 ? ttl : DEFAULT_TTL);
  },

  async del(code) {
    const result = await client.del(code);
    await client.srem(CODES_SET, code);
    return result;
  },
};

module.exports = redis;
