#!/usr/bin/env python3
"""Create an inert, credential-free Make import template. Never prints input values.
Usage: python3 scripts/sanitize-make-blueprint.py PRIVATE_INPUT OUTPUT
The original must stay outside Git. Import/rebinding must be reviewed in Make.
"""
import copy
import json
import re
import sys
from pathlib import Path


def sanitize(source):
    result = copy.deepcopy(source)
    removed = {"webhook_bindings": 0, "mail_connections": 0, "variable_values": 0}

    def strings(value):
        if isinstance(value, dict):
            return {k: strings(v) for k, v in value.items()}
        if isinstance(value, list):
            return [strings(v) for v in value]
        if isinstance(value, str):
            value = re.sub(r'https?://[^\s<>"\\]+', 'https://example.invalid', value)
            value = re.sub(r'[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+', 'redacted@example.invalid', value)
            value = re.sub(r'eyJ[\w-]+\.[\w-]+\.[\w-]+|(?:AIza|gsk_|sb_secret_)[\w-]{15,}', '[REMOVED]', value)
        return value

    def nodes(flow):
        output = []
        for old in flow or []:
            node = {k: strings(v) for k, v in old.items()
                    if k in ('id', 'module', 'version', 'parameters', 'mapper', 'filter')}
            node['parameters'] = node.get('parameters') or {}
            if node['module'] == 'gateway:CustomWebHook':
                node['parameters'].pop('hook', None)
                removed['webhook_bindings'] += 1
            if '__IMTCONN__' in node['parameters']:
                node['parameters'].pop('__IMTCONN__')
                removed['mail_connections'] += 1
            if node['module'] == 'util:SetVariables':
                for variable in node.get('mapper', {}).get('variables', []):
                    variable['value'] = ''
                    removed['variable_values'] += 1
            designer = (old.get('metadata') or {}).get('designer') or {}
            node['metadata'] = {'designer': {k: strings(v) for k, v in designer.items() if k in ('x', 'y', 'name')}}
            if old.get('onerror'):
                node['onerror'] = nodes(old['onerror'])
            if old.get('routes'):
                node['routes'] = [{'flow': nodes(route.get('flow'))} for route in old['routes']]
            output.append(node)
        return output

    result = {
        'name': 'GlowLab - Order Acknowledgement v1 - SANITISED IMPORT TEMPLATE',
        'flow': nodes(result['flow']),
        'metadata': {k: strings(v) for k, v in result.get('metadata', {}).items()
                     if k in ('instant', 'version', 'scenario', 'zone')},
    }
    return result, removed


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Provide private input path and sanitised output path.')
    output, counts = sanitize(json.loads(Path(sys.argv[1]).read_text()))
    destination = Path(sys.argv[2])
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, indent=2) + '\n')
    print('Sanitised template written. Removed bindings/values:', json.dumps(counts))
