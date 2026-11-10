import base64
import boto3
import pymupdf
import os
import json

REGION = os.environ.get("AWS_DEFAULT_REGION", "eu-west-1")
textract_client = boto3.client("textract", region_name=REGION)

def pdf_to_images_base64(pdf_path: str, dpi: int = 150) -> list[str]:
    """
    Renders each page of a PDF as a PNG image using PyMuPDF and encodes it to base64.
    dpi=150 provides sharp resolution for Textract OCR while keeping file sizes small.
    """
    images_base64 = []
    doc = pymupdf.open(pdf_path)

    for page in doc:
        # Render page to a pixmap at the specified DPI
        pix = page.get_pixmap(dpi=dpi)
        
        # Convert pixmap directly to PNG bytes in-memory
        image_bytes = pix.tobytes("png")
        
        # Base64 encode
        b64_str = base64.b64encode(image_bytes).decode("utf-8")
        images_base64.append(b64_str)

    doc.close()
    return images_base64


def reconstruct_text_with_bullets(textract_response: dict, upper_threshold: float = 0.03) -> str:
    """
    Reconstructs page text by detecting indented lines (bullet points)
    based on AWS Textract bounding-box 'Left' coordinates.
    """
    lines = [
        block for block in textract_response.get("Blocks", [])
        if block.get("BlockType") == "LINE"
    ]
    if not lines:
        return ""

    # Sort blocks vertically (top-to-bottom), then horizontally (left-to-right)
    lines.sort(key=lambda b: (b["Geometry"]["BoundingBox"]["Top"], b["Geometry"]["BoundingBox"]["Left"]))

    # Find the most frequent baseline left margin across lines
    left_coords = [round(b["Geometry"]["BoundingBox"]["Left"], 2) for b in lines]
    base_margin = max(set(left_coords), key=left_coords.count) if left_coords else 0.0

    output_lines = []
    for line in lines:
        left = line["Geometry"]["BoundingBox"]["Left"]
        text = line.get("Text", "").strip()
        if not text:
            continue

        # If indented beyond baseline margin, prepend a bullet point
        if upper_threshold >= (left - base_margin) >= 0:
            output_lines.append(f"• {text}")
        else:
            output_lines.append(text)

    return "\n".join(output_lines)

def process_pdf(pdf_path: str) -> str:
    """Extracts reconstructed text for all pages of a single PDF."""
    images_base64 = pdf_to_images_base64(pdf_path, dpi=150)
    extracted_pages = []

    for b64_img in images_base64:
        image_bytes = base64.b64decode(b64_img)
        textract_response = textract_client.detect_document_text(
            Document={"Bytes": image_bytes}
        )
        page_text = reconstruct_text_with_bullets(textract_response)
        extracted_pages.append(page_text)

    return "\n\n".join(extracted_pages)

# ==========================================
# Execution Pipeline
# ==========================================
pdf_paths = [
    "../data/Nitay Levy - NW CV.pdf",
    "../data/Nitay_Levy_DE_CV.pdf",
    "../data/Nitay_Levy_MLC_CV.pdf",
    "../data/Nitay_Levy_MLN_CV.pdf",
]

resumes = []

for path in pdf_paths:
    print(f"Processing: {path}...")
    extracted_text = process_pdf(path)
    resumes.append(extracted_text)

output_file = "my_resumes.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(resumes, f, ensure_ascii=False, indent=2)

'''
for idx, (path, resume_data) in enumerate(zip(pdf_paths, resumes), start=1):
    print("\n" + "=" * 80)
    print(f"RESUME {idx} OF {len(resumes)}: {path}")
    print("=" * 80)

    # Handle string outputs as well as dict/object structures returned by process_pdf
    if isinstance(resume_data, dict):
        text = resume_data.get("text") or resume_data.get("content") or str(resume_data)
    else:
        text = str(resume_data)

    print(text)
'''