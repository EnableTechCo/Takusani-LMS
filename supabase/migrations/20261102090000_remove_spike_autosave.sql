-- Removing spike X-3 (20261101090000). The exam work, and with it the autosave latency measurement, is set aside for
-- now (product owner, 29 Sep 2026), so the throwaway route, functions and tables do not stay on staging unused. The
-- measured path and the load script remain in the history of pull request #71 for when exams are taken up again.

drop function api.spike_cleanup();
drop function api.spike_autosave(uuid, uuid, jsonb);
drop function api.spike_prepare(integer, integer);
drop function spike.is_test_account();
drop table spike.answers;
drop table spike.attempts;
drop schema spike;
