"""Check every internal link and asset reference in site/ before publishing.

Resolves relative href/src values (including "#anchor" parts and SVG sprite
references like icons.svg#i-github) against the files on disk. External links
are not fetched. Exits with status 1 if anything is broken.

    python tools/check_links.py
"""
import pathlib
import re
import sys
from urllib.parse import unquote, urlsplit

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"
REF = re.compile(r'(?:href|src)="([^"]+)"')
ID = re.compile(r'\bid="([^"]+)"')


def target_file(page: pathlib.Path, path: str) -> pathlib.Path:
    base = SITE if path.startswith("/") else page.parent
    target = (base / unquote(path.lstrip("/"))).resolve()
    return target / "index.html" if target.is_dir() or path.endswith("/") else target


def main() -> None:
    ids_cache: dict[pathlib.Path, set[str]] = {}

    def ids_in(file: pathlib.Path) -> set[str]:
        if file not in ids_cache:
            ids_cache[file] = set(ID.findall(file.read_text(encoding="utf-8")))
        return ids_cache[file]

    problems, checked = [], 0
    for page in sorted(SITE.rglob("*.html")):
        for ref in REF.findall(page.read_text(encoding="utf-8")):
            if re.match(r"^(https?:|mailto:|data:|//)", ref):
                continue
            parts = urlsplit(ref)
            file = page if not parts.path else target_file(page, parts.path)
            checked += 1
            where = page.relative_to(SITE).as_posix()
            if not file.exists():
                problems.append(f"{where}: missing file for {ref}")
            elif parts.fragment and file.suffix in (".html", ".svg") and parts.fragment not in ids_in(file):
                problems.append(f"{where}: no id '{parts.fragment}' for {ref}")

    for p in problems:
        print("BROKEN", p)
    print(f"Checked {checked} internal references: {len(problems)} broken.")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
