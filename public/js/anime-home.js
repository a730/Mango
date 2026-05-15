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
					this.continueWatching = items.map(item => {
						const epInfo = item.progress.episode_number ? {
							number: item.progress.episode_number,
							title: item.progress.episode_title,
						} : null;
						return {
							anime_id: item.progress.anime_id,
							title: item.anime ? item.anime.title : "Unknown",
							cover_url: item.anime ? item.anime.cover_url : null,
							completed: item.progress.completed,
							progress_pct: item.progress.progress_pct || 0,
							episode_info: epInfo,
						};
					});
				})
				.catch(e => console.error("Failed to load continue watching:", e));
		},
	};
};
