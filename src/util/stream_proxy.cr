require "base64"
require "uri"

class StreamProxy

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
    # Set CORS headers
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

      # Forward content type
      if content_type = res.headers["Content-Type"]?
        response.content_type = content_type
      end

      # Stream the response body
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
    # Set CORS headers
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

      # Determine the base URL for resolving relative paths
      base_url = url
      # Remove the filename from the URL to get the directory
      last_slash = base_url.rindex '/'
      base_dir = last_slash ? base_url[0..last_slash] : base_url

      # Encode headers for the proxied URLs
      headers_json = headers.to_json
      headers_b64 = Base64.strict_encode headers_json

      rewritten = lines.map do |line|
        line = line.strip
        # Skip comments, tags, and empty lines
        if line.starts_with?('#') || line.empty?
          next line
        end

        # Resolve relative URLs
        resolved_url = if line.starts_with?("http://") || line.starts_with?("https://")
                         line
                       elsif line.starts_with?('/')
                         # Absolute path relative to domain
                         "#{uri.scheme}://#{uri.host}#{line}"
                       else
                         # Relative path
                         "#{base_dir}#{line}"
                       end

        # Encode the resolved URL
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
