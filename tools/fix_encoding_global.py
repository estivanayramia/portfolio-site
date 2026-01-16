import os

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if it looks corrupted (contains the Mojibake for Snake emoji or similar)
        # Snake: ðŸ (\u00f0\u0178\u0090\u008d)
        # Copyright: Â© (\u00c2\u00a9)
        
        # We can try to fix the whole content
        try:
            # Encode to mbcs (reversing the corruption)
            fixed_bytes = content.encode('mbcs')
            # Decode as utf-8 (restoring original)
            fixed_content = fixed_bytes.decode('utf-8')
            
            if fixed_content != content:
                print(f"Fixing {filepath}...")
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(fixed_content)
                return True
            else:
                print(f"No changes needed for {filepath}")
                return False
                
        except UnicodeEncodeError:
            # This happens if the content contains characters that cannot be mapped to mbcs
            # This might mean it's NOT corrupted in the way we think, or contains mixed content
            print(f"Skipping {filepath} (UnicodeEncodeError during fix attempt)")
            return False
        except UnicodeDecodeError:
             print(f"Skipping {filepath} (UnicodeDecodeError during fix attempt)")
             return False

    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    root_dir = '.'
    count = 0
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith('.html'):
                filepath = os.path.join(dirpath, filename)
                if fix_file(filepath):
                    count += 1
    print(f"Fixed {count} files.")

if __name__ == "__main__":
    main()
