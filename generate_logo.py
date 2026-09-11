import numpy as np
from PIL import Image, ImageDraw, ImageFilter

size = 512
scale = 2
w = size * scale
h = size * scale

# 1. Create gradient numpy array
x = np.linspace(0, 1, w)
y = np.linspace(0, 1, h)
xx, yy = np.meshgrid(x, y)
t = xx * 0.65 + yy * 0.35

r = (5 + t * 15).astype(np.uint8)
g = (140 + t * 60).astype(np.uint8)
b = (100 + t * 45).astype(np.uint8)
a = np.full((h, w), 255, dtype=np.uint8)

bg_array = np.stack([r, g, b, a], axis=-1)
bg_img = Image.fromarray(bg_array, 'RGBA')

# 2. Mask to rounded rectangle
corner_rad = int(90 * scale)
mask = Image.new("L", (w, h), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([(0, 0), (w, h)], radius=corner_rad, fill=255)

canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
canvas.paste(bg_img, (0, 0), mask)

# 3. Draw big bold geometric K
k_mask = Image.new("L", (w, h), 0)
k_draw = ImageDraw.Draw(k_mask)

pad_x = int(65 * scale)
pad_y = int(50 * scale)
inner_w = w - 2 * pad_x
inner_h = h - 2 * pad_y

stem_w = int(72 * scale)
stem_rad = int(22 * scale)

# Vertical Stem
stem_box = [(pad_x, pad_y), (pad_x + stem_w, pad_y + inner_h)]
k_draw.rounded_rectangle(stem_box, radius=stem_rad, fill=255)

# Diagonal arms
stem_right = pad_x + stem_w
center_y = pad_y + int(inner_h * 0.52)
arm_thickness = int(70 * scale)

# Upper Branch
p_start_top = (stem_right - int(5 * scale), center_y - int(10 * scale))
p_end_top = (pad_x + inner_w - int(5 * scale), pad_y + int(10 * scale))
k_draw.line([p_start_top, p_end_top], fill=255, width=arm_thickness)
k_draw.ellipse([
    (p_end_top[0] - arm_thickness // 2, p_end_top[1] - arm_thickness // 2),
    (p_end_top[0] + arm_thickness // 2, p_end_top[1] + arm_thickness // 2)
], fill=255)

# Lower Branch
p_start_bot = (stem_right + int(38 * scale), center_y - int(6 * scale))
p_end_bot = (pad_x + inner_w - int(5 * scale), pad_y + inner_h - int(10 * scale))
k_draw.line([p_start_bot, p_end_bot], fill=255, width=arm_thickness)
k_draw.ellipse([
    (p_end_bot[0] - arm_thickness // 2, p_end_bot[1] - arm_thickness // 2),
    (p_end_bot[0] + arm_thickness // 2, p_end_bot[1] + arm_thickness // 2)
], fill=255)

# Smooth junction
junction_poly = [
    (stem_right - int(10 * scale), center_y - int(60 * scale)),
    (stem_right + int(55 * scale), center_y - int(25 * scale)),
    (stem_right + int(50 * scale), center_y + int(35 * scale)),
    (stem_right - int(10 * scale), center_y + int(60 * scale)),
]
k_draw.polygon(junction_poly, fill=255)

# Drop shadow
shadow_mask = k_mask.filter(ImageFilter.GaussianBlur(radius=int(12 * scale)))
shadow_layer = Image.new("RGBA", (w, h), (0, 30, 20, 130))
canvas.paste(shadow_layer, (0, int(8 * scale)), shadow_mask)

# White K
white_k = Image.new("RGBA", (w, h), (255, 255, 255, 255))
canvas.paste(white_k, (0, 0), k_mask)

# Gold dot
dot_x, dot_y = p_end_top[0], p_end_top[1]
dot_r = int(14 * scale)
gold_draw = ImageDraw.Draw(canvas)
gold_draw.ellipse([(dot_x - dot_r, dot_y - dot_r), (dot_x + dot_r, dot_y + dot_r)], fill=(255, 215, 0, 255), outline=(255, 255, 255, 255), width=int(2.5 * scale))

final = canvas.resize((size, size), Image.Resampling.LANCZOS)
final.save("static/logo.png", "PNG")
print("Saved 1:1 K logo with emerald background!")
