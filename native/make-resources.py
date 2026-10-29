# Genera íconos y splash para iOS/Android a partir de icon-512.png (corre en GitHub Actions).
import os
from PIL import Image, ImageDraw
os.makedirs("native/resources", exist_ok=True)
src = Image.open("icon-512.png").convert("RGB")
# recorta el círculo del logo (icon-512 tiene 6% de margen)
p = int(512 * 0.06); logo = src.crop((p, p, 512 - p, 512 - p))
def badge(size, frac, mode="RGB"):
    bg = Image.new(mode, (size, size), (13, 15, 17) if mode == "RGB" else (0, 0, 0, 0))
    d = int(size * frac); im = logo.resize((d, d), Image.LANCZOS).convert(mode)
    m = Image.new("L", (d, d), 0); ImageDraw.Draw(m).ellipse((0, 0, d - 1, d - 1), fill=255)
    bg.paste(im, ((size - d) // 2, (size - d) // 2), m); return bg
badge(1024, .86).save("native/resources/icon-only.png")
badge(1024, .58, "RGBA").save("native/resources/icon-foreground.png")
Image.new("RGB", (1024, 1024), (13, 15, 17)).save("native/resources/icon-background.png")
s = badge(2732, .22); s.save("native/resources/splash.png"); s.save("native/resources/splash-dark.png")
print("recursos generados")
