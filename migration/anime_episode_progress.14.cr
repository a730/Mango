class AnimeEpisodeProgressTable < MG::Base
  def up : String
    <<-SQL
    CREATE TABLE IF NOT EXISTS anime_episode_progress (
      username TEXT NOT NULL,
      anime_id TEXT NOT NULL,
      episode_id TEXT NOT NULL,
      timestamp_position REAL DEFAULT 0.0,
      completed INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (username, anime_id, episode_id),
      FOREIGN KEY (anime_id) REFERENCES anime (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS anime_ep_prog_anime_idx ON anime_episode_progress (anime_id);
    CREATE INDEX IF NOT EXISTS anime_ep_prog_user_idx ON anime_episode_progress (username, updated_at DESC);
    SQL
  end

  def down : String
    <<-SQL
    DROP TABLE IF EXISTS anime_episode_progress;
    SQL
  end
end
