import os

def fix_links(directory):
    count = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".html"):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = content.replace('href="/projects.html"', 'href="/projects/"')
                new_content = new_content.replace('href="projects.html"', 'href="/projects/"')
                
                if content != new_content:
                    print(f"Fixing links in {filepath}")
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    count += 1
    print(f"Fixed links in {count} files.")

if __name__ == "__main__":
    fix_links(".")
