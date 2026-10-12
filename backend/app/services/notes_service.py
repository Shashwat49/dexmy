import io

from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas


# 16:9 landscape page, matching the classroom whiteboard/PPT aspect ratio.
PAGE_WIDTH = 13.333333 * 72
PAGE_HEIGHT = 7.5 * 72


# Use the same first-party logo shown in the live classroom.
_DEXMY_LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAGwAAAAwCAYAAAD0Kp9BAAAAAXNSR0IArs4c
6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAABpjSURB
VHhe7Xt7mFxHdefvVNW9t3t6enpmWtJoRqMZjTyWyMiRscfGjyA8chxjHGM+
kpV47cYE+Oxvs2zywYZkN7usDPjxZTfEhm/zIA9YyJKAjB9gbGNsVjFg/CCC
IGwZ1rItyTOa96Nnpl/3Vp2zf9x7Rz09IxuSJX8s+s3X0933Vp2qOr+qU+ec
ug2cxVmcxVmcRQJqvnAWP1scBDR1bX1NlvTydRPHTwKQ5jKvhLOE/Qvh4a6u
nKrU93YK/1bG1a+0EBdq/+ByoP5k+srF7++/C665zno4S9jPFnRo48auXLV8
vSf0O9lIdmhm4zQDIgABVpn6os58W2eDP5o09M3rx8crzUIacZawnwEOArq9
s3NHp+MbPFu9IbDYaCAaImABQATiWPsCBiBwWkVV5f2YW1s+OUv6y1dPTk7T
OuZyDWEPDg4GwcLCJS1RVVkLwACwSP4ZaHLiRBMMoEymHPiFySXfTe09caLW
LOvnDQ8ODgb5ifLFORf++4ytvlERtymxJMTQIDAIiglaFFgRGAIlAoGAlQIA
WMWuqrxxGwSfYwr+V21u5/N78ZhN21hD2CPd3X1bFpa/rzlslYRfRbSKakG8
nMHE0LpcB49VTOaz5az3+aumpiYbiv5c4f5Nm97Vt7j4UV/sNnJKGQCiCCIA
i1Rqho6T4CUmmhCQZpZeraJz8qx7SeBZEhghOAKcgauT+t5Y26YP/Or4ycfT
NtYQ9o3Nm/u3zC8+47Ftbb4HALKmRoxIEYeknltubb3x8unpJ9Zbzv+/4yCg
uzo6epS1v56L5IYM119D2oQ1ePeWfbqfyLSQ2B0mtH01BXjWP646Wp5R9YpR
1eh9LWz3sHK1CMHTkUdP1wLzrUdn5h/+CMBpG2vUHxNWesZjty5haQVuqkkQ
CDRqPh8veR1v/qX5yWdWl/i5Aj3YOZhvDWcu4KxXVNXalRsjfouI7SKIZ4QR
qXi3UaD6kg5OLJrgM2K8F9hVX5zO54+2O3WhEzbXTow+1ig4Npw/IYRiolyy
eEjiFwAwCTQDfmi2tdbrH/tMf39mde2fK8i1c8cW37C88JhuL/YUa7V/69l6
rwMbErCQsZ7zLEQzC/wWF+7oiGoHooCeurJUOvy20dGqNlr5Wtbws+bCmUBE
YEI1JCqFWpVEKFq5J4BiDSaBkjp8Vx/ZOTNz7moJP58IqlGGlCktmuDbC9mW
20pa/ZvlnLq+5AdvnTT+e2b87MdDFXzPiY0iYz0kprWtPPWu1mr5HbJvn26U
tz5hDeZOCBAisIiUfLpzKr/h4lOt+dctmcw7Q8IEKI73JFllrBS0uDZPqQtP
S1mNTwHet4vF/FP5nuKh7u4Nj2zfXjjU359JXJlVSBYxHQBU+jl9NZdFUv4A
oNYr3/w6EI+f0npfRG/2O21tnd8qFDoOxRZiTRsHh4b8Q4VC+yM9PcV/3N2V
kyYdNrcxtlR9dMYLRia2dl+1p1T6L5fUan974XzloYsqC199fWXpcw8vL/7+
qbaBNyya7HXLXn5GANoHiA6R9Rxa72oUvl6HvrF5c/+WhdIznov3sJgwAICU
jPfBi8rlO9Oy320t3pSPyn/miSURAijeyQTAktKfHK7VfqdBNB7Zvr3QOrW4
v8VVryei15CzbULQSutlERmPxHxzudD+2T0TJ39EAAtAhzo6Plis1XZreAAc
CCyKFco6qC6p4MN7l8dnUvkPdWy6rDus3KRYSGLliVMsTFqyYli4bpzy4DEQ
KgdxkLnW7Kc1bfq+VCbe2+bq7/Ql6iMCW2ReXjLB50x78JnLR0erDw4OBq1T
s7/W6uwN2cj+Ql1LoH3MLIn3+ELQ/t+unX75hbv7NnT3zy7eYpDRYCdgIs9A
luBXqy35j+6dPjGR9lUOHFBPfPx//PdWqRUjayDKwmgt0NHktOq+PVcfv8tA
m5Ztfdecd/RomNY7A2GLz3gu9hKFAIpdTZnzzH+4tFy+Iy37dKHngo3l2e9G
ClqLrHiQAmDWmC9cWqm8M/mKhzs7L+muhH/ZYu15kWHybRoqCJiAWMWEiMxi
BfoTM1u7br322LH60x1db+soz/2diCYShlMEjx2c9nnOz/zmpUtzn0NsRvzB
IPeFgg3fKiqWHbtBhHkKHtHGdbVF0W4HgmHAGgtPPJ7K+r8Hi6sLNvoVw5aE
PDgIiB0EkOlMcDCb73l/VJ74w0K98huBhbFKgwCQMFgzqmTG5nXLNdVdxZM9
z4y/0Ba5DQ4ODEBBUFeqPtOaf9PI7OyhVHf393Zu2TxTfanNiaeYwNoC5GHe
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
/wKOWMRYxKDrvgAAAABJRU5ErkJggg==
"


def compile_notes_pdf(image_streams: list[io.BytesIO], student_email: str = "") -> bytes:
    """Render each whiteboard page and add PDF-only branding without changing source images."""
    import base64

    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    logo_bytes = base64.b64decode(_DEXMY_LOGO_BASE64)
    logo = ImageReader(io.BytesIO(logo_bytes))

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

        # PDF-only branding is drawn after the saved whiteboard image. It is never
        # added to the live canvas, snapshot, or source image.
        logo_width, logo_height = 68, 30
        logo_x, logo_y = PAGE_WIDTH - logo_width - 14, PAGE_HEIGHT - logo_height - 12
        c.setFillColorRGB(1, 1, 1)
        c.roundRect(logo_x - 5, logo_y - 4, logo_width + 10, logo_height + 8, 4, stroke=0, fill=1)
        c.drawImage(logo, logo_x, logo_y, width=logo_width, height=logo_height, preserveAspectRatio=True, anchor="c", mask="auto")

        if student_email:
            email = student_email.strip()
            c.setFont("Helvetica", 7.5)
            email_width = min(c.stringWidth(email, "Helvetica", 7.5), PAGE_WIDTH - 28)
            box_width = email_width + 12
            box_x, box_y = PAGE_WIDTH - box_width - 10, 8
            c.setFillColorRGB(1, 1, 1)
            c.roundRect(box_x, box_y, box_width, 18, 3, stroke=0, fill=1)
            c.setFillColorRGB(0.34, 0.40, 0.49)
            c.drawRightString(PAGE_WIDTH - 16, box_y + 5.5, email)

        c.showPage()

    c.save()
    buffer.seek(0)
    return buffer.read()
