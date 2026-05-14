require "../util/web"

struct MangaRouter
  def initialize
    # Search manga via plugin
    get "/api/manga/search" do |env|
      begin
        pid = env.params.query["plugin"].as(String)
        query = env.params.query["query"].as(String)
        plugin = Plugin.new pid

        results = plugin.search_manga(query)
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

    # List chapters for a manga
    get "/api/manga/chapters" do |env|
      begin
        plugin_id = env.params.query["plugin"].as(String)
        source_id = env.params.query["source_id"].as(String)
        plugin = Plugin.new plugin_id

        chapters = plugin.list_chapters(source_id)
        send_json env, {
          "success"   => true,
          "chapters"  => chapters,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Get page URLs for a chapter
    get "/api/manga/pages" do |env|
      begin
        plugin_id = env.params.query["plugin"].as(String)
        chapter_id = env.params.query["chapter_id"].as(String)
        plugin = Plugin.new plugin_id

        chapter = plugin.select_chapter(chapter_id)
        pages = [] of JSON::Any
        total = chapter["pages"].as_i
        total.times do
          page = plugin.next_page
          break if page.nil? || page.size == 0
          pages << page
        end

        send_json env, {
          "success" => true,
          "pages"   => pages,
        }.to_json
      rescue e
        Logger.error e
        send_json env, {
          "success" => false,
          "error"   => e.message,
        }.to_json
      end
    end

    # Proxy manga page images (avoid CORS)
    get "/api/manga/image_proxy" do |env|
      begin
        url = env.params.query["url"].as(String)

        # Check proxy allowlist if configured
        unless proxy_allows?(url)
          env.response.status_code = 403
          env.response.content_type = "text/plain"
          env.response.print "Proxy domain not allowed"
          next
        end

        Logger.debug "Manga image proxy: #{url}"

        response = HTTP::Client.get url do |resp|
          env.response.status_code = resp.status_code
          resp.headers.each do |k, v|
            env.response.headers[k] = v
          end
          IO.copy resp.body_io, env.response
        end
      rescue e
        Logger.error e
        env.response.status_code = 502
        env.response.content_type = "text/plain"
        env.response.print "Proxy error: #{e.message}"
      end
    end

    # Frontend route: manga browse page
    get "/manga" do |env|
      begin
        base_url = Config.current.base_url
        layout "manga-browse"
      rescue e
        Logger.error e
        env.response.status_code = 500
      end
    end

    # Frontend route: manga reader
    get "/manga/read" do |env|
      begin
        base_url = Config.current.base_url
        plugin_id = env.params.query["plugin"]?.try &.as(String) || ""
        chapter_id = env.params.query["chapter_id"]?.try &.as(String) || ""
        manga_title = env.params.query["title"]?.try &.as(String) || ""
        render "src/views/manga-reader.html.ecr"
      rescue e
        Logger.error e
        env.response.status_code = 500
      end
    end
  end
end
