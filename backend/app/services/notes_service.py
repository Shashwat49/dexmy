import io

from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas


def compile_notes_pdf(image_streams: list[io.BytesIO]) -> bytes:
    """One whiteboard page image per PDF page, centered and scaled to fit."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    for stream in image_streams:
        img = ImageReader(stream)
        img_width, img_height = img.getSize()
        aspect = img_height / img_width
        draw_width = width - 60
        draw_height = draw_width * aspect
        if draw_height > height - 60:
            draw_height = height - 60
            draw_width = draw_height / aspect
        x = (width - draw_width) / 2
        y = (height - draw_height) / 2
        c.drawImage(img, x, y, width=draw_width, height=draw_height)
        c.showPage()

    c.save()
    buffer.seek(0)
    return buffer.read()