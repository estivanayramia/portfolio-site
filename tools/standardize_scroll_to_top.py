import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Canonical snippet (no inline styles; JS initializes dasharray/dashoffset)
CANONICAL = """<!-- Scroll to Top Button -->
<button id=\"scroll-to-top\" class=\"scroll-to-top-btn\" type=\"button\" title=\"Back to top\" aria-label=\"Back to top\" aria-describedby=\"scroll-to-top-tooltip\">
    <svg class=\"scroll-progress-ring\" viewBox=\"0 0 47 47\" width=\"47\" height=\"47\" aria-hidden=\"true\" focusable=\"false\">
        <circle class=\"scroll-progress-track\" cx=\"23.5\" cy=\"23.5\" r=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"></circle>
        <circle class=\"scroll-progress-circle\" cx=\"23.5\" cy=\"23.5\" r=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"></circle>
    </svg>
    <svg class=\"scroll-to-top-icon\" viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\">
        <path d=\"M18 15l-6-6-6 6\"></path>
    </svg>
    <div id=\"scroll-to-top-tooltip\" class=\"scroll-to-top-btn-tooltip\" role=\"tooltip\">Back to top</div>
</button>
"""

# Match any existing scroll-to-top block (optional preceding comment on its own line).
BUTTON_RE = re.compile(
    r"(?P<indent>^[ \t]*)"  # indentation where the block starts
    r"(?:<!--\s*Scroll to Top Button\s*-->\s*\r?\n(?P=indent))?"  # optional dedicated comment line
    r"<button\b[^>]*\bid\s*=\s*\"scroll-to-top\"[^>]*>"  # opening button
    r"[\s\S]*?"  # body
    r"</button>\s*\r?\n?",  # closing button
    flags=re.IGNORECASE | re.MULTILINE,
)

# Remove inline comment fragments that ended up after other tags (e.g. </script> <!-- Scroll to Top Button -->)
INLINE_COMMENT_RE = re.compile(
    r"(</[^>]+>)\s*<!--\s*Scroll\s*to\s*Top\s*Button\s*-->\s*\r?\n",
    flags=re.IGNORECASE,
)


def iter_html_files(root: Path):
    for path in root.rglob("*.html"):
        rel = path.relative_to(root).as_posix().lower()
        # Skip backups/archives by convention
        if "backup" in rel or "dryrun" in rel:
            continue
        yield path


def main():
    changed = 0
    total_with_button = 0

    for html in iter_html_files(ROOT):
        try:
            text = html.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            # Fallback for rare files
            text = html.read_text(encoding="utf-8", errors="replace")

        if 'id="scroll-to-top"' not in text:
            continue

        total_with_button += 1

        # Cleanup any inline comment variants first.
        cleaned_text = INLINE_COMMENT_RE.sub(r"\1\n", text)

        def repl(match: re.Match):
            indent = match.group("indent")
            snippet = CANONICAL.rstrip("\n")
            # Re-indent canonical block to match file
            snippet = "\n".join(
                (indent + line if line.strip() else line)
                for line in snippet.split("\n")
            ) + "\n"
            return snippet

        new_text, n = BUTTON_RE.subn(repl, cleaned_text)
        if n and new_text != cleaned_text:
            html.write_text(new_text, encoding="utf-8")
            changed += 1

    print(f"Found pages with button: {total_with_button}")
    print(f"Updated pages: {changed}")


if __name__ == "__main__":
    main()
