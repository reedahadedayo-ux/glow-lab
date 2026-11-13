#!/usr/bin/env python3
"""Read-only publication check. Reports locations/rule names, NEVER matched values.
Heuristic review aid, not a substitute for a dedicated secret scanner or human review.
Scans tracked working files and every blob/message reachable from HEAD (--history).
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = {
    "google_api_key": r"AIza[\w-]{30,}",
    "groq_api_key": r"gsk_[A-Za-z0-9]{30,}",
    "github_token": r"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})",
    "supabase_secret": r"sb_secret_[A-Za-z0-9_-]{20,}",
    "jwt_literal": r"eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}",
    "private_key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "make_webhook": r"https://hook\.[A-Za-z0-9.-]*make\.com/[A-Za-z0-9_-]{8,}",
    "slack_webhook": r"https://hooks\.slack\.com/services/[A-Za-z0-9/_-]+",
    "credential_url": r"(?:postgres(?:ql)?|https?)://[^\s/:]+:[^\s/@]+@[^\s]+",
}
PATTERNS = {name: re.compile(pattern) for name, pattern in RULES.items()}
PRIVATE_PATH = re.compile(r"(?:^|/)(?:\.env(?:\..*)?|.*\.(?:sqlite|sqlite3|db|pem|key)|credentials\.json)$", re.I)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def scan(data, location):
    text = data.decode("utf-8", errors="replace")
    return [{"location": location, "rule": name, "line": text.count("\n", 0, match.start()) + 1}
            for name, pattern in PATTERNS.items() for match in pattern.finditer(text)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", action="store_true")
    args = parser.parse_args()
    findings = []
    paths = git("ls-files", "-z").decode().split("\0")
    for path in filter(None, paths):
        if PRIVATE_PATH.search(path) and Path(path).name != ".env.example":
            findings.append({"location": path, "rule": "private_file_tracked"})
        if (ROOT / path).is_file():
            findings.extend(scan((ROOT / path).read_bytes(), path))
    blobs = 0
    if args.history:
        if git("rev-parse", "--is-shallow-repository").strip() == b"true":
            print(json.dumps({"error": "History is shallow; fetch full ancestry before publication review."}))
            return 2
        objects = git("rev-list", "--objects", "HEAD").decode().splitlines()
        proc = subprocess.Popen(["git", "cat-file", "--batch"], cwd=ROOT,
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        for obj in objects:
            oid, _, path = obj.partition(" ")
            proc.stdin.write((oid + "\n").encode())
            proc.stdin.flush()
            header = proc.stdout.readline().decode().split()
            size = int(header[2])
            data = proc.stdout.read(size)
            proc.stdout.read(1)
            if header[1] == "blob":
                blobs += 1
                location = f"history:{oid[:12]}:{path}"
                findings.extend(scan(data, location))
                if PRIVATE_PATH.search(path) and Path(path).name != ".env.example":
                    findings.append({"location": location, "rule": "private_file_in_history"})
            elif header[1] == "commit":
                findings.extend(scan(data, f"commit:{oid[:12]}"))
        proc.stdin.close()
        proc.wait()
    print(json.dumps({"kind": "HEURISTIC_PUBLICATION_SCAN", "tracked_files": len(list(filter(None, paths))),
                      "history_blobs": blobs, "findings": findings}, indent=2))
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
