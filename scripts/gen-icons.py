"""Draw the app icons: a blossoming cherry tree on a green hill against a dawn sky, the same scene as the splash.
Usage: python3 gen-icons.py <assets dir>
Writes icon.png (iOS/default), android-icon-{background,foreground,monochrome}.png and favicon.png."""
import os, sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
SS = 4  # supersample for smooth edges

SKY_TOP, SKY_BOTTOM = (255, 164, 142), (255, 236, 205)
SUN, SUN_GLOW = '#FFB36B', (255, 216, 168)
HILL_FAR, HILL = '#B8D9A0', '#77B35E'
BARK, BARK_LIGHT = '#6B4430', '#8E6547'
LEAF = ['#2E6440', '#3B8452', '#66B86A']  # shadow, base, highlight (cherry)
BLOSSOM, BLOSSOM_CENTER, CHERRY = '#FFB7D0', '#E75A8C', '#A4102D'

# Canopy blobs (cx, cy, r) in tree units: the tree spans roughly x 0.2..0.8, y 0.18..0.82.
BLOBS = [(0.36, 0.47, 0.12), (0.64, 0.47, 0.12), (0.40, 0.33, 0.13), (0.60, 0.33, 0.13), (0.50, 0.26, 0.13), (0.50, 0.44, 0.15)]
FLOWERS = [(0.33, 0.43), (0.45, 0.30), (0.58, 0.24), (0.66, 0.40), (0.52, 0.40), (0.40, 0.50), (0.62, 0.52), (0.47, 0.22), (0.70, 0.47)]
FRUIT = [(0.43, 0.56), (0.60, 0.58), (0.35, 0.53)]


def canvas(size, color=(0, 0, 0, 0)):
    img = Image.new('RGBA', (size * SS, size * SS), color)
    return img, ImageDraw.Draw(img)


def finish(img, size):
    return img.resize((size, size), Image.LANCZOS)


def sky(size):
    img = Image.new('RGBA', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(SKY_TOP, SKY_BOTTOM)))
    return img


def sun(size, cx, cy, r):
    s = size * SS
    # Blur only the alpha, so the halo stays warm instead of picking up the transparent black around it.
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).ellipse([(cx - r * 1.9) * s, (cy - r * 1.9) * s, (cx + r * 1.9) * s, (cy + r * 1.9) * s], fill=150)
    glow = Image.new('RGBA', (s, s), SUN_GLOW + (0,))
    glow.putalpha(mask.filter(ImageFilter.GaussianBlur(r * s * 0.5)))
    d = ImageDraw.Draw(glow)
    d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], fill=SUN)
    return finish(glow, size)


def hills(size, far=True, near=True, lift=0.0):
    img, d = canvas(size)
    s = size * SS
    y = lambda v: (v - lift) * s
    if far:
        d.ellipse([-0.3 * s, y(0.74), 0.75 * s, y(1.3)], fill=HILL_FAR)
        d.ellipse([0.35 * s, y(0.76), 1.4 * s, y(1.3)], fill=HILL_FAR)
    if near:
        d.ellipse([-0.25 * s, y(0.80), 1.25 * s, y(1.45)], fill=HILL)
    return finish(img, size)


def tree(size, scale=1.0, oy=0.0, mono=None):
    """Tree scaled about the canvas centre. With `mono`, everything is drawn in that one colour (a silhouette)."""
    img, d = canvas(size)
    s = size * SS

    def P(x, y):
        return ((0.5 + (x - 0.5) * scale) * s, (0.5 + (y - 0.5) * scale + oy) * s)

    def circle(cx, cy, r, fill):
        x, y = P(cx, cy)
        rr = r * scale * s
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=mono or fill)

    def limb(pts, w, fill):
        w = int(w * scale * s)
        xy = [P(*p) for p in pts]
        d.line(xy, fill=mono or fill, width=w, joint='curve')
        for p in (xy[0], xy[-1]):
            d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=mono or fill)

    # Trunk flares at the base, then splits into two main branches.
    d.polygon([P(0.44, 0.83), P(0.56, 0.83), P(0.525, 0.62), P(0.475, 0.62)], fill=mono or BARK)
    limb([(0.5, 0.66), (0.44, 0.52), (0.38, 0.45)], 0.045, BARK)
    limb([(0.5, 0.66), (0.57, 0.53), (0.63, 0.45)], 0.045, BARK)
    limb([(0.5, 0.64), (0.5, 0.40)], 0.05, BARK)
    if not mono:
        limb([(0.475, 0.80), (0.485, 0.64)], 0.014, BARK_LIGHT)

    for cx, cy, r in BLOBS:
        circle(cx + 0.012, cy + 0.018, r * 1.05, LEAF[0])
    for cx, cy, r in BLOBS:
        circle(cx, cy, r, LEAF[1])
    if mono:
        return finish(img, size)
    for cx, cy, r in BLOBS:
        circle(cx - r * 0.3, cy - r * 0.35, r * 0.5, LEAF[2])
    for x, y in FLOWERS:
        circle(x, y, 0.024, BLOSSOM)
        circle(x, y, 0.009, BLOSSOM_CENTER)
    for x, y in FRUIT:
        limb([(x, y - 0.02), (x + 0.006, y - 0.045)], 0.006, '#5B3A22')
        circle(x, y, 0.022, CHERRY)
        circle(x - 0.007, y - 0.007, 0.007, '#E86A7E')
    return finish(img, size)


def compose(*layers):
    base = layers[0]
    for l in layers[1:]:
        base = Image.alpha_composite(base, l)
    return base


# iOS / default icon: full-bleed scene, no transparency.
N = 1024
icon = compose(sky(N), sun(N, 0.72, 0.33, 0.13), hills(N), tree(N, 0.92, 0.02))
icon.convert('RGB').save(os.path.join(OUT, 'icon.png'), optimize=True)
icon.resize((48, 48), Image.LANCZOS).save(os.path.join(OUT, 'favicon.png'), optimize=True)

# Android adaptive: the launcher masks a 108dp canvas down to ~66dp, so the tree sits in the middle 60%.
A = 512
compose(sky(A), sun(A, 0.64, 0.40, 0.09), hills(A, near=False, lift=0.1)).convert('RGB').save(os.path.join(OUT, 'android-icon-background.png'), optimize=True)
compose(hills(A, far=False, lift=0.1), tree(A, 0.62, -0.02)).save(os.path.join(OUT, 'android-icon-foreground.png'), optimize=True)
tree(432, 0.62, -0.02, mono='#FFFFFF').save(os.path.join(OUT, 'android-icon-monochrome.png'), optimize=True)
