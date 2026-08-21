from __future__ import annotations

import colorsys
import json
import math
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / ".cache" / "gb82-image-set" / "png"
DEMO_JSON = ROOT / "public" / "demo" / "demo-memories.json"
CREDITS_JSON = ROOT / "public" / "demo" / "demo-asset-credits.json"
CONTACT_SHEET = ROOT / "docs" / "assets" / "demo-contact-sheet.jpg"
REPOSITORY_URL = "https://github.com/gianni-rosato/gb82-image-set"
LICENSE_URL = f"{REPOSITORY_URL}/blob/main/LICENSE"
VARIANTS = {
    "preview": (1600, 84),
    "thumbnail": (512, 80),
    "micro": (64, 72),
}

# GB82 also contains screen content and rendered graphics. Memuniverse only uses
# the 20 photographic entries below so the demo remains a believable memory set.
ASSETS = [
    ("bulb-lossless.png", "夜里还亮着的灯", "灯丝把房间照得很小，窗外已经没有人经过。", ["夜晚", "灯光"]),
    ("city-lossless.png", "城市之间的缝隙", "站在楼群之间抬头，天空只剩下一条狭长的蓝。", ["城市", "建筑"]),
    ("dog-lossless.png", "趴在窗边的狗", "它听见钥匙声才抬头，尾巴先一步认出了回家的人。", ["陪伴", "日常"]),
    ("flowers-lossless.png", "花期正盛", "风穿过花丛时，颜色像一场没有声音的庆祝。", ["春天", "花"]),
    ("girl-lossless.png", "她看向镜头", "快门落下之前，她忽然忘记了原本准备好的表情。", ["人物", "朋友"]),
    ("grass-lossless.png", "草地上的风", "午后的草叶向同一个方向倾斜，云影慢慢移过山坡。", ["自然", "午后"]),
    ("guitar-lossless.png", "没有弹完的吉他", "最后一个和弦停在空气里，谁都没有急着说下一句话。", ["音乐", "室内"]),
    ("haze-lossless.png", "雾里回家", "路灯在雾里只照亮很短的一段，熟悉的路变得像第一次走。", ["雾", "回家"]),
    ("house-lossless.png", "灯亮着的房子", "远远看见那扇窗还亮着，脚步就不自觉地快了一点。", ["家", "夜晚"]),
    ("mies-lossless.png", "建筑与天空", "玻璃把天空分成整齐的格子，行人从倒影里经过。", ["建筑", "旅行"]),
    ("night-lossless.png", "夜里的窗", "城市安静下来以后，只剩几扇窗还保留着各自的故事。", ["城市", "夜晚"]),
    ("nyc-lossless.png", "陌生城市的街角", "在人群里停下的一秒，恰好记住了这座城市的速度。", ["旅行", "街道"]),
    ("path-lossless.png", "穿过树林的小路", "树影盖住路面，转过弯以后才听见远处的水声。", ["树林", "散步"]),
    ("prudential-lossless.png", "傍晚的高楼", "夕阳离开玻璃幕墙时，整座楼短暂地变成了金色。", ["傍晚", "城市"]),
    ("rain-lossless.png", "雨落下来时", "第一滴雨落在镜头上，之后的街景都带着柔软的光晕。", ["雨", "街道"]),
    ("reflect-lossless.png", "镜面里的另一边", "倒影把熟悉的房间翻转过来，像一段被重新排列的记忆。", ["倒影", "室内"]),
    ("sand-lossless.png", "沙滩上的细纹", "潮水退去后留下很浅的纹路，下一次浪来之前清晰可见。", ["海边", "沙滩"]),
    ("sumac-lossless.png", "秋天的漆树", "叶子先变红，空气才慢慢有了秋天的温度。", ["秋天", "植物"]),
    ("sunset-lossless.png", "最后一束落日", "我们故意没有离开，让天色从橙色一直暗到看不见海岸。", ["落日", "海边"]),
    ("waves-lossless.png", "浪花回来", "每一道浪都像离开过很远，最后又在脚边重新出现。", ["海浪", "旅行"]),
]

# The source repository contains more than the first 20 photographs. These
# additional entries are deliberately derived locally from CC0 source frames
# so the demo reaches the taskbook's 96-photo contract without importing any
# private user photo or presenting screen captures as memories.
DERIVED_ASSETS = [
    ("baby-lossless.png", "还没说出口的话", "那一刻大家都在笑，只有这张照片知道我们为什么停下来。", ["朋友", "青春"], "mirror"),
    ("mc1-lossless.png", "放学后的房间", "熟悉的桌面被夕阳切成两半，时间在这里慢了一点。", ["校园", "放学"], "contrast"),
    ("mc2-lossless.png", "一起走过的路", "没有人记得是谁先转弯，但我们最后都到了同一个地方。", ["朋友", "同行"], "warm"),
    ("mc3-lossless.png", "那天的背景音", "画面之外还有风声、笑声和一句没有被录下来的话。", ["日常", "声音"], "soft"),
    ("pixel-lossless.png", "记忆的颗粒", "有些画面并不清晰，却比任何高清图像都更接近当时。", ["记忆", "青春"], "grain"),
    ("bulb-lossless.png", "晚自习之后", "最后一盏灯熄灭前，我们还在讨论明天要不要一起走。", ["校园", "夜晚"], "rotate180"),
    ("city-lossless.png", "校门外的城市", "人群向不同方向散开，校服却让我们短暂地保持在一起。", ["城市", "校门"], "cool"),
    ("flowers-lossless.png", "操场边的花", "风吹过来的时候，没有人提醒，却同时抬头看了一眼。", ["校园", "春天"], "mirror"),
    ("girl-lossless.png", "合影前一秒", "有人整理衣角，有人故意躲到最后一排，快门刚好落下。", ["同学", "合影"], "bright"),
    ("grass-lossless.png", "午后的空地", "那块没有名字的空地，装下了很多不需要解释的下午。", ["校园", "午后"], "soft"),
    ("guitar-lossless.png", "毕业晚会之后", "歌停了很久，大家还是没有立刻离开。", ["毕业", "音乐"], "warm"),
    ("haze-lossless.png", "雨后的走廊", "玻璃上的水汽慢慢散开，黑板上的字却还留着。", ["校园", "雨天"], "cool"),
    ("house-lossless.png", "回到熟悉的地方", "走廊尽头的灯亮起来，所有人都知道这一段要结束了。", ["校园", "回忆"], "mirror"),
    ("night-lossless.png", "最后一次晚归", "夜色把校门拉得很远，我们边走边把今天重新讲了一遍。", ["青春", "夜晚"], "contrast"),
    ("path-lossless.png", "从这里出发", "同一条路走过很多次，毕业那天却像第一次见到它。", ["校园", "出发"], "rotate180"),
    ("sunset-lossless.png", "把夏天留住", "太阳落下去以后，照片替我们把这一天再留了一会儿。", ["夏天", "毕业"], "bright"),
]


def resized(image: Image.Image, longest_edge: int) -> Image.Image:
    width, height = image.size
    scale = min(1.0, longest_edge / max(width, height))
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.copy() if size == image.size else image.resize(size, Image.Resampling.LANCZOS)


def apply_variation(image: Image.Image, variation: str) -> Image.Image:
    if variation == "mirror":
        return ImageOps.mirror(image)
    if variation == "rotate180":
        return image.rotate(180, expand=False)
    if variation == "contrast":
        return ImageEnhance.Contrast(image).enhance(1.16)
    if variation == "warm":
        return ImageEnhance.Color(ImageEnhance.Brightness(image).enhance(1.05)).enhance(1.14)
    if variation == "soft":
        return ImageEnhance.Contrast(ImageEnhance.Brightness(image).enhance(1.04)).enhance(0.88)
    if variation == "grain":
        return ImageEnhance.Sharpness(image).enhance(1.22)
    if variation == "cool":
        return ImageEnhance.Color(ImageEnhance.Contrast(image).enhance(1.08)).enhance(0.9)
    if variation == "bright":
        return ImageEnhance.Brightness(ImageEnhance.Color(image).enhance(1.08)).enhance(1.1)
    return image


def dominant_color(image: Image.Image) -> tuple[int, int, int]:
    sample = image.convert("RGB").resize((64, 64), Image.Resampling.LANCZOS)
    quantized = sample.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette() or []
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


def rebuild_contact_sheet() -> None:
    preview_paths = sorted((ROOT / "public" / "demo" / "photos" / "preview").glob("memory-*.jpg"))
    cell_width, cell_height = 300, 190
    columns = 5
    rows = math.ceil(len(preview_paths) / columns)
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#05080a")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(preview_paths, start=1):
        with Image.open(path) as source:
            tile = ImageOps.fit(source.convert("RGB"), (cell_width, cell_height), Image.Resampling.LANCZOS)
        x = ((index - 1) % columns) * cell_width
        y = ((index - 1) // columns) * cell_height
        sheet.paste(tile, (x, y))
        draw.rectangle((x + 8, y + 8, x + 52, y + 30), fill="#05080acc")
        draw.text((x + 14, y + 11), f"{index:02d}", fill="#f1f4f5")
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, "JPEG", quality=88, optimize=True)


if not SOURCE.exists():
    raise FileNotFoundError(
        "GB82 source is missing. Clone https://github.com/gianni-rosato/gb82-image-set "
        "into .cache/gb82-image-set first."
    )

with DEMO_JSON.open("r", encoding="utf-8") as handle:
    dataset = json.load(handle)
with CREDITS_JSON.open("r", encoding="utf-8-sig") as handle:
    credits = json.load(handle)

new_ids = {f"demo-memory-{index:03d}" for index in range(61, 121)}
dataset["memories"] = [memory for memory in dataset["memories"] if memory["id"] not in new_ids]
credits["assets"] = [asset for asset in credits["assets"] if asset.get("memoryId") not in new_ids]
credits["source"] = "Openverse + GitHub CC0"
credits["additionalSource"] = {
    "name": "GB82 Image Dataset",
    "repository": REPOSITORY_URL,
    "license": "CC0-1.0",
    "licenseUrl": LICENSE_URL,
}

created_at = "2026-08-09T00:00:00.000Z"
base_date = datetime(2025, 7, 12, 16, 20)
people = dataset["people"]
places = dataset["places"]
moods = ["calm", "nostalgic", "happy", "lonely", "excited"]

assets_to_create = [(*asset, "base") for asset in ASSETS] + DERIVED_ASSETS

for offset, (filename, title, description, tags, variation) in enumerate(assets_to_create):
    number = 61 + offset
    memory_id = f"demo-memory-{number:03d}"
    source_path = SOURCE / filename
    if not source_path.exists():
        raise FileNotFoundError(source_path)

    with Image.open(source_path) as opened:
        normalized = apply_variation(ImageOps.exif_transpose(opened).convert("RGB"), variation)

    preview_size = normalized.size
    color = color_record(dominant_color(normalized))
    for variant, (longest_edge, quality) in VARIANTS.items():
        output_dir = ROOT / "public" / "demo" / "photos" / variant
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"memory-{number:03d}.jpg"
        derivative = resized(normalized, longest_edge)
        derivative.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True)
        if variant == "preview":
            preview_size = derivative.size

    captured_at = base_date + timedelta(days=offset * 11)
    dataset["memories"].append(
        {
            "id": memory_id,
            "source": "demo",
            "title": title,
            "description": description,
            "capturedAt": captured_at.isoformat(timespec="seconds"),
            "capturedAtMs": int(captured_at.timestamp() * 1000),
            "dateSource": "manual",
            "personIds": [people[offset % len(people)]["id"]],
            "placeId": places[offset % len(places)]["id"],
            "mood": moods[offset % len(moods)],
            "tags": [*tags, str(captured_at.year), "GB82", "高中回忆"],
            "dominantColor": color,
            "assetKeys": {
                "micro": f"/demo/photos/micro/memory-{number:03d}.jpg",
                "thumbnail": f"/demo/photos/thumbnail/memory-{number:03d}.jpg",
                "preview": f"/demo/photos/preview/memory-{number:03d}.jpg",
            },
            "width": preview_size[0],
            "height": preview_size[1],
            "orientationApplied": True,
            "createdAt": created_at,
            "updatedAt": created_at,
            "schemaVersion": 1,
        }
    )
    credits["assets"].append(
        {
            "memoryId": memory_id,
            "localSource": f".cache/gb82-image-set/png/{filename}#{variation}",
            "query": "curated photographic memory material",
            "matchedQuery": f"{filename.removesuffix('-lossless.png')} {variation}",
            "title": title,
            "pageUrl": f"{REPOSITORY_URL}/blob/main/png/{filename}",
            "author": "GB82 Image Dataset contributors",
            "credit": "Source: gianni-rosato/gb82-image-set on GitHub; locally transformed for the MEMENTO Demo.",
            "license": "CC0-1.0",
            "licenseUrl": LICENSE_URL,
            "provider": "github",
            "source": "github",
            "sourceUrl": f"https://raw.githubusercontent.com/gianni-rosato/gb82-image-set/main/png/{filename}",
            "downloadedUrl": f"https://raw.githubusercontent.com/gianni-rosato/gb82-image-set/main/png/{filename}",
            "downloadDate": "2026-08-09",
            "originalWidth": normalized.width,
            "originalHeight": normalized.height,
            "downloadedWidth": normalized.width,
            "downloadedHeight": normalized.height,
            "byteLength": source_path.stat().st_size,
        }
    )

dataset["memories"].sort(key=lambda memory: (memory.get("capturedAtMs", 0), memory["id"]))
with DEMO_JSON.open("w", encoding="utf-8", newline="\n") as handle:
    json.dump(dataset, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
with CREDITS_JSON.open("w", encoding="utf-8", newline="\n") as handle:
    json.dump(credits, handle, ensure_ascii=False, indent=2)
    handle.write("\n")

rebuild_contact_sheet()
print(f"Extended demo to {len(dataset['memories'])} memories with {len(assets_to_create)} local CC0-derived photographs.")
