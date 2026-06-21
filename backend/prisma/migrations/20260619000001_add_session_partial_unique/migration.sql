-- セッションが同時に複数 open になる競合を防ぐ partial unique index
CREATE UNIQUE INDEX "unique_open_session" ON "Session" (status) WHERE status = 'open';
