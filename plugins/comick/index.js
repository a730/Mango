var MW = mango.settings("middleware_base_url") || "http://localhost:3456";
var SOURCE = mango.settings("source") || "comick";
var _pages = [];

function proxyUrl(url) {
  if (!url) return "";
  return "/api/manga/image_proxy?url=" + encodeURIComponent(url);
}

function searchManga(query) {
  var url = MW + "/api/manga/search?q=" + encodeURIComponent(query) + "&source=" + encodeURIComponent(SOURCE);
  var res = mango.get(url);
  var data = JSON.parse(res.body);
  if (!data.success) return "[]";
  return JSON.stringify(data.results.map(function(m) {
    return { id: m.id, title: m.title || "", cover_url: proxyUrl(m.cover_url || "") };
  }));
}

function listChapters(mangaId) {
  var url = MW + "/api/manga/info?id=" + encodeURIComponent(mangaId) + "&source=" + encodeURIComponent(SOURCE);
  var res = mango.get(url);
  var data = JSON.parse(res.body);
  if (!data.success) return "[]";
  var info = data.info;
  return JSON.stringify((info.chapters || []).map(function(ch) {
    return { id: ch.id, title: ch.title || "", pages: ch.pages || 0, manga_title: info.title || "" };
  }));
}

function selectChapter(chapterId) {
  var url = MW + "/api/manga/pages?chapterId=" + encodeURIComponent(chapterId) + "&source=" + encodeURIComponent(SOURCE);
  var res = mango.get(url);
  var data = JSON.parse(res.body);
  if (!data.success) return JSON.stringify({ id: chapterId, title: "", pages: 0, manga_title: "" });
  _pages = data.pages || [];
  return JSON.stringify({ id: chapterId, title: "", pages: _pages.length, manga_title: "" });
}

function nextPage() {
  if (_pages.length === 0) return JSON.stringify({});
  var page = _pages.shift();
  return JSON.stringify({ url: proxyUrl(page.url), filename: "page_" + (page.page || (_pages.length + 1)) + ".jpg" });
}
