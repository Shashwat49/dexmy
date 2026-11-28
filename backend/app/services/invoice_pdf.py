from datetime import datetime
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


GREEN = colors.HexColor("#1F392D")
RED = colors.HexColor("#E4271C")
GOLD = colors.HexColor("#D8A83E")
MUTED = colors.HexColor("#66756D")


def render_payment_invoice(payment, *, payer_name: str, student_name: str | None) -> bytes:
    """Render an invoice from persisted payment fields without recomputing totals or taxes."""
    output = BytesIO()
    page_width, page_height = A4
    pdf = canvas.Canvas(output, pagesize=A4, pageCompression=1)
    pdf.setTitle(f"Dexmy invoice {payment.id}")
    pdf.setAuthor("Dexmy")

    margin = 52
    logo_path = Path(__file__).resolve().parents[3] / "frontend" / "public" / "dexmy-logo-bg-removed.png"
    if logo_path.is_file():
        pdf.drawImage(ImageReader(str(logo_path)), margin, page_height - 97, width=130, height=40, preserveAspectRatio=True, mask="auto", anchor="sw")
    else:
        pdf.setFillColor(GREEN)
        pdf.setFont("Helvetica-Bold", 23)
        pdf.drawString(margin, page_height - 76, "DEXMY")

    pdf.saveState()
    pdf.setFillColor(colors.HexColor("#E8ECE9"))
    pdf.setFont("Helvetica-Bold", 58)
    pdf.translate(page_width / 2, page_height / 2)
    pdf.rotate(35)
    pdf.drawCentredString(0, 0, "DEXMY")
    pdf.restoreState()

    pdf.setFillColor(GREEN)
    pdf.setFont("Helvetica-Bold", 24)
    pdf.drawRightString(page_width - margin, page_height - 74, "INVOICE")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(page_width - margin, page_height - 93, "Payment record")

    top = page_height - 142
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(2)
    pdf.line(margin, top, page_width - margin, top)

    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(margin, top - 29, "INVOICE REFERENCE")
    pdf.drawString(margin, top - 65, "ISSUED")
    pdf.drawString(page_width / 2, top - 29, "PAYMENT STATUS")
    pdf.drawString(page_width / 2, top - 65, "PAYMENT METHOD")
    pdf.setFillColor(GREEN)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(margin, top - 44, str(payment.id))
    created_at = payment.created_at
    issued = created_at.isoformat(timespec="seconds") if isinstance(created_at, datetime) else str(created_at or "Not recorded")
    pdf.drawString(margin, top - 80, issued)
    status_value = getattr(payment.status, "value", payment.status)
    provider_value = getattr(payment.provider, "value", payment.provider)
    pdf.drawString(page_width / 2, top - 44, str(status_value).upper())
    pdf.drawString(page_width / 2, top - 80, str(provider_value).title())

    section_y = top - 132
    pdf.setFillColor(GREEN)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(margin, section_y, "BILLED TO")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(margin, section_y - 19, payer_name or "Account holder")
    pdf.drawString(margin, section_y - 36, f"Student: {student_name}" if student_name else "Student: Not recorded")

    row_top = section_y - 82
    pdf.setFillColor(GREEN)
    pdf.roundRect(margin, row_top - 29, page_width - 2 * margin, 32, 5, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(margin + 12, row_top - 18, "DESCRIPTION")
    pdf.drawRightString(page_width - margin - 12, row_top - 18, "AMOUNT")

    pdf.setFillColor(GREEN)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(margin + 12, row_top - 53, "Tutoring package payment")
    if payment.package_class_count is not None:
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 9)
        pdf.drawString(margin + 12, row_top - 69, f"Purchased class count: {payment.package_class_count}")

    amount = f"{payment.currency} {payment.amount}"
    pdf.setFillColor(GREEN)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawRightString(page_width - margin - 12, row_top - 53, amount)

    total_y = row_top - 116
    pdf.setStrokeColor(colors.HexColor("#DCE3DE"))
    pdf.setLineWidth(0.8)
    pdf.line(page_width - margin - 205, total_y + 20, page_width - margin, total_y + 20)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(page_width - margin - 205, total_y, "Total recorded")
    pdf.setFillColor(RED)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawRightString(page_width - margin, total_y, amount)

    provider_reference = payment.provider_payment_id or payment.provider_order_id
    if provider_reference:
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 8)
        pdf.drawString(margin, 84, f"Provider reference: {provider_reference}")
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(1)
    pdf.line(margin, 67, page_width - margin, 67)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 8)
    pdf.drawCentredString(page_width / 2, 50, "Generated from Dexmy's recorded payment details. No taxes or additional charges are stated.")
    pdf.showPage()
    pdf.save()
    return output.getvalue()
