var API = mango.settings("api_base_url") || "http://localhost:8000";

function searchAnime(query) {
  var res = mango.get(API + "/search?q=" + encodeURIComponent(query));
  var data = JSON.parse(res.body);
  var results = data.results || [];
  return results.map(function(a) {
    return {
      id: String(a.id),
      title: a.title || a.name || "",
      cover_url: a.image || a.cover || ""
    };
  });
}

function listEpisodes(sourceId) {
  var res = mango.get(API + "/episodes/" + encodeURIComponent(sourceId));
  var data = JSON.parse(res.body);
  var episodes = data.episodes || [];
  return episodes.map(function(ep) {
    var epId = ep.id || "";
    return {
      id: epId,
      number: ep.number || ep.episode || 0,
      title: ep.title || "Episode " + (ep.number || ep.episode || ""),
      thumbnail: ep.image || ep.thumbnail || ""
    };
  });
}

function getStreamSources(episodeId) {
  var res = mango.get(API + "/" + encodeURIComponent(episodeId));
  var data = JSON.parse(res.body);
  var streams = data.streams || [];
  return streams.map(function(s) {
    return {
      url: s.url,
      quality: s.quality || "720p",
      format: s.type || (s.url && s.url.indexOf(".m3u8") !== -1 ? "hls" : "mp4"),
      headers: {
        "Referer": "https://miruro.tv/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    };
  });
}

function getSubtitles(episodeId) {
  try {
    var res = mango.get(API + "/" + encodeURIComponent(episodeId));
    var data = JSON.parse(res.body);
    var subtitles = data.subtitles || [];
    return subtitles.map(function(s) {
      return {
        url: s.file || s.url,
        lang: s.label || s.lang || "English",
        format: "vtt"
      };
    });
  } catch(e) {
    return [];
  }
}
