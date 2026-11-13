import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sanitizer', ROOT / 'scripts/sanitize-make-blueprint.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BlueprintTests(unittest.TestCase):
    def test_removes_private_configuration_and_metadata_without_mutating_input(self):
        source = {'flow': [
            {'id': 1, 'module': 'gateway:CustomWebHook', 'parameters': {'hook': 123}, 'metadata': {'restore': {'private': 'person@example.org'}}},
            {'id': 2, 'module': 'util:SetVariables', 'mapper': {'variables': [{'name': 'service_key', 'value': 'private-value'}, {'name': 'supabase_url', 'value': 'https://private-project.invalid'}]}},
            {'id': 10, 'module': 'google-email:sendAnEmail', 'parameters': {'__IMTCONN__': 456}, 'mapper': {'to': ['{{1.record.customer_email}}']}}],
            'metadata': {'designer': {'orphans': [{'private': 'remove-me'}]}}}
        before = json.dumps(source)
        cleaned, counts = module.sanitize(source)
        text = json.dumps(cleaned)
        self.assertNotIn('private-value', text)
        self.assertNotIn('__IMTCONN__', text)
        self.assertNotIn('person@example.org', text)
        self.assertNotIn('remove-me', text)
        self.assertIn('{{1.record.customer_email}}', text)
        self.assertEqual(before, json.dumps(source))
        self.assertEqual(counts['variable_values'], 2)

    def test_repository_template_has_expected_module_sequence_and_no_binding(self):
        blueprint = json.loads((ROOT / 'automation/make/order-acknowledgement.sanitized.blueprint.json').read_text())
        self.assertEqual([m['id'] for m in blueprint['flow']], [1, 2, 3, 4, 5, 6])
        self.assertNotIn('hook', blueprint['flow'][0]['parameters'])
        self.assertTrue(all(v['value'] == '' for v in blueprint['flow'][1]['mapper']['variables']))
        routes = blueprint['flow'][-1]['routes']
        self.assertEqual([m['id'] for m in routes[0]['flow']], [8, 9, 10, 11])
        self.assertEqual([m['id'] for m in routes[1]['flow']], [12])
        self.assertNotIn('__IMTCONN__', routes[0]['flow'][2]['parameters'])
        # Evidence is preserved, not silently changed into a supposedly fixed scenario.
        self.assertIn('{{8.item_name}}', routes[0]['flow'][1]['mapper']['value'])
        self.assertEqual(blueprint['flow'][2]['mapper']['url'], '{{2.supabase_url}}/rest/v1/rpc/claim_order_notification')

    def test_preserves_error_handlers_and_safe_headers(self):
        blueprint = json.loads((ROOT / 'automation/make/order-acknowledgement.sanitized.blueprint.json').read_text())
        claim, fetch = blueprint['flow'][2], blueprint['flow'][4]
        self.assertEqual(claim['onerror'][0]['mapper']['count'], '5')
        self.assertEqual(fetch['mapper']['qs'][1]['value'], '*,order_items!inner(*)')
        self.assertTrue(any(h['name'] == 'Accept-Profile' and h['value'] == 'glowlab' for h in fetch['mapper']['headers']))


class ImageMetadataTests(unittest.TestCase):
    def test_jpeg_metadata_removed_without_changing_scan_stream(self):
        spec = importlib.util.spec_from_file_location('metadata', ROOT / 'scripts/strip-image-metadata.py')
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        segment = lambda marker, value: b'\xff' + bytes([marker]) + (len(value) + 2).to_bytes(2, 'big') + value
        scan = b'\xff\xda\x00\x02image-stream\xff\xd9'
        original = b'\xff\xd8' + segment(0xe0, b'JFIF') + segment(0xe1, b'private EXIF') + segment(0xfe, b'comment') + scan
        expected = b'\xff\xd8' + segment(0xe0, b'JFIF') + scan
        self.assertEqual(helper.strip(original), expected)
        self.assertEqual(helper.strip(expected), expected)
        with self.assertRaises(ValueError):
            helper.strip(b'not-jpeg')


if __name__ == '__main__':
    unittest.main()
