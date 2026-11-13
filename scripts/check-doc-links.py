#!/usr/bin/env python3
"""Check local Markdown file/fragment links without sending network requests."""
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def slug(text):
    text = re.sub(r"[`*_]", "", text).strip().lower()
    text = re.sub(r"[^\w\- ]", "", text)
    return text.replace(" ", "-")


def main():
    files = subprocess.check_output(["git", "ls-files", "-z", "*.md"], cwd=ROOT).decode().split("\0")
    checked = 0
    errors = []
    for name in filter(None, files):
        path = ROOT / name
        if not path.is_file():
            continue
        text = re.sub(r"```.*?```", "", path.read_text(), flags=re.S)
        for href in re.findall(r"\]\(([^\s)]+)(?:\s+[^)]*)?\)", text):
            url = urlsplit(href)
            if url.scheme or url.netloc:
                continue
            target = (path.parent / unquote(url.path)).resolve() if url.path else path
            checked += 1
            if not target.is_relative_to(ROOT) or not target.exists():
                errors.append(f"{name}: missing local target {href}")
                continue
            if url.fragment and target.suffix.lower() == ".md":
                headings = [slug(h) for h in re.findall(r"^#{1,6}\s+(.+)$", target.read_text(), flags=re.M)]
                if unquote(url.fragment) not in headings:
                    errors.append(f"{name}: missing heading {href}")
    print(f"Checked {checked} local Markdown targets/fragments; {len(errors)} errors.")
    for error in errors:
        print(error)
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
