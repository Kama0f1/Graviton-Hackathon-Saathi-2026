"""Generates synthetic test images for live_test.py into tests/samples/generated/.
They are fictional (made-up shop and electricity board). Run: python tests/make_samples.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "samples" / "generated"
OUT.mkdir(parents=True, exist_ok=True)


def font(size, bold=False, mono=False):
    names = (["DejaVuSansMono-Bold.ttf" if bold else "DejaVuSansMono.ttf"] if mono
             else ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"])
    for base in ["/usr/share/fonts/truetype/dejavu/", "C:/Windows/Fonts/", ""]:
        for n in names + (["consolab.ttf" if bold else "consola.ttf"] if mono else ["arialbd.ttf" if bold else "arial.ttf"]):
            try:
                return ImageFont.truetype(base + n, size)
            except OSError:
                continue
    return ImageFont.load_default()


def paper(lines, width=620, mono=True, size=26, pad=40, gap=14):
    """White paper with text lines; (text, bold) tuples or plain strings."""
    h = pad * 2 + len(lines) * (size + gap)
    img = Image.new("RGB", (width, h), "white")
    d = ImageDraw.Draw(img)
    y = pad
    for line in lines:
        text, bold = (line if isinstance(line, tuple) else (line, False))
        d.text((pad, y), text, fill=(25, 25, 25), font=font(size, bold, mono))
        y += size + gap
    return img


def on_table(sheets, angle=-2.5, bg=(40, 38, 36)):
    """Place sheets side by side on a dark table, slightly rotated, like a phone photo."""
    rotated = [s.rotate(angle, expand=True, fillcolor=bg) for s in sheets]
    w = sum(r.width for r in rotated) + 60 * (len(rotated) + 1)
    h = max(r.height for r in rotated) + 120
    canvas = Image.new("RGB", (w, h), bg)
    x = 60
    for r in rotated:
        canvas.paste(r, (x, 60))
        x += r.width + 60
    return canvas


def bill(total):
    return paper([
        ("SHARMA KIRANA STORE", True), "Phase 7, Mohali", "Date: 31/10/2026   Bill No: 0457",
        "------------------------------------",
        ("Item            Qty  Rate  Amount", True),
        "Atta 10kg        1    450    450",
        "Toor Dal 1kg     2    160    320",
        "Sugar 1kg        3     48    144",
        "Mustard Oil 1L   1    185    185",
        "------------------------------------",
        (f"TOTAL                Rs {total}", True), "Thank you, visit again!",
    ])


LETTER = [
    ("CITY ELECTRICITY BOARD", True), "Customer Care: 1800-000-000", "",
    "Account No: 4471 2290", "Name: Aditya Arora", "",
    "Dear Customer,", "Your electricity bill for October 2026", "is Rs 1,240 (412 units).", "",
    ("Due date: 10 November 2026", True), "A late fee of Rs 50 applies after", "the due date.", "",
    "Pay online or at any CEB counter.",
]


def main():
    on_table([bill(1099)]).save(OUT / "bill_correct.jpg", quality=88)          # 450+320+144+185 = 1099
    on_table([bill(1199)]).save(OUT / "bill_overcharged.jpg", quality=88)      # printed 100 too much
    on_table([bill(1099), bill(1099)], angle=1.5).save(OUT / "two_bills.jpg", quality=88)

    letter = paper(LETTER, width=700, mono=False, size=28)
    on_table([letter], angle=1.0).save(OUT / "letter.jpg", quality=88)
    letter.save(OUT / "letter.pdf", "PDF", resolution=150)

    # document half out of frame (for /guidance)
    full = on_table([letter], angle=1.0)
    full.crop((full.width // 2, 0, full.width, full.height)).save(OUT / "letter_cut_off.jpg", quality=88)

    # exit sign
    sign = Image.new("RGB", (900, 420), (20, 120, 50))
    d = ImageDraw.Draw(sign)
    d.text((450, 150), "EXIT", fill="white", font=font(150, bold=True), anchor="mm")
    d.text((450, 320), "GATE 2  \u2192", fill="white", font=font(70, bold=True), anchor="mm")
    wall = Image.new("RGB", (1200, 800), (205, 200, 190))
    wall.paste(sign, (150, 120))
    wall.save(OUT / "sign_exit.jpg", quality=88)

    Image.new("RGB", (800, 600), (8, 8, 8)).save(OUT / "too_dark.jpg", quality=88)
    print("written to", OUT)
    for p in sorted(OUT.iterdir()):
        print(" ", p.name, f"{p.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()


def bottle():
    """Drawn plastic water bottle held up against a wall (waste test). Not a photo, but unambiguous."""
    img = Image.new("RGB", (900, 1200), (214, 206, 192))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 980, 900, 1200), fill=(150, 120, 90))                      # table
    cx = 450
    d.rounded_rectangle((cx - 55, 150, cx + 55, 230), 14, fill=(30, 90, 200))    # cap
    d.polygon([(cx - 55, 230), (cx + 55, 230), (cx + 150, 380), (cx - 150, 380)], fill=(200, 225, 240))  # neck
    d.rounded_rectangle((cx - 150, 370, cx + 150, 1000), 40, fill=(205, 228, 243), outline=(150, 180, 200), width=4)
    for y in range(430, 980, 60):                                                # ridges
        d.line((cx - 140, y, cx + 140, y), fill=(175, 205, 225), width=3)
    d.rectangle((cx - 150, 560, cx + 150, 760), fill=(20, 110, 190))            # label
    d.text((cx, 630), "PURE", fill="white", font=font(60, bold=True), anchor="mm")
    d.text((cx, 700), "Mineral Water 1L", fill="white", font=font(34), anchor="mm")
    d.ellipse((cx - 120, 400, cx - 80, 520), fill=(235, 245, 252))               # shine
    return img


if __name__ == "__main__":
    bottle().save(OUT / "waste_bottle.jpg", quality=90)
