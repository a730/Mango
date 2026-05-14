const animeHomeComponent = () => {
	return {
		savedAnime: [],
		continueWatching: [],

		init() {
			this.loadSaved();
			this.loadContinueWatching();
		},

		loadSaved() {
			fetch(`${base_url}api/anime/list`)
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					this.savedAnime = data.anime || [];
				})
				.catch(e => console.error("Failed to load saved anime:", e));
		},

		loadContinueWatching() {
			fetch(`${base_url}api/anime/continue_watching`)
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					const items = data.items || [];
					this.continueWatching = items.map(item => ({
						anime_id: item.progress.anime_id,
						title: item.anime ? item.anime.title : "Unknown",
						cover_url: item.anime ? item.anime.cover_url : null,
						completed: item.progress.completed,
					}));
				})
				.catch(e => console.error("Failed to load continue watching:", e));
		},
	};
};
