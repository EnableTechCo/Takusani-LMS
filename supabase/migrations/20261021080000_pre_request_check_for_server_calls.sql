-- Fix to S3-08: server calls with the secret key were refused by the pre-request check.
--
-- PostgREST runs api.check_request() before every request, as the request's role. S3-08 granted it to anon and
-- authenticated but not to service_role, so every call made with the secret key failed with "permission denied for
-- function check_request": the sign-in lockout counting (which then let sign-in through uncounted, logging the
-- error), the notification outbox worker and its health check. Staging was not affected in practice, as its app has
-- no secret key yet and email is off. The check does nothing for a caller who is not a signed-in user.

grant execute on function api.check_request() to service_role;
