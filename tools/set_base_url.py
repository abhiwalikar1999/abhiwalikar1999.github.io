"""Write the site's public address into every page before uploading.

Link previews (LinkedIn, messengers) and search engines need absolute URLs,
which depend on where the site is hosted. Run this once per host, then upload.
Running it again with a different address replaces the old values.

    python tools/set_base_url.py https://homepages.uni-paderborn.de/<username>/
    python tools/set_base_url.py https://abhiwalikar1999.github.io/
"""
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"
START, END = "<!-- deploy:urls -->", "<!-- /deploy:urls -->"
PLACEHOLDER = "<!-- canonical, og:url and og:image need the final domain; they are added at deploy time -->"


def block(base: str, page_path: str) -> str:
    url = base + page_path
    lines = [
        START,
        f'<link rel="canonical" href="{url}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{base}assets/img/og-image.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        END,
    ]
    return "\n".join("  " + line for line in lines) + "\n"


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"https://[^\s\"<>]+/", sys.argv[1]):
        sys.exit("Usage: python tools/set_base_url.py https://your.host/path/   (https, ending with /)")
    base = sys.argv[1]

    pages = [SITE / "index.html", *sorted(SITE.glob("projects/*/index.html"))]
    for page in pages:
        rel = page.parent.relative_to(SITE).as_posix()
        page_path = "" if rel == "." else rel + "/"
        html = page.read_text(encoding="utf-8")

        html = html.replace("  " + PLACEHOLDER + "\n", "")
        html = re.sub(r"[ \t]*" + re.escape(START) + r".*?" + re.escape(END) + r"\n", "", html, flags=re.S)
        anchor = '  <link rel="icon"'
        if html.count(anchor) != 1:
            sys.exit(f"Could not find the insertion point in {page}")
        html = html.replace(anchor, block(base, page_path) + anchor)

        page.write_text(html, encoding="utf-8")
        print(f"{base + page_path}")
    print(f"Updated {len(pages)} pages.")


if __name__ == "__main__":
    main()
