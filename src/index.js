const express = require('express');
const path = require('path');
const { customAlphabet } = require('nanoid');

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);
const redis = require('./redis');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const api = express.Router();

api.post('/shorten', async (req, res) => {
  const { url } = req.body;

  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const code = nanoid(6);
  await redis.set(code, url);

  return res.status(200).json({ code, short: `/${code}` });
});

api.get('/urls', async (req, res) => {
  const entries = await redis.list();
  return res.status(200).json(entries);
});

api.delete('/:code', async (req, res) => {
  const deleted = await redis.del(req.params.code);
  if (!deleted) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(200).json({ deleted: req.params.code });
});

api.get('/health', (req, res) => {
  return res.status(200).json({ status: 'ok' });
});

app.use('/api', api);
app.use('/ui', express.static(path.join(__dirname, '../www')));

// short URL redirect — must be last
app.get('/:code', async (req, res) => {
  const url = await redis.get(req.params.code);

  if (!url) {
    return res.status(404).json({ error: 'Not found' });
  }

  return res.redirect(302, url);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
