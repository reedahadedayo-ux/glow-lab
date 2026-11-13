# Make order acknowledgement — sanitised import template

[Workflow review](../../docs/workflows.md) · [Release audit](../../docs/release-audit.md)

The owner supplied the actual **GlowLab - Order Acknowledgement v1** blueprint and reported a successful order-email test. That is owner-provided functional evidence. This folder preserves a sanitised version of the supplied module structure, not a newly executed Make run.

## Included file and safety changes

`order-acknowledgement.sanitized.blueprint.json` is valid JSON with the original connected module IDs, mappings, filters, error handlers and scenario settings. It is intended for Make's **Import Blueprint** facility, but import acceptance has not been tested in Make.

Sanitisation deliberately removes:

- The existing webhook ID and Gmail connection ID: create/rebind your own.
- All values in module 2 (`supabase_url`, `service_key`): blank, not working credentials.
- Literal URLs and email addresses: reserved `example.invalid` replacements.
- Account labels, captured schemas/restore metadata, validation caches and disconnected designer orphan modules. Orphans did not participate in the connected flow.

The original upload embeds a privileged Supabase credential and is **not included**. Keep it private; rotate/rebind that credential through an approved process before publication. Do not paste it into a public issue or commit. The public template must remain blank even after private setup.

## Import and private configuration

1. Import into a new **inactive staging scenario**. Do not replace the working scenario.
2. Create a new webhook and bind Gmail privately. Do not publish the resulting webhook endpoint or connection details.
3. Re-enter the authorised project endpoint and a privately managed, preferably least-privilege integration credential. The template mirrors v1's variable design, not a recommendation to distribute service-role keys in exports.
4. Replace reserved email-template links with the actual public site URLs.
5. Reconcile the expected `claim_order_notification` RPC and `order_notifications` table with the intended project/schema. These were **not found in the audited live project**. Do not apply an invented migration to bypass that discrepancy.
6. Review all HTTP schema headers, response parsing, `item_name` vs `product_name`, empty item results, email-send failure handling and truthful simulated-payment text. See the module-by-module review.
7. Review captured execution-data privacy (`confidential=false` in the supplied settings), retention and access before sending any personal data.
8. With explicit permission, use fictional data and a controlled test inbox. No test email was sent by this preparation.

The v1 mappings are preserved as evidence, including unresolved discrepancies; this is **not** advertised as a drop-in verified deployment for a fresh database. No production trigger, scenario or database was modified.

## Reproduce sanitisation

```sh
python3 scripts/sanitize-make-blueprint.py PRIVATE_INPUT automation/make/order-acknowledgement.sanitized.blueprint.json
python3 -m unittest discover -s tests -p '*_test.py'
```

The script removes configuration/metadata without printing values. It is tailored to this blueprint structure; always review/scanner-check new exports before committing. `.gitignore` excludes unreviewed `*.blueprint.json` exports and permits only the explicitly named sanitised template pattern in this folder.
