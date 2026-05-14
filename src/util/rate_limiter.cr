class RateLimiter
  @attempts : Hash(String, Array(Int64))

  def initialize(@max_attempts : Int32 = 10, @window_seconds : Int32 = 60)
    @attempts = Hash(String, Array(Int64)).new
  end

  def allowed?(key : String) : Bool
    now = Time.utc.to_unix
    window_start = now - @window_seconds

    if @attempts.has_key?(key)
      @attempts[key].reject! { |t| t < window_start }
    else
      @attempts[key] = [] of Int64
    end

    if @attempts[key].size >= @max_attempts
      false
    else
      @attempts[key] << now
      true
    end
  end

  def remaining(key : String) : Int32
    now = Time.utc.to_unix
    window_start = now - @window_seconds
    if @attempts.has_key?(key)
      @attempts[key].reject! { |t| t < window_start }
      @max_attempts - @attempts[key].size
    else
      @max_attempts
    end
  end

  def reset(key : String) : Void
    @attempts.delete(key)
  end
end
