class AnimeTables < MG::Base
  def up : String
    <<-SQL
    CREATE TABLE IF NOT EXISTS anime (
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      source_id TEXT NOT NULL,
      plugin_id TEXT NOT NULL,
      cover_url TEXT,
      metadata TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS anime_id_idx ON anime (id);
    CREATE UNIQUE INDEX IF NOT EXISTS anime_source_idx ON anime (source_id, plugin_id);

    CREATE TABLE IF NOT EXISTS anime_episodes (
      id TEXT NOT NULL,
      anime_id TEXT NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT,
      metadata TEXT,
      thumbnail TEXT,
      FOREIGN KEY (anime_id) REFERENCES anime (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS anime_ep_id_idx ON anime_episodes (id);
    CREATE INDEX IF NOT EXISTS anime_ep_anime_idx ON anime_episodes (anime_id, episode_number);

    CREATE TABLE IF NOT EXISTS anime_progress (
      username TEXT NOT NULL,
      anime_id TEXT NOT NULL,
      episode_id TEXT,
      timestamp_position REAL DEFAULT 0.0,
      completed INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (anime_id) REFERENCES anime (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS anime_prog_idx ON anime_progress (username, anime_id);
    SQL
  end

  def down : String
    <<-SQL
    DROP TABLE IF EXISTS anime_progress;
    DROP TABLE IF EXISTS anime_episodes;
    DROP TABLE IF EXISTS anime;
    SQL
  end
end
