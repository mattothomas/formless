# Dependencies: pip install pypdf PyMuPDF
# Usage: py tools/inspect_pdf.py path/to/form.pdf

import json
import sys
from pathlib import Path

from pypdf import PdfReader
import fitz  # PyMuPDF


def serialize(value):
    if value is None:
        return None
    return str(value)


def inspect_pdf(pdf_path: str) -> None:
    path = Path(pdf_path)
    output_dir = path.parent / f"{path.stem}_inspection"
    output_dir.mkdir(exist_ok=True)

    reader = PdfReader(str(path))
    fields = reader.get_fields() or {}

    extracted_fields = [
        {
            "pdfFieldName": name,
            "fieldType": serialize(field.get("/FT")),
            "value": serialize(field.get("/V")),
            "defaultValue": serialize(field.get("/DV")),
            "alternateName": serialize(field.get("/TU")),
            "mappingName": serialize(field.get("/TM")),
            "options": serialize(field.get("/Opt")),
            "flags": serialize(field.get("/Ff")),
        }
        for name, field in fields.items()
    ]

    with open(output_dir / "fields.json", "w", encoding="utf-8") as f:
        json.dump(extracted_fields, f, indent=2, ensure_ascii=False)

    document = fitz.open(str(path))
    page_text = []

    for page_number, page in enumerate(document):
        page_text.append({"page": page_number + 1, "text": page.get_text("text")})
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
        pixmap.save(output_dir / f"page-{page_number + 1}.png")

    with open(output_dir / "pages.json", "w", encoding="utf-8") as f:
        json.dump(page_text, f, indent=2, ensure_ascii=False)

    print(f"Output: {output_dir}")
    print(f"Pages : {len(document)}")
    print(f"Fields: {len(extracted_fields)}")

    if extracted_fields:
        print("\nFirst fields:")
        for field in extracted_fields[:5]:
            print(f"  {field['pdfFieldName']} ({field['fieldType']}) = {field['value']!r}")
        if len(extracted_fields) > 5:
            print(f"  ... and {len(extracted_fields) - 5} more (see fields.json)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: py tools/inspect_pdf.py path/to/form.pdf")
    inspect_pdf(sys.argv[1])
