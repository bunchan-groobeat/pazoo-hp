# -*- coding: utf-8 -*-
# Pazoo の OGP画像（1200x630）を作る — 2026-09-09 太郎
# ★元は assets/img/logo.webp（342x106の横長ロゴ）を og:image にしていた。
#   LINE や X で共有すると余白だらけになる。CHECKLIST_KOKAI D分野は 1200x630 を求めている。
# 使い方: python tools/build-ogp.py
import io, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = r"C:\HQ\projects\pazoo-hp"
W, H = 1200, 630

BG = os.path.join(ROOT, "assets", "img", "main", "mv-jb64-front.webp")
LOGO = os.path.join(ROOT, "assets", "img", "logo.webp")
OUT = os.path.join(ROOT, "assets", "img", "ogp.jpg")

BOLD = r"C:\Windows\Fonts\YuGothB.ttc"
MED = r"C:\Windows\Fonts\YuGothM.ttc"

# 背景＝店の前のジムニー。1200x630に切り出す（顔になる部分を残すため中央やや上を使う）
im = Image.open(BG).convert("RGB")
sw, sh = im.size
scale = max(W / sw, H / sh)
im = im.resize((round(sw * scale), round(sh * scale)), Image.LANCZOS)
left = (im.width - W) // 2
top = max(0, int((im.height - H) * 0.42))
im = im.crop((left, top, left + W, top + H))

# 左から暗くする（文字を読ませるため）。全面を暗くはしない＝写真を殺さない
grad = Image.new("L", (W, 1))
for x in range(W):
    t = x / W
    grad.putpixel((x, 0), int(232 * max(0.0, 1.0 - (t / 0.72)) ** 1.25))
grad = grad.resize((W, H))
dark = Image.new("RGB", (W, H), (18, 17, 15))
im = Image.composite(dark, im, grad.point(lambda v: v))
im = Image.blend(im, dark, 0.06)

d = ImageDraw.Draw(im)
f_lead = ImageFont.truetype(MED, 34)
f_main = ImageFont.truetype(BOLD, 78)
f_sub = ImageFont.truetype(MED, 27)
f_tel = ImageFont.truetype(BOLD, 33)

X = 74
d.text((X, 128), "福島県須賀川市・国道4号沿い", font=f_lead, fill=(213, 205, 192))
d.text((X, 190), "ジムニー買うなら、", font=f_main, fill=(95, 201, 166))   # サイトと同じミント
d.text((X, 286), "Pazoo.", font=f_main, fill=(255, 255, 255))

d.line([(X, 410), (X + 92, 410)], fill=(125, 42, 61), width=4)
d.text((X, 436), "中古車販売・注文販売 ／ 車検・整備 ／ 板金・塗装 ／ 保険", font=f_sub, fill=(226, 220, 209))
d.text((X, 478), "軽自動車も普通車も。他店で買った車もお受けします。", font=f_sub, fill=(226, 220, 209))
d.text((X, 534), "0248-76-2077", font=f_tel, fill=(255, 255, 255))
d.text((X + 232, 541), "10:00-19:00 ／ 火曜定休", font=ImageFont.truetype(MED, 24), fill=(186, 178, 165))

# ロゴを右上に置く（白フチの台紙は付けない＝サイトと同じ扱い）
logo = Image.open(LOGO).convert("RGBA")
lw = 300
logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
sh_ = Image.new("RGBA", logo.size, (0, 0, 0, 0))
sh_.paste((0, 0, 0, 120), (0, 0), logo.split()[3])
sh_ = sh_.filter(ImageFilter.GaussianBlur(6))
im.paste(Image.alpha_composite(Image.new("RGBA", logo.size, (0, 0, 0, 0)), sh_).convert("RGB"),
         (W - lw - 60, 64), sh_)
im.paste(logo.convert("RGB"), (W - lw - 62, 60), logo)

im.save(OUT, "JPEG", quality=88, optimize=True)
print("書き出し:", OUT, im.size, str(round(os.path.getsize(OUT) / 1024)) + "KB")
