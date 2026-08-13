import pymupdf


def render_pdf_to_images(pdf_bytes: bytes, dpi: int = 150) -> list[bytes]:
    """Rasterizes each PDF page to a PNG (as bytes) for use as a whiteboard
    page background — annotation happens on top of these in Fabric.js."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    zoom = dpi / 72  # PDF's native unit is 72 DPI
    matrix = pymupdf.Matrix(zoom, zoom)
    images = [page.get_pixmap(matrix=matrix).tobytes("png") for page in doc]
    doc.close()
    return images