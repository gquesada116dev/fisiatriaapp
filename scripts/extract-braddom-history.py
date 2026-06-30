"""
Re-extrae los dos capítulos de Historia/Examen desde Braddom's PM&R 6ed
(los .txt previos estaban mal extraídos desde Frontera).

- Texto  → scripts/chapter-sources/{slug}.txt   (con encabezado Braddom's)
- Figuras → scripts/chapter-assets/{slug}/fig-N.png  (en orden de página, dedup)

Uso: python3 scripts/extract-braddom-history.py
"""
import fitz  # PyMuPDF
import hashlib
import os

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
BRADDOM = os.path.join(SCRIPTS_DIR, "Cifu D. Braddom's Physical Medicine and Rehabilitation 6ed 2021_compressed.pdf")
SOURCES = os.path.join(SCRIPTS_DIR, "chapter-sources")
ASSETS = os.path.join(SCRIPTS_DIR, "chapter-assets")

# slug → (start_pdf_page, end_pdf_page, label)  [1-indexed PDF pages, verificado]
CHAPTERS = [
    ("historia-clinica-examen-fisico-fisiatrico", 18, 57,
     "Cap 1: The Physiatric History and Physical Examination"),
    ("historia-examen-fisico-pediatrico", 61, 71,
     "Cap 2: Examination of the Pediatric Patient"),
]

MIN_W = MIN_H = 200  # filtra iconos / decoración

doc = fitz.open(BRADDOM)


def extract_text(start, end):
    parts = []
    for pno in range(start - 1, end):
        parts.append(doc[pno].get_text())
    return "\n\n".join(parts)


def extract_images(slug, start, end):
    out_dir = os.path.join(ASSETS, slug)
    os.makedirs(out_dir, exist_ok=True)
    # limpia figuras previas para no mezclar con extracciones viejas
    for f in os.listdir(out_dir):
        if f.lower().endswith((".png", ".jpg", ".jpeg")):
            os.remove(os.path.join(out_dir, f))

    seen = set()
    saved = 0
    for pno in range(start - 1, end):
        page = doc[pno]
        for img in page.get_images(full=True):
            xref = img[0]
            w, h = img[2], img[3]
            if w < MIN_W or h < MIN_H:
                continue
            pix = fitz.Pixmap(doc, xref)
            # Normaliza a RGB/gris sin alpha: PNG no acepta CMYK/separación/alpha aquí
            cs = pix.colorspace.name if pix.colorspace else ""
            if cs not in ("DeviceRGB", "DeviceGray") or pix.n - pix.alpha >= 4:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            if pix.alpha:
                pix = fitz.Pixmap(pix, 0)  # elimina canal alpha
            png = pix.tobytes("png")
            digest = hashlib.md5(png).hexdigest()
            if digest in seen:
                continue
            seen.add(digest)
            saved += 1
            with open(os.path.join(out_dir, f"fig-{saved}.png"), "wb") as fh:
                fh.write(png)
    return saved


for slug, start, end, label in CHAPTERS:
    text = extract_text(start, end)
    header = (f"=== FUENTE PRIMARIA: Braddom's Physical Medicine & Rehabilitation 6ª ed. (2021) "
              f"— {label} (págs PDF {start}–{end}) ===\n\n")
    with open(os.path.join(SOURCES, f"{slug}.txt"), "w", encoding="utf-8") as fh:
        fh.write(header + text)
    n_imgs = extract_images(slug, start, end)
    print(f"  ✓ {slug}: {len(text)//1000}k chars de texto, {n_imgs} figuras")

print("\n✅ Listo. Revisá las figuras en scripts/chapter-assets/<slug>/")
