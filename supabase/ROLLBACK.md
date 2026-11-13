# Safe rollback (no automatic data deletion)

The migration is proposed and unapplied. Inspect and back up the existing project first.
If adopted, roll back the application to Git tag `rollback/pre-customer-upgrade-9857747`
using `git restore --source <tag> -- <paths>` on the current branch (never switch branches).
Disable the customer API deployment and revoke service-role execute permissions on the two
customer functions if needed. Do not drop a schema with orders or tickets. Archive/export
any newly collected demo data under the project's privacy process before a DBA considers
removing an unused isolated schema. No destructive down migration is supplied deliberately.
