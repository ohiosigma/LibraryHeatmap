CREATE TABLE presence (session TEXT PRIMARY KEY, building TEXT NOT NULL, area TEXT NOT NULL DEFAULT '', mode TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE INDEX presence_updated ON presence(updated);
CREATE TABLE reports (session TEXT NOT NULL, building TEXT NOT NULL, area TEXT NOT NULL, status TEXT NOT NULL, noise TEXT NOT NULL DEFAULT '', updated INTEGER NOT NULL, PRIMARY KEY(session,building,area));
CREATE INDEX reports_updated ON reports(updated);
