
utf8_bytes = b'\xf0\x9f\x90\x8d'
print(f"Original UTF-8 bytes: {utf8_bytes.hex()}")

try:
    # Try mbcs (Windows ANSI)
    corrupted_str = utf8_bytes.decode('mbcs')
    print(f"Corrupted string (mbcs): {corrupted_str!r}")
    
    corrupted_utf8_bytes = corrupted_str.encode('utf-8')
    print(f"Corrupted UTF-8 bytes (mbcs): {corrupted_utf8_bytes.hex()}")
    
    # Attempt fix
    fixed_bytes = corrupted_str.encode('mbcs')
    print(f"Fixed bytes (mbcs): {fixed_bytes.hex()}")
    fixed_str = fixed_bytes.decode('utf-8')
    print(f"Fixed string (mbcs): {fixed_str}")
    
except Exception as e:
    print(f"Error with mbcs: {e}")

print("-" * 20)

corrupted_str_manual = "\u00f0\u0178\u0090\u008d"
print(f"Manual corrupted string: {corrupted_str_manual!r}")

try:
    encoded_mbcs = corrupted_str_manual.encode('mbcs')
    print(f"Manual encoded mbcs: {encoded_mbcs.hex()}")
    
except Exception as e:
    print(f"Error manual mbcs: {e}")
