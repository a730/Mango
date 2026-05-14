const express = require('express');
const cors = require('cors');
const { ANIME, MANGA } = require('@consumet/extensions');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3456;
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

function cached(key, ttl = CACHE_TTL) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return null;
}
function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

const kai = new ANIME.AnimeKai();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const TIMEOUT = 15000;

async function fetchWithTimeout(url, opts = {}) {
  const source = axios.CancelToken.source();
  const timeout = setTimeout(() => source.cancel('Request timed out'), opts.timeout || TIMEOUT);
  try {
    const res = await axios({ url, cancelToken: source.token, ...opts });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function decryptMegaUp(mediaUrl, referer) {
  const { data } = await fetchWithTimeout(mediaUrl, {
    headers: { Connection: 'keep-alive', 'User-Agent': UA, Referer: referer },
    timeout: TIMEOUT
  });
  const encText = data.result;
  if (!encText) throw new Error('No encrypted data found');
  const { data: decrypted } = await fetchWithTimeout('https://enc-dec.app/api/dec-mega', {
    method: 'post',
    data: { text: encText, agent: UA },
    headers: { 'Content-Type': 'application/json' },
    timeout: TIMEOUT
  });
  return decrypted.result;
}

async function resolveAnimeSources(episodeId) {
  const servers = await kai.fetchEpisodeServers(episodeId);
  if (!servers.length) throw new Error('No servers found');

  let lastErr;
  for (const server of servers) {
    try {
      const { data: iframeHtml } = await fetchWithTimeout(server.url, {
        headers: { 'User-Agent': UA, Referer: 'https://anikai.to/' },
        timeout: TIMEOUT
      });
      const $ = cheerio.load(iframeHtml);
      const megaupUrl = $('iframe').attr('src');
      if (!megaupUrl) continue;

      const mediaUrl = megaupUrl.replace('/e/', '/media/');
      const decrypted = await decryptMegaUp(mediaUrl, megaupUrl);

      const sources = (decrypted.sources || []).map(s => ({
        url: s.file,
        quality: s.label || '720p',
        format: s.file && s.file.includes('.m3u8') ? 'hls' : 'mp4'
      }));
      const subtitles = (decrypted.tracks || []).map(t => ({
        file: t.file, label: t.label || 'English', kind: t.kind || 'captions'
      }));
      return { sources, subtitles };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All servers failed');
}

// ── Anime endpoints ──

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: false, error: 'Missing query parameter "q"' });
    const cacheKey = `search:${q}`;
    const cachedData = cached(cacheKey);
    if (cachedData) return res.json({ success: true, results: cachedData });
    const results = await kai.search(q);
    const list = (results.results || []).map(a => ({ id: a.id, title: a.title || '', cover_url: a.image || '' }));
    setCache(cacheKey, list);
    res.json({ success: true, results: list });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/episodes', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json({ success: false, error: 'Missing query parameter "id"' });
    const cacheKey = `episodes:${id}`;
    const cachedData = cached(cacheKey);
    if (cachedData) return res.json({ success: true, episodes: cachedData });
    const info = await kai.fetchAnimeInfo(id);
    const episodes = (info.episodes || []).map(ep => ({ id: ep.id, number: ep.number, title: ep.title || `Episode ${ep.number}`, thumbnail: '' }));
    setCache(cacheKey, episodes);
    res.json({ success: true, episodes });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/sources', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json({ success: false, error: 'Missing query parameter "id"' });
    const result = await resolveAnimeSources(id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── Manga endpoints ──

const MANGA_PROVIDERS = {
  mangadex: new MANGA.MangaDex(),
  comick: new MANGA.ComicK(),
  mangahere: new MANGA.MangaHere(),
  mangapill: new MANGA.MangaPill(),
  weebcentral: new MANGA.WeebCentral(),
};

app.get('/api/manga/providers', (req, res) => {
  res.json({ success: true, providers: Object.keys(MANGA_PROVIDERS) });
});

app.get('/api/manga/search', async (req, res) => {
  try {
    const { q, source = 'mangadex' } = req.query;
    if (!q) return res.json({ success: false, error: 'Missing query parameter "q"' });
    const cacheKey = `msearch:${source}:${q}`;
    const cachedData = cached(cacheKey);
    if (cachedData) return res.json({ success: true, results: cachedData });
    const prov = MANGA_PROVIDERS[source];
    if (!prov) return res.json({ success: false, error: `Unknown provider: ${source}` });
    const results = await prov.search(q);
    const list = (results.results || []).map(m => ({
      id: m.id, title: m.title || '',
      cover_url: m.image || ''
    }));
    setCache(cacheKey, list);
    res.json({ success: true, results: list });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/manga/info', async (req, res) => {
  try {
    const { id, source = 'mangadex' } = req.query;
    if (!id) return res.json({ success: false, error: 'Missing query parameter "id"' });
    const cacheKey = `minfo:${source}:${id}`;
    const cachedData = cached(cacheKey);
    if (cachedData) return res.json({ success: true, info: cachedData });
    const prov = MANGA_PROVIDERS[source];
    if (!prov) return res.json({ success: false, error: `Unknown provider: ${source}` });
    const info = await prov.fetchMangaInfo(id);
    const chapters = (info.chapters || []).map(ch => ({
      id: ch.id, title: ch.title || `Chapter ${ch.chapterNumber || ch.number || ''}`,
      chapterNumber: ch.chapterNumber || ch.number || 0,
      pages: ch.pages || 0,
      manga_title: info.title || ''
    }));
    const result = { title: info.title || '', cover_url: info.image || '', description: info.description || '', chapters };
    setCache(cacheKey, result);
    res.json({ success: true, info: result });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/manga/pages', async (req, res) => {
  try {
    const { chapterId, source = 'mangadex' } = req.query;
    if (!chapterId) return res.json({ success: false, error: 'Missing query parameter "chapterId"' });
    const cacheKey = `mpages:${source}:${chapterId}`;
    const cachedData = cached(cacheKey);
    if (cachedData) return res.json({ success: true, pages: cachedData });
    const prov = MANGA_PROVIDERS[source];
    if (!prov) return res.json({ success: false, error: `Unknown provider: ${source}` });
    const pages = await prov.fetchChapterPages(chapterId);
    const list = (pages || []).map(p => ({ url: p.img || p.url || '', page: p.page || 0 }));
    setCache(cacheKey, list);
    res.json({ success: true, pages: list });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── Health ──

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), memory: process.memoryUsage().rss, cache_size: cache.size, provider: 'AnimeKai + MangaDex' });
});

app.listen(PORT, () => {
  console.log(`[anime-middleware] Server running on http://localhost:${PORT}`);
  console.log(`[anime-middleware] Anime: AnimeKai | Manga: ${Object.keys(MANGA_PROVIDERS).join(', ')}`);
});
