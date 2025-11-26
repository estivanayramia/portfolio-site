#!/usr/bin/env python3
"""
Image Optimization Script for Portfolio Website
================================================
Converts images to WebP format with smart resizing to improve PageSpeed scores.
Also auto-updates HTML files with correct width/height attributes to prevent CLS.

INSTALLATION:
    pip install Pillow

USAGE:
    python optimize_assets.py
    python optimize_assets.py --html-only  # Only update HTML dimensions

This script will:
1. Scan assets/img/ for all .jpg, .jpeg, .png files
2. Convert them to WebP format (quality=80)
3. Smart resize based on image type:
   - Logos/Icons: max-width 300px
   - Hero/Project images (>1200px wide): max-width 1200px
4. Save .webp files alongside originals (originals are preserved)
5. Scan all HTML files and auto-update img tags with correct dimensions
"""

import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow library not found.")
    print("Please install it with: pip install Pillow")
    sys.exit(1)


# Configuration
ASSETS_DIR = Path("assets/img")
PROJECT_ROOT = Path(".")
WEBP_QUALITY = 80
LOGO_ICON_MAX_WIDTH = 300
HERO_PROJECT_MAX_WIDTH = 1200
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
HTML_FILES_PATTERN = "*.html"


def is_logo_or_icon(filename: str) -> bool:
    """Check if filename suggests it's a logo or icon."""
    lower_name = filename.lower()
    return any(keyword in lower_name for keyword in ["logo", "icon", "favicon"])


def resize_image(img: Image.Image, max_width: int) -> Image.Image:
    """Resize image maintaining aspect ratio if wider than max_width."""
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        print(f"    ↳ Resized to {max_width}x{new_height}")
    return img


def convert_to_webp(image_path: Path) -> tuple[bool, str]:
    """
    Convert an image to WebP format with smart resizing.
    
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        # Open the image
        with Image.open(image_path) as img:
            original_size = f"{img.width}x{img.height}"
            
            # Convert to RGB if necessary (for PNG with transparency, use RGBA)
            if img.mode in ("RGBA", "LA", "P"):
                # Keep transparency for PNGs
                if img.mode == "P":
                    img = img.convert("RGBA")
            elif img.mode != "RGB":
                img = img.convert("RGB")
            
            filename = image_path.name
            
            # Smart resizing based on image type
            if is_logo_or_icon(filename):
                print(f"    ↳ Detected as logo/icon, max-width: {LOGO_ICON_MAX_WIDTH}px")
                img = resize_image(img, LOGO_ICON_MAX_WIDTH)
            elif img.width > HERO_PROJECT_MAX_WIDTH:
                print(f"    ↳ Large image detected, max-width: {HERO_PROJECT_MAX_WIDTH}px")
                img = resize_image(img, HERO_PROJECT_MAX_WIDTH)
            
            # Create output path with .webp extension
            output_path = image_path.with_suffix(".webp")
            
            # Save as WebP
            img.save(output_path, "WEBP", quality=WEBP_QUALITY, method=6)
            
            # Get file sizes for comparison
            original_size_kb = image_path.stat().st_size / 1024
            new_size_kb = output_path.stat().st_size / 1024
            savings = ((original_size_kb - new_size_kb) / original_size_kb) * 100
            
            return True, f"Saved {output_path.name} ({new_size_kb:.1f}KB, {savings:.1f}% smaller)"
            
    except Exception as e:
        return False, f"Error: {str(e)}"


def get_image_dimensions(image_path: Path) -> tuple[int, int] | None:
    """Get width and height of an image file."""
    try:
        with Image.open(image_path) as img:
            return img.width, img.height
    except Exception:
        return None


def resolve_image_path(src: str, html_file: Path) -> Path | None:
    """
    Resolve an image src attribute to an actual file path.
    Handles both absolute paths (/assets/img/...) and relative paths (../assets/img/...).
    """
    # Remove query strings and fragments
    src = src.split("?")[0].split("#")[0]
    
    # Handle absolute paths (starting with /)
    if src.startswith("/"):
        resolved = PROJECT_ROOT / src.lstrip("/")
    else:
        # Relative path - resolve from HTML file's directory
        resolved = html_file.parent / src
    
    # Normalize the path
    resolved = resolved.resolve()
    
    if resolved.exists():
        return resolved
    return None


def update_img_tag_dimensions(match: re.Match, html_file: Path) -> str:
    """
    Process an img tag and add/update width and height attributes.
    
    Args:
        match: Regex match object containing the img tag
        html_file: Path to the HTML file (for resolving relative paths)
    
    Returns:
        Updated img tag string
    """
    img_tag = match.group(0)
    
    # Extract src attribute
    src_match = re.search(r'src=["\']([^"\']+)["\']', img_tag)
    if not src_match:
        return img_tag
    
    src = src_match.group(1)
    
    # Skip external images (http/https)
    if src.startswith(("http://", "https://", "data:")):
        return img_tag
    
    # Resolve image path
    image_path = resolve_image_path(src, html_file)
    if not image_path:
        return img_tag
    
    # Get actual dimensions
    dimensions = get_image_dimensions(image_path)
    if not dimensions:
        return img_tag
    
    width, height = dimensions
    
    # Check if width/height already exist
    has_width = re.search(r'\bwidth\s*=\s*["\']?\d+["\']?', img_tag)
    has_height = re.search(r'\bheight\s*=\s*["\']?\d+["\']?', img_tag)
    
    updated_tag = img_tag
    
    # Update or add width attribute
    if has_width:
        updated_tag = re.sub(
            r'\bwidth\s*=\s*["\']?\d+["\']?',
            f'width="{width}"',
            updated_tag
        )
    else:
        # Add width before the closing >
        updated_tag = re.sub(r'(/?>)$', f' width="{width}"\\1', updated_tag)
    
    # Update or add height attribute
    if has_height:
        updated_tag = re.sub(
            r'\bheight\s*=\s*["\']?\d+["\']?',
            f'height="{height}"',
            updated_tag
        )
    else:
        # Add height before the closing >
        updated_tag = re.sub(r'(/?>)$', f' height="{height}"\\1', updated_tag)
    
    return updated_tag


def update_html_dimensions(html_file: Path) -> tuple[int, int]:
    """
    Scan an HTML file and update all img tags with correct dimensions.
    
    Args:
        html_file: Path to the HTML file
    
    Returns:
        tuple: (images_updated, images_skipped)
    """
    try:
        content = html_file.read_text(encoding="utf-8")
        original_content = content
        
        # Find all img tags and update them
        # This regex matches <img ... > or <img ... />
        img_pattern = r'<img\s+[^>]*>'
        
        def replacer(match):
            return update_img_tag_dimensions(match, html_file)
        
        content = re.sub(img_pattern, replacer, content)
        
        # Count changes
        if content != original_content:
            html_file.write_text(content, encoding="utf-8")
            # Count how many img tags we potentially touched
            img_count = len(re.findall(img_pattern, original_content))
            return img_count, 0
        
        return 0, len(re.findall(img_pattern, content))
        
    except Exception as e:
        print(f"    ✗ Error processing {html_file.name}: {e}")
        return 0, 0


def process_all_html_files() -> tuple[int, int, int]:
    """
    Scan all HTML files and update image dimensions.
    
    Returns:
        tuple: (files_updated, total_images_updated, total_images_skipped)
    """
    print("\n" + "=" * 60)
    print("HTML Image Dimension Updater")
    print("=" * 60)
    
    html_files = list(PROJECT_ROOT.glob(HTML_FILES_PATTERN))
    # Also check subdirectories like ar/, es/
    for subdir in PROJECT_ROOT.iterdir():
        if subdir.is_dir() and not subdir.name.startswith("."):
            html_files.extend(subdir.glob(HTML_FILES_PATTERN))
    
    html_files = sorted(set(html_files))
    
    if not html_files:
        print("\nNo HTML files found.")
        return 0, 0, 0
    
    print(f"\nFound {len(html_files)} HTML file(s) to process:\n")
    
    files_updated = 0
    total_updated = 0
    total_skipped = 0
    
    for html_file in html_files:
        print(f"Processing: {html_file}")
        updated, skipped = update_html_dimensions(html_file)
        
        if updated > 0:
            print(f"    ✓ Updated {updated} image(s)")
            files_updated += 1
        else:
            print(f"    - No changes needed")
        
        total_updated += updated
        total_skipped += skipped
    
    return files_updated, total_updated, total_skipped


def main():
    """Main function to process all images and update HTML."""
    html_only = "--html-only" in sys.argv
    
    if not html_only:
        print("=" * 60)
        print("Portfolio Image Optimization Script")
        print("=" * 60)
        print(f"\nScanning: {ASSETS_DIR.absolute()}")
        print(f"WebP Quality: {WEBP_QUALITY}")
        print(f"Logo/Icon max-width: {LOGO_ICON_MAX_WIDTH}px")
        print(f"Hero/Project max-width: {HERO_PROJECT_MAX_WIDTH}px")
        print("-" * 60)
        
        if not ASSETS_DIR.exists():
            print(f"\nError: Directory '{ASSETS_DIR}' not found!")
            print("Make sure you're running this script from the project root.")
            sys.exit(1)
        
        # Find all images (exclude webp for conversion)
        convert_extensions = {".jpg", ".jpeg", ".png"}
        images = []
        for ext in convert_extensions:
            images.extend(ASSETS_DIR.rglob(f"*{ext}"))
            images.extend(ASSETS_DIR.rglob(f"*{ext.upper()}"))
        
        # Remove duplicates and sort
        images = sorted(set(images))
        
        if not images:
            print("\nNo images found to convert to WebP.")
        else:
            print(f"\nFound {len(images)} image(s) to process:\n")
            
            success_count = 0
            error_count = 0
            
            for image_path in images:
                print(f"Processing: {image_path.name}")
                success, message = convert_to_webp(image_path)
                
                if success:
                    print(f"    ✓ {message}")
                    success_count += 1
                else:
                    print(f"    ✗ {message}")
                    error_count += 1
                print()
            
            # Summary
            print("-" * 60)
            print("WEBP CONVERSION SUMMARY")
            print("-" * 60)
            print(f"✓ Successfully converted: {success_count}")
            print(f"✗ Errors: {error_count}")
            print(f"Original files: PRESERVED (not deleted)")
    
    # Always update HTML dimensions
    files_updated, total_updated, total_skipped = process_all_html_files()
    
    # HTML Summary
    print("\n" + "-" * 60)
    print("HTML DIMENSION UPDATE SUMMARY")
    print("-" * 60)
    print(f"✓ HTML files modified: {files_updated}")
    print(f"✓ Image tags updated: {total_updated}")
    print(f"- Image tags skipped (external/missing): {total_skipped}")
    
    print("\n" + "=" * 60)
    print("Next steps:")
    print("1. Review changes with: git diff")
    print("2. Commit your changes")
    print("3. Deploy to see improved PageSpeed scores!")
    print("=" * 60)


if __name__ == "__main__":
    main()
