import os
import re

def audit_site(root_dir):
    html_files = []
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in root or '.git' in root or '.vscode' in root or 'backup' in root or 'assets' in root:
            continue
        for file in files:
            if file.endswith('.html'):
                html_files.append(os.path.join(root, file))

    results = []
    
    # regex patterns
    chat_widget_pattern = re.compile(r'id=["\']chat-widget["\']')
    scroll_btn_pattern = re.compile(r'id=["\']scroll-to-top["\']')
    tooltip_pattern = re.compile(r'id=["\']scroll-to-top-tooltip["\']')
    
    # We also check for script that initializes chat, likely 'site.js' or 'lazy-loader.js'
    script_pattern = re.compile(r'src=.*(site\.js|site\.min\.js|lazy-loader\.js)')

    print(f"Auditing {len(html_files)} files...")

    header = "| File | Chat Widget | Scroll Button | Tooltip | Script Included | Status |\n|---|---|---|---|---|---|\n"
    rows = []

    for file_path in html_files:
        rel_path = os.path.relpath(file_path, root_dir)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            has_chat = bool(chat_widget_pattern.search(content))
            has_scroll = bool(scroll_btn_pattern.search(content))
            has_tooltip = bool(tooltip_pattern.search(content))
            has_script = bool(script_pattern.search(content))
            
            status = "PASS" if (has_chat and has_scroll and has_tooltip and has_script) else "FAIL"
            
            # Formatting checks
            chat_mark = "✅" if has_chat else "❌"
            scroll_mark = "✅" if has_scroll else "❌"
            tooltip_mark = "✅" if has_tooltip else "❌"
            script_mark = "✅" if has_script else "❌"
            
            rows.append(f"| {rel_path} | {chat_mark} | {scroll_mark} | {tooltip_mark} | {script_mark} | {status} |")
        except Exception as e:
            rows.append(f"| {rel_path} | ERROR | ERROR | ERROR | ERROR | Error: {str(e)} |")

    with open(os.path.join(root_dir, 'docs', 'SITE_AI_AUDIT.md'), 'w', encoding='utf-8') as f:
        f.write("# Site AI & UI Audit\n\n")
        f.write(header)
        f.write("\n".join(rows))
        f.write("\n\n## Fix Plan\n")
        f.write("1. Restore Tooltip in all pages.\n")
        f.write("2. Fix CSS Centering for Scroll Ring.\n")
        f.write("3. Inject Chat Widget and Scripts where missing.\n")

if __name__ == "__main__":
    audit_site(r'c:\Users\estiv\portfolio-site')
