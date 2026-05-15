const animeBrowseComponent = () => {
	return {
		plugins: [],
		info: null,
		pid: null,
		query: "",
		searching: false,
		results: null,
		selectedAnime: null,
		episodes: null,
		loadingEpisodes: false,
		page: 1,
		limit: 20,
		hasMore: false,
		metadataCache: {},

		init() {
			fetch(`${base_url}api/admin/plugin?capability=anime`)
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					this.plugins = data.plugins;

					const pid = localStorage.getItem("anime-plugin");
					if (pid && this.plugins.map(p => p.id).includes(pid))
						return this.loadPlugin(pid);

					if (this.plugins.length > 0)
						this.loadPlugin(this.plugins[0].id);
				})
				.catch(e => {
					alert("danger", `Failed to list anime plugins: ${e}`);
				});
		},

		loadPlugin(pid) {
			fetch(`${base_url}api/admin/plugin/info?plugin=${encodeURIComponent(pid)}`)
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					this.info = data.info;
					this.pid = pid;
				})
				.catch(e => {
					alert("danger", `Failed to get plugin info: ${e}`);
				});
		},

		pluginChanged() {
			this.results = null;
			this.selectedAnime = null;
			this.episodes = null;
			this.page = 1;
			this.hasMore = false;
			this.loadPlugin(this.pid);
			localStorage.setItem("anime-plugin", this.pid);
		},

		search(reset = true) {
			const q = this.query.trim();
			if (!q) return;

			if (reset) {
				this.page = 1;
				this.results = null;
				this.hasMore = false;
			}

			this.searching = true;
			this.selectedAnime = null;
			this.episodes = null;

			fetch(`${base_url}api/anime/search?plugin=${encodeURIComponent(this.pid)}&query=${encodeURIComponent(q)}&page=${this.page}&limit=${this.limit}`)
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					const newResults = data.results || [];

					if (reset) {
						this.results = newResults;
					} else {
						this.results = (this.results || []).concat(newResults);
					}

					this.hasMore = newResults.length >= this.limit;
				})
				.catch(e => {
					alert("danger", `Search failed: ${e}`);
				})
				.finally(() => {
					this.searching = false;
				});
		},

		loadMore() {
			this.page++;
			this.search(false);
		},

		loadMetadata(anime) {
			if (this.metadataCache[anime.id]) {
				anime._meta = this.metadataCache[anime.id];
				return;
			}

			fetch(`${base_url}api/anime/metadata?plugin=${encodeURIComponent(this.pid)}&source_id=${encodeURIComponent(anime.id)}`)
				.then(r => r.json())
				.then(data => {
					if (data.success && data.metadata) {
						anime._meta = data.metadata;
						this.metadataCache[anime.id] = data.metadata;
					}
				})
				.catch(e => console.error("Failed to load metadata:", e));
		},

		selectAnime(anime) {
			this.selectedAnime = anime;
			this.loadingEpisodes = true;
			this.episodes = null;

			fetch(`${base_url}api/anime/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: anime.title,
					source_id: anime.id,
					plugin_id: this.pid,
					cover_url: anime.cover_url || null,
					metadata: anime._meta ? JSON.stringify(anime._meta) : null,
				}),
			})
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					this.animeDbId = data.id;

					return fetch(`${base_url}api/anime/episodes?plugin=${encodeURIComponent(this.pid)}&source_id=${encodeURIComponent(anime.id)}`);
				})
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					this.episodes = data.episodes;

					if (this.animeDbId && this.episodes.length > 0) {
						fetch(`${base_url}api/anime/save_episodes`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								anime_id: this.animeDbId,
								episodes: this.episodes,
							}),
						}).catch(e => console.error("Failed to save episodes:", e));
					}
				})
				.catch(e => {
					alert("danger", `Failed to load episodes: ${e}`);
				})
				.finally(() => {
					this.loadingEpisodes = false;
				});
		},

		watchAnime(episode) {
			if (!this.animeDbId) return;
			window.location.href = `${base_url}anime/watch/${this.animeDbId}`;
		},
	};
};
