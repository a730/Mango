var API = mango.settings("api_base_url") || "https://api.consumet.org";
var PROVIDER = mango.settings("provider") || "gogoanime";

function searchAnime(query) {
  try {
    var res = mango.get(API + "/anime/" + PROVIDER + "/" + encodeURIComponent(query));
    var data = JSON.parse(res.body);
    var results = data.results || [];
    return JSON.stringify(results.map(function(a) {
      return { id: a.id, title: a.title || a.animeName || "", cover_url: a.image || a.poster || "" };
    }));
  } catch(e) { return "[]"; }
}

function listEpisodes(sourceId) {
  try {
    var res = mango.get(API + "/anime/" + PROVIDER + "/info/" + encodeURIComponent(sourceId));
    var data = JSON.parse(res.body);
    var episodes = data.episodes || [];
    return JSON.stringify(episodes.map(function(ep) {
      return { id: ep.id, number: ep.number, title: ep.title || "Episode " + ep.number, thumbnail: ep.image || "" };
    }));
  } catch(e) { return "[]"; }
}

function getStreamSources(episodeId) {
  try {
    var res = mango.get(API + "/anime/" + PROVIDER + "/watch/" + encodeURIComponent(episodeId));
    var data = JSON.parse(res.body);
    var sources = data.sources || [];
    return JSON.stringify(sources.map(function(s) {
      return {
        url: s.url, quality: s.quality || "720p",
        format: s.isM3U8 || (s.url && s.url.indexOf(".m3u8") !== -1) ? "hls" : "mp4",
        headers: { "Referer": "https://gogoanime.cl/", "User-Agent": "Mozilla/5.0" }
      };
    }));
  } catch(e) { return "[]"; }
}

function getSubtitles(episodeId) {
  try {
    var res = mango.get(API + "/anime/" + PROVIDER + "/watch/" + encodeURIComponent(episodeId));
    var data = JSON.parse(res.body);
    var subtitles = data.subtitles || [];
    return JSON.stringify(subtitles.map(function(s) {
      return { url: s.url || s.file, lang: s.lang || "English", format: "vtt" };
    }));
  } catch(e) { return "[]"; }
}
