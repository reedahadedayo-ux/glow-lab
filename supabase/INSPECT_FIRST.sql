-- Read-only audit. Run in the EXISTING project before considering the proposed contract.
-- Do not paste customer rows or credentials into chat. Record schema and aggregate counts only.
select table_schema,table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema not in ('pg_catalog','information_schema')
order by table_schema,table_name,ordinal_position;
select n.nspname as schema,c.relname as table,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname in ('public','glowlab');
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies;
select tc.table_schema,tc.table_name,tc.constraint_name,tc.constraint_type,kcu.column_name,
ccu.table_schema as foreign_schema,ccu.table_name as foreign_table,ccu.column_name as foreign_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu using(constraint_name,table_schema)
left join information_schema.constraint_column_usage ccu using(constraint_name,table_schema)
where tc.table_schema in ('public','glowlab');
select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','glowlab');
select n.nspname,p.proname,p.prosecdef as security_definer,pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','glowlab');
select id,name,public from storage.buckets;
-- Inspect Edge Functions in the existing project's Functions panel/CLI and integration settings.
-- Existing project ref required: supabase functions list --project-ref <existing-ref>
-- Inventory existing tables and aggregate counts for products/customers/orders/routines/tickets.
-- Inventory webhook/integration destinations without exporting secrets.
