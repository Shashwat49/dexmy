import io

from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas


# 16:9 landscape page, matching the classroom whiteboard/PPT aspect ratio.
PAGE_WIDTH = 13.333333 * 72
PAGE_HEIGHT = 7.5 * 72


def compile_notes_pdf(image_streams: list[io.BytesIO]) -> bytes:
    """One 16:9 whiteboard page image per PDF page, centered and scaled to fit."""
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))

    for stream in image_streams:
        img = ImageReader(stream)
        img_width, img_height = img.getSize()
        image_aspect = img_width / img_height
        page_aspect = PAGE_WIDTH / PAGE_HEIGHT

        if image_aspect > page_aspect:
            draw_width = PAGE_WIDTH
            draw_height = draw_width / image_aspect
        else:
            draw_height = PAGE_HEIGHT
            draw_width = draw_height * image_aspect

        x = (PAGE_WIDTH - draw_width) / 2
        y = (PAGE_HEIGHT - draw_height) / 2
        c.drawImage(img, x, y, width=draw_width, height=draw_height)
        c.showPage()

    c.save()
    buffer.seek(0)
    return buffer.read()
