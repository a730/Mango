const mangaReaderComponent = () => {
  return {
    mangaTitle: "",
    currentPage: 0,
    totalPages: 0,
    pages: [],
    loading: true,
    loadingMsg: "Loading chapter...",

    init() {
      this.mangaTitle = manga_title || "";
      document.title = manga_title || "Manga Reader";

      fetch(`${base_url}api/manga/pages?plugin=${encodeURIComponent(plugin_id)}&chapter_id=${encodeURIComponent(chapter_id)}`)
        .then(r => r.json())
        .then(data => {
          if (!data.success) throw new Error(data.error);
          const pageList = data.pages || [];
          this.pages = pageList.map(p => ({ url: p.url, failed: false }));
          this.totalPages = pageList.length;
          this.loading = false;

          if (pageList.length === 0) {
            this.loadingMsg = "No pages found";
            this.loading = true;
          }
        })
        .catch(e => {
          this.loadingMsg = `Failed to load chapter: ${e.message}`;
        });
    },

    onPageLoaded() {
      // Track scroll for progress
    },

    onPageError(idx) {
      this.pages[idx].failed = true;
    },

    setupImageErrorHandling() {
      document.addEventListener("error", (e) => {
        if (e.target.tagName === "IMG" && e.target.dataset.mangaPage !== undefined) {
          const idx = parseInt(e.target.dataset.mangaPage);
          const img = e.target;
          if (!img._retryAttempted && img.src.includes("comicknew.pictures")) {
            img._retryAttempted = true;
            img.src = `${base_url}api/manga/image_proxy?url=${encodeURIComponent(img.src)}`;
          }
        }
      }, true);
    },
  };
};
