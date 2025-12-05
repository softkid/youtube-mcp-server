DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Channels;
DROP TABLE IF EXISTS Videos;
DROP TABLE IF EXISTS BrandingPackages;

-- 사용자 정보 테이블
CREATE TABLE Users (
  id TEXT PRIMARY KEY, -- Google ID (sub)
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_login_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 채널 정보 테이블
CREATE TABLE Channels (
  id TEXT PRIMARY KEY, -- Channel ID (UC...)
  user_id TEXT, -- Owner ID (Users.id)
  handle TEXT, -- @handle
  title TEXT,
  description TEXT,
  thumbnail TEXT,
  subscriber_count INTEGER,
  video_count INTEGER,
  view_count INTEGER,
  country TEXT,
  custom_url TEXT,
  published_at TEXT,
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES Users(id)
);

-- 비디오 정보 테이블
CREATE TABLE Videos (
  id TEXT PRIMARY KEY, -- Video ID
  channel_id TEXT, -- Channel ID (Channels.id)
  title TEXT,
  description TEXT,
  thumbnail TEXT,
  published_at TEXT,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  duration TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (channel_id) REFERENCES Channels(id)
);

-- 브랜딩 패키지 테이블
CREATE TABLE BrandingPackages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  channel_id TEXT,
  topic TEXT,
  channel_name_ideas TEXT, -- JSON string
  short_description TEXT,
  long_description TEXT,
  tags TEXT, -- JSON string
  profile_picture_url TEXT,
  banner_url TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES Users(id),
  FOREIGN KEY (channel_id) REFERENCES Channels(id)
);

-- 인덱스 생성
CREATE INDEX idx_channels_user_id ON Channels(user_id);
CREATE INDEX idx_channels_handle ON Channels(handle);
CREATE INDEX idx_videos_channel_id ON Videos(channel_id);
CREATE INDEX idx_branding_user_id ON BrandingPackages(user_id);
