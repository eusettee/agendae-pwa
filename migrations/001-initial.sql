CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, patient TEXT NOT NULL, clinic_id TEXT NOT NULL, professional_id TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, created_at BIGINT NOT NULL, UNIQUE (professional_id, date, time));
CREATE INDEX IF NOT EXISTS appointments_user ON appointments(user_id);
CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL);
