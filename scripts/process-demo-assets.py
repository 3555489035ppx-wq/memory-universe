from __future__ import annotations

import colorsys
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / ".cache" / "demo-source"
DEMO_JSON = ROOT / "public" / "demo" / "demo-memories.json"
CONTACT_SHEET = ROOT / "docs" / "assets" / "demo-contact-sheet.jpg"
VARIANTS = {
    "preview": (1600, 84),
    "thumbnail": (512, 80),
    "micro": (64, 72),
}


def resized(image: Image.Image, longest_edge: int) -> Image.Image:
    width, height = image.size
    scale = min(1.0, longest_edge / max(width, height))
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.copy() if size == image.size else image.resize(size, Image.Resampling.LANCZOS)


def dominant_color(image: Image.Image) -> tuple[int, int, int]:
    sample = image.convert("RGB").resize((64, 64), Image.Resampling.LANCZOS)
    quantized = sample.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    colors = quantized.getcolors() or []
    most_common = max(colors, key=lambda item: item[0])[1]
    offset = most_common * 3
    return tuple(palette[offset : offset + 3])


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    def linear(channel: int) -> float:
        value = channel / 255
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

    red, green, blue = (linear(channel) for channel in rgb)
    return round(0.2126 * red + 0.7152 * green + 0.0722 * blue, 4)


def color_record(rgb: tuple[int, int, int]) -> dict[str, object]:
    hue, lightness, saturation = colorsys.rgb_to_hls(*(channel / 255 for channel in rgb))
    return {
        "rgb": list(rgb),
        "hsl": [round(hue * 360, 1), round(saturation * 100, 1), round(lightness * 100, 1)],
        "luminance": relative_luminance(rgb),
        "algorithmVersion": 1,
    }


with DEMO_JSON.open("r", encoding="utf-8") as handle:
    dataset = json.load(handle)

preview_images: list[Image.Image] = []
for index, memory in enumerate(dataset["memories"], start=1):
    number = f"{index:03d}"
    source_path = SOURCE / f"memory-{number}.jpg"
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    with Image.open(source_path) as opened:
        normalized = ImageOps.exif_transpose(opened).convert("RGB")
    for variant, (longest_edge, quality) in VARIANTS.items():
        output_dir = ROOT / "public" / "demo" / "photos" / variant
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"memory-{number}.jpg"
        derivative = resized(normalized, longest_edge)
        derivative.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True)
        if variant == "preview":
            memory["width"], memory["height"] = derivative.size
            preview_images.append(derivative.copy())
        if variant == "micro":
            memory["dominantColor"] = color_record(dominant_color(derivative))
    memory["assetKeys"] = {
        "micro": f"/demo/photos/micro/memory-{number}.jpg",
        "thumbnail": f"/demo/photos/thumbnail/memory-{number}.jpg",
        "preview": f"/demo/photos/preview/memory-{number}.jpg",
    }

with DEMO_JSON.open("w", encoding="utf-8", newline="\n") as handle:
    json.dump(dataset, handle, ensure_ascii=False, indent=2)
    handle.write("\n")

cell_width, cell_height = 300, 190
columns = 5
rows = math.ceil(len(preview_images) / columns)
sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#11100e")
draw = ImageDraw.Draw(sheet)
for index, image in enumerate(preview_images, start=1):
    tile = ImageOps.fit(image, (cell_width, cell_height), Image.Resampling.LANCZOS)
    x = ((index - 1) % columns) * cell_width
    y = ((index - 1) // columns) * cell_height
    sheet.paste(tile, (x, y))
    draw.rectangle((x + 8, y + 8, x + 48, y + 30), fill="#11100ecc")
    draw.text((x + 14, y + 11), f"{index:02d}", fill="#f4eee3")

CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
sheet.save(CONTACT_SHEET, "JPEG", quality=88, optimize=True)
print(f"Processed {len(preview_images)} demo assets and wrote {CONTACT_SHEET}")
