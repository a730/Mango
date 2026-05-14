const animePlayerComponent = () => {
	return {
		animeTitle: "",
		animeId: "",
		pluginId: "",
		episodes: [],
		currentEpisodeIndex: 0,
		qualities: [],
		selectedQuality: "",
		loading: true,
		loadingMsg: "Loading player...",
		loadingFailed: false,
		hls: null,

		init(animeId, pluginId, animeTitle) {
			this.animeId = animeId;
			this.pluginId = pluginId;
			this.animeTitle = animeTitle;
			this.loadAnimeInfo(animeId);
		},

		loadAnimeInfo(animeId) {
			fetch(`${base_url}api/anime/progress?anime_id=${encodeURIComponent(animeId)}`)
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					// Load episodes
					return fetch(`${base_url}api/anime/episodes/local?anime_id=${encodeURIComponent(animeId)}`);
				})
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					this.episodes = data.episodes;

					// Load progress to find which episode to start from
					return fetch(`${base_url}api/anime/progress?anime_id=${encodeURIComponent(animeId)}`);
				})
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					const progress = data.progress;

					let startIdx = 0;
					if (progress && progress.episode_id) {
						const idx = this.episodes.findIndex(e => e.id === progress.episode_id);
						if (idx >= 0) startIdx = idx;
					}
					this.currentEpisodeIndex = startIdx;
					this.loadEpisode(startIdx, progress ? progress.timestamp : 0);
				})
				.catch(e => {
					this.loadingMsg = `Failed to load anime: ${e}`;
				});
		},

		loadEpisode(idx, startTime) {
			if (idx < 0 || idx >= this.episodes.length) return;
			const ep = this.episodes[idx];
			this.loading = true;
			this.loadingMsg = "Loading episode...";
			this.loadingFailed = false;

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30000);

			fetch(`${base_url}api/anime/sources?plugin=${encodeURIComponent(this.pluginId)}&episode_id=${encodeURIComponent(ep.id)}`, { signal: controller.signal })
				.then(r => r.json())
				.then(data => {
					clearTimeout(timeout);
					if (!data.success) throw new Error(data.error);
					const sources = data.sources;

					if (sources.length === 0) throw new Error("No stream sources found");

					this.qualities = sources.map(s => s.quality);
					// Pick best quality
					const bestSource = sources.reduce((best, s) => {
						const q = parseInt(s.quality);
						const bestQ = parseInt(best.quality);
						return q > bestQ ? s : best;
					});
					this.selectedQuality = bestSource.quality;
					this.playSource(bestSource, startTime);
				})
				.catch(e => {
					this.loadingMsg = `Failed to get stream: ${e.message}`;
					this.loadingFailed = true;
				});
		},

		playSource(source, startTime) {
			const video = this.$refs.video;
			if (!video) return;

			// Destroy any existing HLS instance
			if (this.hls) {
				this.hls.destroy();
				this.hls = null;
			}

			const proxyUrl = this.buildProxyUrl(source.url, source.headers);

			if (source.format === "hls" || source.url.endsWith(".m3u8")) {
				// Use hls.js
				if (Hls.isSupported()) {
					this.hls = new Hls();
					this.hls.loadSource(proxyUrl);
					this.hls.attachMedia(video);
					this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
						this.loading = false;
						if (startTime > 0) video.currentTime = startTime;
						video.play().catch(() => {});
					});
				} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
					// Native HLS support (Safari)
					video.src = proxyUrl;
					this.loading = false;
					if (startTime > 0) video.currentTime = startTime;
				} else {
					this.loadingMsg = "HLS playback is not supported in this browser";
				}
			} else {
				// Direct URL (MP4, WebM, etc.)
				video.src = proxyUrl;
				this.loading = false;
				if (startTime > 0) video.currentTime = startTime;
				video.play().catch(() => {});
			}

			// Save progress periodically
			this.setupProgressTracking(video);
		},

		buildProxyUrl(url, headers) {
			const encodedUrl = encodeURIComponent(url);
			let params = `url=${encodedUrl}`;
			if (headers) {
				const encodedHeaders = btoa(JSON.stringify(headers));
				params += `&h=${encodedHeaders}`;
			}
			return `${base_url}stream/proxy?${params}`;
		},

		setupProgressTracking(video) {
			let lastSave = 0;
			video.addEventListener("timeupdate", () => {
				const now = Math.floor(video.currentTime);
				if (now - lastSave >= 30) { // Save every 30 seconds
					lastSave = now;
					this.saveProgress(video.currentTime, false);
				}
			});
			video.addEventListener("ended", () => {
				this.saveProgress(0, true);
				// Auto-advance to next episode
				setTimeout(() => this.nextEpisode(), 2000);
			});
		},

		saveProgress(timestamp, completed) {
			const ep = this.episodes[this.currentEpisodeIndex];
			if (!ep) return;

			fetch(`${base_url}api/anime/progress`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					anime_id: this.animeId,
					episode_id: ep.id,
					timestamp: timestamp,
					completed: completed,
				}),
			}).catch(e => console.error("Failed to save progress:", e));
		},

		episodeSelected() {
			const video = this.$refs.video;
			if (video) video.pause();
			this.loadEpisode(parseInt(this.currentEpisodeIndex), 0);
		},

		prevEpisode() {
			if (this.currentEpisodeIndex > 0) {
				const video = this.$refs.video;
				if (video) video.pause();
				this.currentEpisodeIndex--;
				this.loadEpisode(this.currentEpisodeIndex, 0);
			}
		},

		nextEpisode() {
			if (this.currentEpisodeIndex < this.episodes.length - 1) {
				const video = this.$refs.video;
				if (video) video.pause();
				this.currentEpisodeIndex++;
				this.loadEpisode(this.currentEpisodeIndex, 0);
			}
		},

		qualityChanged() {
			if (this.selectedQuality && this.currentEpisodeIndex >= 0) {
				// Re-fetch sources and switch
				const video = this.$refs.video;
				const currentTime = video ? video.currentTime : 0;
				const ep = this.episodes[this.currentEpisodeIndex];

				fetch(`${base_url}api/anime/sources?plugin=${encodeURIComponent(this.pluginId)}&episode_id=${encodeURIComponent(ep.id)}`)
					.then(r => r.json())
					.then(data => {
						if (!data.success) throw new Error(data.error);
						const source = data.sources.find(s => s.quality === this.selectedQuality);
						if (source) this.playSource(source, currentTime);
					})
					.catch(e => console.error("Quality switch failed:", e));
			}
		},
	};
};
