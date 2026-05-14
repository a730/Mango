var API = mango.settings("api_base_url") || "https://4animo.xyz/api/v2";

function searchAnime(query) {
  var res = mango.get(API + "/search?keyword=" + encodeURIComponent(query));
  var data = JSON.parse(res.body);
  if (!data.success || !data.results) return [];
  return data.results.map(function(a) {
    return {
      id: a.id,
      title: a.title || a.name,
      cover_url: a.poster || a.cover || ""
    };
  });
}

function listEpisodes(sourceId) {
  var res = mango.get(API + "/episodes/" + encodeURIComponent(sourceId));
  var data = JSON.parse(res.body);
  if (!data.success || !data.episodes) return [];
  return data.episodes.map(function(ep) {
    return {
      id: ep.episodeId || String(ep.number),
      number: ep.number,
      title: ep.title || "Episode " + ep.number,
      thumbnail: ep.image || ep.thumbnail || ""
    };
  });
}

function getStreamSources(episodeId) {
  var res = mango.get(API + "/stream?episodeId=" + encodeURIComponent(episodeId) + "&server=hd-1&type=sub");
  var data = JSON.parse(res.body);
  var sources = data.sources || [];
  if (sources.length === 0) {
    // Try alternate server
    res = mango.get(API + "/stream?episodeId=" + encodeURIComponent(episodeId) + "&server=hd-2&type=sub");
    data = JSON.parse(res.body);
    sources = data.sources || [];
  }
  return sources.map(function(s) {
    return {
      url: s.url,
      quality: s.quality || "720p",
      format: s.url && s.url.indexOf(".m3u8") !== -1 ? "hls" : "mp4",
      headers: {
        "Referer": "https://hianime.to/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    };
  });
}

function getSubtitles(episodeId) {
  try {
    var res = mango.get(API + "/stream?episodeId=" + encodeURIComponent(episodeId) + "&server=hd-1&type=sub");
    var data = JSON.parse(res.body);
    var tracks = data.subtitles || data.tracks || [];
    return tracks.map(function(t) {
      return {
        url: t.file || t.url,
        lang: t.label || t.lang || "English",
        format: "vtt"
      };
    });
  } catch(e) {
    return [];
  }
}
