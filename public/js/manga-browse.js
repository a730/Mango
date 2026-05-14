const mangaBrowseComponent = () => {
  return {
    plugins: [],
    pid: null,
    query: "",
    searching: false,
    results: null,
    selectedManga: null,
    chapters: null,
    loadingChapters: false,

    init() {
      fetch(`${base_url}api/admin/plugin?capability=manga`)
        .then(r => r.json())
        .then(data => {
          if (!data.success) throw new Error(data.error);
          this.plugins = data.plugins;
          const pid = localStorage.getItem("manga-plugin");
          if (pid && this.plugins.map(p => p.id).includes(pid))
            return this.loadPlugin(pid);
          if (this.plugins.length > 0)
            this.loadPlugin(this.plugins[0].id);
        })
        .catch(e => alert("danger", `Failed to list manga plugins: ${e}`));
    },

    loadPlugin(pid) {
      this.pid = pid;
      localStorage.setItem("manga-plugin", pid);
    },

    pluginChanged() {
      this.results = null;
      this.selectedManga = null;
      this.chapters = null;
      this.loadPlugin(this.pid);
    },

    search() {
      const q = this.query.trim();
      if (!q) return;

      this.searching = true;
      this.results = null;
      this.selectedManga = null;
      this.chapters = null;

      fetch(`${base_url}api/manga/search?plugin=${encodeURIComponent(this.pid)}&query=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(data => {
          if (!data.success) throw new Error(data.error);
          this.results = data.results;
        })
        .catch(e => alert("danger", `Search failed: ${e}`))
        .finally(() => { this.searching = false; });
    },

    selectManga(manga) {
      this.selectedManga = manga;
      this.loadingChapters = true;
      this.chapters = null;

      fetch(`${base_url}api/manga/chapters?plugin=${encodeURIComponent(this.pid)}&source_id=${encodeURIComponent(manga.id)}`)
        .then(r => r.json())
        .then(data => {
          if (!data.success) throw new Error(data.error);
          this.chapters = data.chapters;
        })
        .catch(e => alert("danger", `Failed to load chapters: ${e}`))
        .finally(() => { this.loadingChapters = false; });
    },

    readChapter(chapter) {
      window.location.href = `${base_url}manga/read?plugin=${encodeURIComponent(this.pid)}&chapter_id=${encodeURIComponent(chapter.id)}&title=${encodeURIComponent(this.selectedManga.title)}`;
    },
  };
};
