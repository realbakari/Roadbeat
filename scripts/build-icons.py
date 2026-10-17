"""Draws Roadbeat's raster icons and social card from the mark in public/favicon.svg.

Writes public/favicon.ico (16, 32 and 48 px), public/apple-touch-icon.png,
public/icon-maskable-512.png and public/og-image.jpg. Needs Pillow and the
macOS system font (SF Pro); run it from the repo root:

    python3 scripts/build-icons.py

The install screenshots in public/screenshots/ are captures of the live app,
taken with headless Chrome at 1080x1920 and 1920x1080:

    chrome --headless=new --hide-scrollbars --force-device-scale-factor=2 \
      --window-size=540,960 --virtual-time-budget=25000 --screenshot=narrow.png https://www.roadbeat.app/
    chrome --headless=new --hide-scrollbars --force-device-scale-factor=1.3333333 \
      --window-size=1440,810 --virtual-time-budget=25000 --screenshot=wide.png https://www.roadbeat.app/

then saved as JPEG (quality 80) under the same names.
"""

from PIL import Image, ImageDraw, ImageFont

MAROON = (122, 31, 61)  # #7a1f3d, SITE.themeColor
WHITE = (255, 255, 255)
PINK = (244, 200, 214)  # the card's secondary text
FONT = '/System/Library/Fonts/SFNS.ttf'
SS = 4  # supersampling, for smooth edges

# favicon.svg's road, in its 32-unit box: the road outline and its three dashes (x0, x1, y, stroke).
ROAD = [(13, 6), (19, 6), (22, 26), (17, 26), (16.6, 22), (15.4, 22), (15, 26), (10, 26)]
DASHES = [(15.6, 16.4, 10), (15.4, 16.6, 14), (15.2, 16.8, 18)]


def road(draw, x, y, scale, fg, bg):
    """The road mark with its 32-unit box at (x, y), scaled."""
    draw.polygon([(x + px * scale, y + py * scale) for px, py in ROAD], fill=fg)
    for x0, x1, dy in DASHES:
        draw.rectangle([x + x0 * scale, y + (dy - 0.75) * scale, x + x1 * scale, y + (dy + 0.75) * scale], fill=bg)


def tile(size, radius, fg, bg, scale=None):
    """A square tile with the road centred on it, as favicon.svg draws it."""
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, big - 1, big - 1], radius=radius * SS, fill=bg)
    s = (scale or size / 32) * SS
    road(d, big / 2 - 16 * s, big / 2 - 16 * s, s, fg, bg)
    return img.resize((size, size), Image.LANCZOS)


def font(size, weight):
    f = ImageFont.truetype(FONT, size * SS)
    f.set_variation_by_axes([100, min(96, size), 400, weight])  # width, optical size, grade, weight
    return f


def centred(d, y, text, f, fill, width):
    w = d.textlength(text, font=f)
    d.text(((width - w) / 2, y), text, font=f, fill=fill)


def og_image():
    """1200x630, with the mark and name inside the centred 630x630 square that chat apps crop to."""
    W, H = 1200 * SS, 630 * SS
    img = Image.new('RGB', (W, H), MAROON)
    d = ImageDraw.Draw(img)
    arc = (140, 50, 82)
    for r in (520, 700):
        for cx in (-180, 1380):
            d.ellipse([(cx - r) * SS, (680 - r) * SS, (cx + r) * SS, (680 + r) * SS], outline=arc, width=5 * SS)
    mark = tile(150, 34, MAROON, WHITE, scale=150 / 32 * 1.15).resize((150 * SS, 150 * SS), Image.LANCZOS)
    img.paste(mark, ((W - 150 * SS) // 2, 92 * SS), mark)
    centred(d, 262 * SS, 'Roadbeat', font(112, 700), WHITE, W)
    centred(d, 412 * SS, 'Live Queensland roads and transport', font(42, 500), WHITE, W)
    centred(d, 486 * SS, 'Road events · cameras · live vehicles · timetables · bushfires · flood gauges', font(27, 500), PINK, W)
    return img.resize((1200, 630), Image.LANCZOS)


tile(180, 0, WHITE, MAROON).convert('RGB').save('public/apple-touch-icon.png', optimize=True)
tile(512, 0, WHITE, MAROON, scale=16).convert('RGB').save('public/icon-maskable-512.png', optimize=True)
tile(48, 12, WHITE, MAROON).save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
og_image().save('public/og-image.jpg', quality=88, optimize=True, progressive=True)
