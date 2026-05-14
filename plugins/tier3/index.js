var MW = mango.settings("middleware_base_url") || "http://localhost:3456";
var SOURCE = mango.settings("source") || "hianime";

function searchAnime(query) {
  var url = MW + "/api/search?q=" + encodeURIComponent(query) + "&source=" + encodeURIComponent(SOURCE);
  var res = mango.get(url);
  var data = JSON.parse(res.body);
  if (!data.success) return "[]";
  return JSON.stringify(data.results.map(function(a) {
    return {
      id: a.id,
      title: a.title || "",
      cover_url: a.cover_url || ""
    };
  }));
}

function listEpisodes(sourceId) {
  var url = MW + "/api/episodes?id=" + encodeURIComponent(sourceId) + "&source=" + encodeURIComponent(SOURCE);
  var res = mango.get(url);
  var data = JSON.parse(res.body);
  if (!data.success) return "[]";
  return JSON.stringify(data.episodes.map(function(ep) {
    return {
      id: ep.id,
      number: ep.number,
      title: ep.title || "Episode " + ep.number,
      thumbnail: ep.thumbnail || ""
    };
  }));
}

function getStreamSources(episodeId) {
  var url = MW + "/api/sources?id=" + encodeURIComponent(episodeId) + "&source=" + encodeURIComponent(SOURCE);
  var res = mango.get(url);
  var data = JSON.parse(res.body);
  if (!data.success) return "[]";
  var sources = data.sources || [];
  return JSON.stringify(sources.map(function(s) {
    return {
      url: s.url,
      quality: s.quality || "720p",
      format: s.format || "hls",
      headers: {
        "Referer": "https://anikai.to/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    };
  }));
}

function getSubtitles(episodeId) {
  try {
    var url = MW + "/api/sources?id=" + encodeURIComponent(episodeId) + "&source=" + encodeURIComponent(SOURCE);
    var res = mango.get(url);
    var data = JSON.parse(res.body);
    var subtitles = data.subtitles || [];
    return JSON.stringify(subtitles.map(function(s) {
      return {
        url: s.file || s.url,
        lang: s.label || s.lang || "English",
        format: "vtt"
      };
    }));
  } catch(e) {
    return "[]";
  }
}
