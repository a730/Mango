require "uuid"
require "base64"
require "../util/stream_proxy"

struct StreamRouter
  def initialize
    # Search anime via plugin
    get "/api/anime/search" do |env|
      begin
        pid = env.params.query["plugin"].as(String)
        query = env.params.query["query"].as(String)
        plugin = Plugin.new pid

        results = plugin.search_anime(query)
        send_json env, {
          "success" => true,
          "results" => results,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # List episodes for an anime
    get "/api/anime/episodes" do |env|
      begin
        plugin_id = env.params.query["plugin"].as(String)
        source_id = env.params.query["source_id"].as(String)
        plugin = Plugin.new plugin_id

        episodes = plugin.list_episodes(source_id)
        send_json env, {
          "success"  => true,
          "episodes" => episodes,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Get stream sources for an episode
    get "/api/anime/sources" do |env|
      begin
        plugin_id = env.params.query["plugin"].as(String)
        episode_id = env.params.query["episode_id"].as(String)
        plugin = Plugin.new plugin_id

        sources = plugin.get_stream_sources(episode_id)
        subtitles = plugin.get_subtitles(episode_id)

        send_json env, {
          "success"   => true,
          "sources"   => sources,
          "subtitles" => subtitles,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Save anime to local library
    post "/api/anime/save" do |env|
      begin
        username = get_username env
        id = UUID.random.to_s
        title = env.params.json["title"].as(String)
        source_id = env.params.json["source_id"].as(String)
        plugin_id = env.params.json["plugin_id"].as(String)
        cover_url = env.params.json["cover_url"]?.try &.as(String)
        metadata_raw = env.params.json["metadata"]?
        metadata = metadata_raw.is_a?(String) ? metadata_raw : metadata_raw.try(&.to_json)

        # Check if already saved
        existing = Storage.default.find_anime_by_source source_id, plugin_id
        if existing
          send_json env, {
            "success" => true,
            "id"      => existing,
          }.to_json
          next
        end

        Storage.default.save_anime id, title, source_id, plugin_id, cover_url, metadata
        send_json env, {
          "success" => true,
          "id"      => id,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Save episodes to local library
    post "/api/anime/save_episodes" do |env|
      begin
        anime_id = env.params.json["anime_id"].as(String)
        episodes = env.params.json["episodes"].as(Array(JSON::Any))

        episodes.each do |ep|
          ep_id = ep["id"].as_s
          ep_num = ep["number"]?.try(&.as_i) || 0
          ep_title = ep["title"]?.try(&.as_s)
          ep_thumb = ep["thumbnail"]?.try(&.as_s)
          ep_meta = ep.to_json

          Storage.default.save_anime_episode ep_id, anime_id, ep_num, ep_title, ep_meta, ep_thumb
        end

        send_json env, {
          "success" => true,
          "count"   => episodes.size,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # List locally saved anime
    get "/api/anime/list" do |env|
      begin
        anime_list = Storage.default.list_anime
        send_json env, {
          "success" => true,
          "anime"   => anime_list,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Get locally saved episodes for an anime
    get "/api/anime/episodes/local" do |env|
      begin
        anime_id = env.params.query["anime_id"].as(String)
        episodes = Storage.default.list_anime_episodes anime_id
        send_json env, {
          "success"  => true,
          "episodes" => episodes,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Save/update watching progress
    put "/api/anime/progress" do |env|
      begin
        username = get_username env
        anime_id = env.params.json["anime_id"].as(String)
        episode_id = env.params.json["episode_id"]?.try &.as(String)
        timestamp_raw = env.params.json["timestamp"]?
        timestamp = timestamp_raw.is_a?(Float64) ? timestamp_raw : (timestamp_raw.is_a?(Int64) ? timestamp_raw.to_f : 0.0)
        completed = env.params.json["completed"]?.try(&.as(Bool)) || false

        Storage.default.save_anime_progress username, anime_id, episode_id, timestamp

        if completed
          Storage.default.mark_anime_completed username, anime_id
        end

        send_json env, {
          "success" => true,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Get watching progress for an anime
    get "/api/anime/progress" do |env|
      begin
        username = get_username env
        anime_id = env.params.query["anime_id"].as(String)

        progress = Storage.default.get_anime_progress username, anime_id
        send_json env, {
          "success"  => true,
          "progress" => progress,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Continue watching list
    get "/api/anime/continue_watching" do |env|
      begin
        username = get_username env
        items = Storage.default.list_continue_watching_anime username

        # Enrich with anime metadata
        enriched = items.map do |item|
          anime = Storage.default.get_anime item[:anime_id]
          {progress: item, anime: anime}
        end

        send_json env, {
          "success" => true,
          "items"   => enriched,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # ---- Streaming Proxy ----

    # Proxy endpoint for streaming media
    get "/stream/proxy" do |env|
      begin
        url = env.params.query["url"].as(String)

        # Check proxy allowlist if configured
        unless proxy_allows?(url)
          env.response.status_code = 403
          env.response.content_type = "text/plain"
          env.response.print "Proxy domain not allowed"
          next
        end
        headers_encoded = env.params.query["h"]?
        headers = if headers_encoded
                    StreamProxy.decode_headers headers_encoded
                  else
                    HTTP::Headers.new
                  end

        # Set a reasonable user-agent if none provided
        unless headers.has_key?("User-Agent")
          headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        end

        # Check if this is an HLS playlist
        if url.ends_with?(".m3u8")
          StreamProxy.fetch_hls_playlist url, headers, env.response
        else
          StreamProxy.fetch_stream url, headers, env.response
        end
      rescue e
        Logger.error e
        env.response.status_code = 502
        env.response.content_type = "text/plain"
        env.response.print "Proxy error: #{e.message}"
      end
    end

    # OPTIONS handler for CORS preflight
    options "/stream/proxy" do |env|
      env.response.headers["Access-Control-Allow-Origin"] = "*"
      env.response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
      env.response.headers["Access-Control-Allow-Headers"] = "*"
      halt env
    end

    # ---- Frontend Routes ----

    get "/anime" do |env|
      begin
        username = get_username env
        continue_watching = Storage.default.list_continue_watching_anime username
        layout "anime-home"
      rescue e
        Logger.error e
        env.response.status_code = 500
      end
    end

    get "/anime/browse" do |env|
      begin
        layout "anime-browse"
      rescue e
        Logger.error e
        env.response.status_code = 500
      end
    end

    get "/anime/watch/:anime_id" do |env|
      begin
        base_url = Config.current.base_url
        username = get_username env
        anime_id = env.params.url["anime_id"]
        anime = Storage.default.get_anime anime_id
        raise "Anime not found" if anime.nil?
        plugin_id = anime[:plugin_id]
        anime_title = anime[:title]

        episodes = Storage.default.list_anime_episodes anime_id
        progress = Storage.default.get_anime_progress username, anime_id

        render "src/views/anime-player.html.ecr"
      rescue e
        Logger.error e
        env.response.status_code = 404
      end
    end
  end
end
