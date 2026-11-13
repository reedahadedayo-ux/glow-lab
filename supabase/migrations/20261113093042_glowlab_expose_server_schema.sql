-- Already applied remotely as 20261113093042_glowlab_expose_server_schema.
-- Schema visibility does NOT grant anon/authenticated usage, table access or function execution.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,graphql_public,glowlab';
NOTIFY pgrst, 'reload config';
