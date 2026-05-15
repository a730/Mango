const animePlayerComponent = () => {
	return {
		animeTitle: "",
		animeId: "",
		pluginId: "",
		episodes: [],
		currentEpisodeIndex: 0,
		qualities: [],
		selectedQuality: "",
		subtitles: [],
		selectedSubtitle: "none",
		loading: true,
		loadingMsg: "Loading player...",
		loadingFailed: false,
		hls: null,
		hlsErrorCount: 0,
		maxHlsErrors: 5,
		isPiP: false,
		isFullscreen: false,
		isMuted: false,
		volume: 1.0,
		playbackRate: 1.0,
		downloading: false,
		showControls: true,
		controlsTimeout: null,
		episodeProgress: {},

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
					return fetch(`${base_url}api/anime/episodes/local?anime_id=${encodeURIComponent(animeId)}`);
				})
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					this.episodes = data.episodes;
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
			this.hlsErrorCount = 0;
			this.subtitles = [];
			this.selectedSubtitle = "none";

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
					const bestSource = sources.reduce((best, s) => {
						const q = parseInt(s.quality);
						const bestQ = parseInt(best.quality);
						return q > bestQ ? s : best;
					});
					this.selectedQuality = bestSource.quality;

					if (data.subtitles && data.subtitles.length > 0) {
						this.subtitles = data.subtitles;
					}

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

			if (this.hls) {
				this.hls.destroy();
				this.hls = null;
			}

			const proxyUrl = this.buildProxyUrl(source.url, source.headers);

			if (source.format === "hls" || source.url.endsWith(".m3u8")) {
				if (Hls.isSupported()) {
					this.hls = new Hls({
						maxBufferLength: 30,
						maxMaxBufferLength: 60,
						startLevel: -1,
						capLevelToPlayerSize: true,
						debug: false,
					});

					this.hls.loadSource(proxyUrl);
					this.hls.attachMedia(video);

					this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
						this.loading = false;
						if (startTime > 0) video.currentTime = startTime;
						video.play().catch(() => {});
					});

					this.hls.on(Hls.Events.ERROR, (event, data) => {
						this.hlsErrorCount++;
						console.warn(`HLS error (${this.hlsErrorCount}/${this.maxHlsErrors}):`, data.type, data.details);

						if (data.fatal) {
							switch (data.type) {
								case Hls.ErrorTypes.NETWORK_ERROR:
									if (this.hlsErrorCount < this.maxHlsErrors) {
										console.log("Recovering from network error...");
										this.hls.startLoad();
									} else {
										this.handlePlaybackError("Network error - stream unavailable");
									}
									break;
								case Hls.ErrorTypes.MEDIA_ERROR:
									if (this.hlsErrorCount < this.maxHlsErrors) {
										console.log("Recovering from media error...");
										this.hls.recoverMediaError();
									} else {
										this.handlePlaybackError("Media error - try reloading the page");
									}
									break;
								default:
									this.handlePlaybackError(`Fatal error: ${data.details}`);
									break;
							}
						}
					});

					this.hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
						console.log("Quality level switched to:", data.level);
					});
				} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
					video.src = proxyUrl;
					this.loading = false;
					if (startTime > 0) video.currentTime = startTime;
				} else {
					this.loadingMsg = "HLS playback is not supported in this browser";
				}
			} else {
				video.src = proxyUrl;
				this.loading = false;
				if (startTime > 0) video.currentTime = startTime;
				video.play().catch(() => {});
			}

			this.setupProgressTracking(video);
			this.setupVideoEvents(video);
			this.setupKeyboardShortcuts(video);
		},

		handlePlaybackError(message) {
			this.loading = false;
			this.loadingFailed = true;
			this.loadingMsg = message;
			if (this.hls) {
				this.hls.destroy();
				this.hls = null;
			}
		},

		retryPlayback() {
			this.loadingFailed = false;
			this.hlsErrorCount = 0;
			const ep = this.episodes[this.currentEpisodeIndex];
			if (ep) {
				const video = this.$refs.video;
				const currentTime = video ? video.currentTime : 0;
				this.loadEpisode(this.currentEpisodeIndex, currentTime);
			}
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
				if (now - lastSave >= 15) {
					lastSave = now;
					this.saveProgress(video.currentTime, false);
				}
			});
			video.addEventListener("ended", () => {
				this.saveProgress(0, true);
				setTimeout(() => this.nextEpisode(), 2000);
			});
		},

		setupVideoEvents(video) {
			video.addEventListener("volumechange", () => {
				this.volume = video.volume;
				this.isMuted = video.muted;
			});

			video.addEventListener("ratechange", () => {
				this.playbackRate = video.playbackRate;
			});

			video.addEventListener("enterpictureinpicture", () => {
				this.isPiP = true;
			});

			video.addEventListener("leavepictureinpicture", () => {
				this.isPiP = false;
			});

			document.addEventListener("fullscreenchange", () => {
				this.isFullscreen = !!document.fullscreenElement;
			});
		},

		setupKeyboardShortcuts(video) {
			const handler = (e) => {
				if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;

				switch (e.key) {
					case " ":
					case "k":
						e.preventDefault();
						this.togglePlay();
						break;
					case "ArrowLeft":
					case "j":
						e.preventDefault();
						this.seek(-10);
						break;
					case "ArrowRight":
					case "l":
						e.preventDefault();
						this.seek(10);
						break;
					case "ArrowUp":
						e.preventDefault();
						video.volume = Math.min(1, video.volume + 0.1);
						break;
					case "ArrowDown":
						e.preventDefault();
						video.volume = Math.max(0, video.volume - 0.1);
						break;
					case "f":
						e.preventDefault();
						this.toggleFullscreen();
						break;
					case "m":
						e.preventDefault();
						this.toggleMute();
						break;
					case "p":
						e.preventDefault();
						this.togglePiP();
						break;
					case "s":
						e.preventDefault();
						this.cycleSubtitle();
						break;
					case ">":
					case ".":
						e.preventDefault();
						this.changePlaybackRate();
						break;
					case "Escape":
						if (document.pictureInPictureElement) {
							document.exitPictureInPicture();
						}
						break;
				}
			};
			document.addEventListener("keydown", handler);
			this._keyboardHandler = handler;
		},

		saveProgress(timestamp, completed) {
			const ep = this.episodes[this.currentEpisodeIndex];
			if (!ep) return;

			this.episodeProgress[ep.id] = timestamp;

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

		loadSubtitles() {
			const video = this.$refs.video;
			if (!video) return;

			document.querySelectorAll("#anime-video track").forEach(t => t.remove());

			if (this.selectedSubtitle === "none") return;

			const idx = parseInt(this.selectedSubtitle);
			const sub = this.subtitles[idx];
			if (!sub) return;

			const proxyUrl = this.buildProxyUrl(sub.file, {});

			const track = document.createElement("track");
			track.kind = "captions";
			track.label = sub.label || "Subtitles";
			track.srclang = sub.lang || "en";
			track.src = proxyUrl;
			track.mode = "showing";
			track.default = true;
			video.appendChild(track);
		},

		cycleSubtitle() {
			if (this.subtitles.length === 0) return;

			const tracks = ["none", ...this.subtitles.map((_, i) => i.toString())];
			const currentIdx = tracks.indexOf(this.selectedSubtitle);
			const nextIdx = (currentIdx + 1) % tracks.length;
			this.selectedSubtitle = tracks[nextIdx];
			this.loadSubtitles();
		},

		togglePiP() {
			const video = this.$refs.video;
			if (!video) return;

			if (document.pictureInPictureElement) {
				document.exitPictureInPicture();
			} else if (document.pictureInPictureEnabled) {
				video.requestPictureInPicture().catch(e => console.error("PiP failed:", e));
			}
		},

		toggleFullscreen() {
			const container = this.$refs.playerContainer;
			if (!container) return;

			if (!document.fullscreenElement) {
				container.requestFullscreen().catch(e => console.error("Fullscreen failed:", e));
			} else {
				document.exitFullscreen();
			}
		},

		toggleMute() {
			const video = this.$refs.video;
			if (!video) return;
			video.muted = !video.muted;
		},

		seek(seconds) {
			const video = this.$refs.video;
			if (!video) return;
			video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
		},

		togglePlay() {
			const video = this.$refs.video;
			if (!video) return;
			if (video.paused) {
				video.play().catch(() => {});
			} else {
				video.pause();
			}
		},

		changePlaybackRate() {
			const video = this.$refs.video;
			if (!video) return;
			const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
			const currentIdx = rates.indexOf(video.playbackRate);
			const nextIdx = (currentIdx + 1) % rates.length;
			video.playbackRate = rates[nextIdx];
			this.playbackRate = rates[nextIdx];
		},

		showControlsTemporarily() {
			this.showControls = true;
			if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
			this.controlsTimeout = setTimeout(() => {
				const video = this.$refs.video;
				if (video && !video.paused) {
					this.showControls = false;
				}
			}, 3000);
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

		subtitleChanged() {
			this.loadSubtitles();
		},

		downloadEpisode() {
			const ep = this.episodes[this.currentEpisodeIndex];
			if (!ep) return;

			this.downloading = true;
			fetch(`${base_url}api/anime/sources?plugin=${encodeURIComponent(this.pluginId)}&episode_id=${encodeURIComponent(ep.id)}`)
				.then(r => r.json())
				.then(data => {
					if (!data.success) throw new Error(data.error);
					const sources = data.sources;
					if (sources.length === 0) throw new Error("No sources found");

					const bestSource = sources.reduce((best, s) => {
						const q = parseInt(s.quality);
						const bestQ = parseInt(best.quality);
						return q > bestQ ? s : best;
					});

					const proxyUrl = this.buildProxyUrl(bestSource.url, bestSource.headers);
					const a = document.createElement("a");
					a.href = proxyUrl;
					a.download = `${this.animeTitle} - Ep ${ep.episode_number}${ep.title ? ' - ' + ep.title : ''}.mp4`;
					a.target = "_blank";
					a.rel = "noopener noreferrer";
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				})
				.catch(e => {
					console.error("Download failed:", e);
					alert("Download failed: " + e.message);
				})
				.finally(() => {
					this.downloading = false;
				});
		},
	};
};
