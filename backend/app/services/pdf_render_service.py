import pymupdf


MAX_WHITEBOARD_PDF_PAGES = 50


def render_pdf_to_images(pdf_bytes: bytes, dpi: int = 110) -> list[bytes]:
    """Render compact JPEG backgrounds for classroom slides.

    Rendering at 110 DPI is sharp enough for a 1600x900 whiteboard while
    producing substantially smaller assets than 150-DPI PNGs. Check page count
    before rasterization so oversized PDFs fail quickly instead of wasting CPU.
    """
    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        if doc.page_count > MAX_WHITEBOARD_PDF_PAGES:
            raise ValueError("PDF too long (50 pages max)")
        zoom = dpi / 72
        matrix = pymupdf.Matrix(zoom, zoom)
        return [
            page.get_pixmap(matrix=matrix, alpha=False).tobytes("jpeg", jpg_quality=82)
            for page in doc
        ]
