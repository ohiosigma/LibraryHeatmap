CREATE TABLE study_groups (id TEXT PRIMARY KEY, location TEXT NOT NULL, topic TEXT NOT NULL, course TEXT NOT NULL, test TEXT NOT NULL DEFAULT '', size INTEGER NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, host TEXT NOT NULL DEFAULT 'Student', contact TEXT NOT NULL DEFAULT '', joined INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, session TEXT NOT NULL);
CREATE INDEX study_groups_location_date ON study_groups(location, date, time);
CREATE INDEX study_groups_date ON study_groups(date);
