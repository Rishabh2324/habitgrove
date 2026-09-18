"""Draw the native splash image: the app icon as a rounded square, centred with transparent padding
so Android 12+'s circular splash mask never clips its corners.
Usage: python3 gen-splash.py <icon.png> <out.png>"""
import sys
from PIL import Image, ImageDraw

SIZE = 1024
ICON = round(SIZE * 0.62)  # fits inside the circle Android 12+ crops the splash icon to
RADIUS = round(ICON * 0.22)
SS = 4  # supersample the mask for smooth corners

icon = Image.open(sys.argv[1]).convert('RGBA').resize((ICON, ICON), Image.LANCZOS)
mask = Image.new('L', (ICON * SS, ICON * SS), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, ICON * SS - 1, ICON * SS - 1], RADIUS * SS, fill=255)
icon.putalpha(mask.resize((ICON, ICON), Image.LANCZOS))

out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
out.paste(icon, ((SIZE - ICON) // 2, (SIZE - ICON) // 2), icon)
out.save(sys.argv[2], optimize=True)
