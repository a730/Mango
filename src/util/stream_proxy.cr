require "base64"
require "uri"

class StreamProxy

  @@segment_cache = {} of String => {body: String, headers: HTTP::Headers, expires: Int64}
  @@cache_mutex = Mutex.new
  @@max_cache_entries = 500
  @@cache_ttl_seconds = 300

  # Fetches a URL with custom headers and returns the response
  def self.fetch(url : String, headers : HTTP::Headers, &block : HTTP::Client::Response ->)
    uri = URI.parse url
    HTTP::Client.get uri, headers do |res|
      yield res
    end
  rescue e
    Logger.error "Stream proxy fetch error: #{e.message}"
    raise e
  end

  # Fetches a URL and streams the body
  def self.fetch_stream(url : String, headers : HTTP::Headers, response : HTTP::Server::Response)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"

    uri = URI.parse url

    HTTP::Client.get uri, headers do |res|
      unless res.success?
        response.status_code = res.status_code
        response.content_type = "text/plain"
        response.print "Proxy error: #{res.status_code}"
        return
      end

      if content_type = res.headers["Content-Type"]?
        response.content_type = content_type
      end

      IO.copy res.body_io, response
    end
  rescue e
    Logger.error "Stream proxy error: #{e.message}"
    response.status_code = 502
    response.content_type = "text/plain"
    response.print "Proxy error: #{e.message}"
  end

  # Fetches an HLS playlist (.m3u8) and rewrites all URLs to go through the proxy
  def self.fetch_hls_playlist(url : String, headers : HTTP::Headers, response : HTTP::Server::Response,
                              base_proxy_url : String = "/stream/proxy")
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"

    uri = URI.parse url

    HTTP::Client.get uri, headers do |res|
      unless res.success?
        response.status_code = res.status_code
        response.content_type = "text/plain"
        response.print "Proxy error: #{res.status_code}"
        return
      end

      response.content_type = "application/vnd.apple.mpegurl"

      body = res.body
      lines = body.lines

      base_url = url
      last_slash = base_url.rindex '/'
      base_dir = last_slash ? base_url[0..last_slash] : base_url

      headers_json = headers.to_json
      headers_b64 = Base64.strict_encode headers_json

      rewritten = lines.map do |line|
        line = line.strip
        if line.starts_with?('#') || line.empty?
          next line
        end

        resolved_url = if line.starts_with?("http://") || line.starts_with?("https://")
                         line
                       elsif line.starts_with?('/')
                         "#{uri.scheme}://#{uri.host}#{line}"
                       else
                         "#{base_dir}#{line}"
                       end

        encoded_url = URI.encode_path resolved_url
        "#{base_proxy_url}?url=#{encoded_url}&h=#{headers_b64}"
      end

      response.print rewritten.join("\n")
    end
  rescue e
    Logger.error "HLS proxy error: #{e.message}"
    response.status_code = 502
    response.content_type = "text/plain"
    response.print "HLS proxy error: #{e.message}"
  end

  # Fetches an HLS segment with caching support
  def self.fetch_hls_segment(url : String, headers : HTTP::Headers, response : HTTP::Server::Response)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"

    cache_key = "#{url}|#{headers.to_json}"
    now = Time.utc.to_unix

    cached_entry = nil
    @@cache_mutex.synchronize do
      if entry = @@segment_cache[cache_key]?
        if entry[:expires] > now
          cached_entry = entry
        else
          @@segment_cache.delete(cache_key)
        end
      end
    end

    if cached_entry
      response.content_type = cached_entry[:headers]["Content-Type"]? || "video/MP2T"
      response.print cached_entry[:body]
      return
    end

    HTTP::Client.get url, headers do |res|
      unless res.success?
        response.status_code = res.status_code
        response.content_type = "text/plain"
        response.print "Proxy error: #{res.status_code}"
        return
      end

      if content_type = res.headers["Content-Type"]?
        response.content_type = content_type
      end

      body_content = res.body_io.gets_to_end
      response.print body_content

      if content_type && (content_type.includes?("video") || content_type.includes?("octet-stream"))
        @@cache_mutex.synchronize do
          if @@segment_cache.size >= @@max_cache_entries
            oldest_key = @@segment_cache.keys.min_by { |k| @@segment_cache[k][:expires] }
            @@segment_cache.delete(oldest_key)
          end
          @@segment_cache[cache_key] = {
            body: body_content,
            headers: res.headers,
            expires: now + @@cache_ttl_seconds,
          }
        end
      end
    end
  rescue e
    Logger.error "HLS segment proxy error: #{e.message}"
    response.status_code = 502
    response.content_type = "text/plain"
    response.print "Segment proxy error: #{e.message}"
  end

  # Clear the segment cache
  def self.clear_cache
    @@cache_mutex.synchronize do
      @@segment_cache.clear
    end
  end

  # Get cache size
  def self.cache_size : Int32
    @@cache_mutex.synchronize do
      @@segment_cache.size
    end
  end

  # Decode headers from base64-encoded JSON string
  def self.decode_headers(encoded : String) : HTTP::Headers
    headers = HTTP::Headers.new
    begin
      json = JSON.parse Base64.decode_string(encoded)
      json.as_h.each do |k, v|
        headers.add k, v.as_s
      end
  rescue e
    Logger.warn "Failed to decode proxy headers: #{e.message}"
    end
    headers
  end
end
