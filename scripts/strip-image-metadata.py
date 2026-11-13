#!/usr/bin/env python3
"""Strip JPEG EXIF/XMP APP1 and COM metadata without recompressing image data.
Explicit files only; no recursive deletion, network access or generated assets.
"""
import sys
from pathlib import Path


def strip(data):
    if not data.startswith(b'\xff\xd8'):
        raise ValueError('Not a JPEG')
    output = bytearray(data[:2])
    offset = 2
    while offset < len(data):
        start = offset
        if data[offset] != 0xff:
            raise ValueError('Malformed JPEG marker')
        while data[offset] == 0xff:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in (0xda, 0xd9):
            output.extend(data[start:])
            return bytes(output)
        if marker in (0xd8, 0x01) or 0xd0 <= marker <= 0xd7:
            output.extend(data[start:offset])
            continue
        length = int.from_bytes(data[offset:offset + 2], 'big')
        if length < 2 or offset + length > len(data):
            raise ValueError('Malformed JPEG segment')
        offset += length
        if marker not in (0xe1, 0xfe):
            output.extend(data[start:offset])
    raise ValueError('JPEG missing scan/end marker')


if __name__ == '__main__':
    for filename in sys.argv[1:]:
        path = Path(filename)
        before = path.read_bytes()
        after = strip(before)
        if after != before:
            path.write_bytes(after)
            print(f'Metadata removed: {path.name}; image stream retained.')
