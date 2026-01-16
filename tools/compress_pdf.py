import os
from pypdf import PdfReader, PdfWriter

input_path = r"assets/img/Portolio-Media/Portfolio Media/projects-/loreal-maps-retail-playbook.pdf"
output_path = r"assets/img/Portolio-Media/Portfolio Media/projects-/loreal-maps-retail-playbook-compressed.pdf"

def compress_pdf(input_file, output_file):
    reader = PdfReader(input_file)
    writer = PdfWriter()

    for page in reader.pages:
        page.compress_content_streams()  # Basic compression
        writer.add_page(page)
    
    # Reduce image quality if possible (pypdf has limited image compression, but this helps structure)
    # For significant reduction, we'd need to re-encode images, which pypdf doesn't do natively easily without Pillow.
    # However, we can try to strip metadata and compress streams.
    
    with open(output_file, "wb") as f:
        writer.write(f)
    
    original_size = os.path.getsize(input_file)
    new_size = os.path.getsize(output_file)
    print(f"Original size: {original_size / (1024*1024):.2f} MB")
    print(f"New size: {new_size / (1024*1024):.2f} MB")

if __name__ == "__main__":
    if os.path.exists(input_path):
        compress_pdf(input_path, output_path)
    else:
        print(f"File not found: {input_path}")
