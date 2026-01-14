import os
from pypdf import PdfReader, PdfWriter

input_path = r"assets/img/Portolio-Media/Portfolio Media/projects-/loreal-maps-retail-playbook.pdf"
output_path = r"assets/img/Portolio-Media/Portfolio Media/projects-/loreal-maps-retail-playbook-compressed.pdf"

def compress_pdf(input_file, output_file):
    reader = PdfReader(input_file)
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)
    
    # Write with compression enabled by default in PdfWriter
    with open(output_file, "wb") as f:
        writer.write(f)
        
    # Now try to compress the output file in place if needed, 
    # but PdfWriter usually compresses by default.
    
    original_size = os.path.getsize(input_file)
    new_size = os.path.getsize(output_file)
    print(f"Original size: {original_size / (1024*1024):.2f} MB")
    print(f"New size: {new_size / (1024*1024):.2f} MB")

if __name__ == "__main__":
    if os.path.exists(input_path):
        compress_pdf(input_path, output_path)
    else:
        print(f"File not found: {input_path}")
