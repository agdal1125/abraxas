# -*- coding: utf-8 -*-
"""
Abraxas Dream-Like Environment Test Builder for Blender 5.2+
Generates:
1. Concept PNGs in assets/source/concepts/dream/:
   - dream-plaza-bakery.png (from image-generator concept)
   - dream-palette-chips.png (9-color Dream palette chip sheet with hex codes)
2. 7 Dream-test pastel GLBs in client/public/assets/abraxas/dream-test/:
   - plaza-hall, bakery, tree-round, bush, flower-bed, well, streetlight
   Follows build_environment.py color rules (FLOAT_COLOR COLOR_0, single sRGB->Linear,
   single linear AO multiply, Draco compression, and ±6/255 sRGB color verification).
3. 4 Dream FX transparent PNG sprites (<=128x128 each, <=200KB total) in client/public/assets/abraxas/fx/:
   - fx-petal.png, fx-firefly.png, fx-glow.png, fx-mist.png
4. Quarter-view previews in assets/source/previews/dream/:
   - dream-test.png (Plaza + Bakery + 0.6m #FF7A59 character mannequin + subtle mist/glow)
   - dream-compare.png (Side-by-side comparison: Original vivid palette vs. Dream pastel palette)
"""

import bpy
import bmesh
import math
import os
import sys
import json
from mathutils import Vector, Euler

# -----------------------------------------------------------------------------
# Directory Paths
# -----------------------------------------------------------------------------
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCE_DREAM_DIR = os.path.join(ROOT_DIR, "assets", "source", "dream")
CONCEPTS_DREAM_DIR = os.path.join(ROOT_DIR, "assets", "source", "concepts", "dream")
PREVIEWS_DREAM_DIR = os.path.join(ROOT_DIR, "assets", "source", "previews", "dream")
PUBLIC_DREAM_DIR = os.path.join(ROOT_DIR, "client", "public", "assets", "abraxas", "dream-test")
PUBLIC_FX_DIR = os.path.join(ROOT_DIR, "client", "public", "assets", "abraxas", "fx")

BRAIN_CONCEPT_JPG = (
    r"C:\Users\jake1\.gemini\antigravity-cli\brain"
    r"\025f5463-41bd-4310-bf18-be6a6e3ac12f"
    r"\dream_plaza_bakery_concept_1793507900837.jpg"
)

TEST_KEYS = [
    "plaza-hall",
    "bakery",
    "tree-round",
    "bush",
    "flower-bed",
    "well",
    "streetlight",
]

# -----------------------------------------------------------------------------
# 9-Color Core Dream Palette (for Chip Sheet & Scene) + Supporting Object Shades
# -----------------------------------------------------------------------------
DREAM_CORE_9_CHIPS = [
    {"role_ko": "하늘 (Sky)", "label": "SKY", "hex": "#DDD8F1", "desc": "안개 라벤더"},
    {"role_ko": "안개 (Mist)", "label": "MIST", "hex": "#EDE8F8", "desc": "연보라 안개빛"},
    {"role_ko": "지면 풀 (Grass)", "label": "GRASS", "hex": "#B5D9C4", "desc": "파스텔 민트 풀"},
    {"role_ko": "흙길 (Path)", "label": "PATH", "hex": "#EBD3B9", "desc": "따뜻한 모래 복숭아"},
    {"role_ko": "건물 벽 (Wall)", "label": "WALL", "hex": "#FFF8EC", "desc": "따뜻한 크림"},
    {"role_ko": "지붕 (Roof)", "label": "ROOF", "hex": "#E7B6AB", "desc": "복숭아 테라코타"},
    {"role_ko": "나뭇잎 (Leaves)", "label": "LEAVES", "hex": "#98C9B5", "desc": "세이지 민트 수관"},
    {"role_ko": "물 (Water)", "label": "WATER", "hex": "#A9D8D3", "desc": "맑은 아쿠아 민트"},
    {"role_ko": "빛 (Light)", "label": "LIGHT", "hex": "#FFE8A3", "desc": "은은한 별빛 앰버"},
]

DREAM_PALETTE = {
    "sky": "#DDD8F1",
    "mist": "#EDE8F8",
    "ground_grass": "#B5D9C4",
    "cream": "#FFF8EC",
    "cream_warm": "#F7EFE2",
    "cream_shadow": "#E8DEC8",
    "ink": "#5A4E66",
    "wood": "#C8A992",
    "wood_light": "#DEC3AE",
    "wood_dark": "#9E8270",
    "stone": "#CFC8DC",
    "stone_light": "#E2DCEE",
    "stone_dark": "#B3AAC4",
    "grass": "#98C9B5",
    "grass_dark": "#7EB39D",
    "grass_light": "#B5D9C4",
    "path": "#EBD3B9",
    "sea": "#A9D8D3",
    "coral": "#E7B6AB",
    "coral_soft": "#EFC7BE",
    "gold": "#FFE8A3",
    "gold_light": "#FFF3C9",
    "violet": "#C8B6E8",
    "violet_muted": "#B5A3D6",
    "violet_slate": "#9585B5",
    "teal": "#8FD1C8",
    "teal_muted": "#82BEB6",
    "teal_dark": "#689E97",
    "brick": "#E2A89B",
    "brick_dark": "#C98F82",
    "blossom_pink": "#E8BDD4",
    "blossom_white": "#FAF5FF",
}

ORIG_PALETTE = {
    "cream": "#FFF8EC",
    "cream_warm": "#F5E9D4",
    "cream_shadow": "#E5D4B7",
    "ink": "#3B2A22",
    "wood": "#9B7355",
    "wood_light": "#B88C6A",
    "wood_dark": "#6E4E37",
    "stone": "#B1ADA2",
    "stone_light": "#C7C3B8",
    "stone_dark": "#878378",
    "grass": "#5CC96B",
    "grass_dark": "#3A9E57",
    "grass_light": "#7EE089",
    "path": "#F2B35E",
    "sea": "#5BC0F8",
    "coral": "#FF7A59",
    "coral_soft": "#E06B4F",
    "gold": "#FFB020",
    "gold_light": "#FFD166",
    "violet": "#8E6BFF",
    "violet_muted": "#7A68A6",
    "violet_slate": "#625684",
    "teal": "#14B8A6",
    "teal_muted": "#4B9E96",
    "teal_dark": "#35736D",
    "brick": "#C86D51",
    "brick_dark": "#9E5038",
    "blossom_pink": "#FF8FA3",
    "blossom_white": "#FFFDF9",
}

CHARACTER_REP_HEX = "#FF7A59"
CHARACTER_HEAD_HEX = "#FFF8EC"
CHARACTER_EYE_HEX = "#3B2A22"

# Active palette reference used by builder functions
PALETTE = dict(DREAM_PALETTE)


# -----------------------------------------------------------------------------
# Color Space Utilities (sRGB <-> Linear sRGB)
# -----------------------------------------------------------------------------
def srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c: float) -> float:
    c = max(0.0, min(1.0, c))
    if c <= 0.0031308:
        return c * 12.92
    return 1.055 * (c ** (1.0 / 2.4)) - 0.055


def hex_to_linear_rgba(hex_str: str, tint: float = 1.0):
    h = hex_str.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    rl = max(0.0, min(1.0, srgb_to_linear(r) * tint))
    gl = max(0.0, min(1.0, srgb_to_linear(g) * tint))
    bl = max(0.0, min(1.0, srgb_to_linear(b) * tint))
    return (rl, gl, bl, 1.0)


def hex_to_srgb_float(hex_str: str):
    h = hex_str.lstrip("#")
    return (
        int(h[0:2], 16) / 255.0,
        int(h[2:4], 16) / 255.0,
        int(h[4:6], 16) / 255.0,
    )


def hex_to_srgb_255(hex_str: str):
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# -----------------------------------------------------------------------------
# Asset Specifications (Identical to build_environment.py §3 Contract)
# -----------------------------------------------------------------------------
ASSET_SPECS = {
    "plaza-hall": {
        "dims": (1.80, 1.50, 1.60),
        "max_tri": 5000,
        "max_kib": 180,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.85, "halfZ": 0.70}],
    },
    "bakery": {
        "dims": (1.60, 1.40, 1.50),
        "max_tri": 5000,
        "max_kib": 180,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.75, "halfZ": 0.65}],
    },
    "tree-round": {
        "dims": (1.02, 1.02, 1.50),
        "max_tri": 1200,
        "max_kib": 60,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.16}],
    },
    "bush": {
        "dims": (0.60, 0.50, 0.40),
        "max_tri": 500,
        "max_kib": 30,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.22}],
    },
    "flower-bed": {
        "dims": (0.70, 0.50, 0.25),
        "max_tri": 600,
        "max_kib": 35,
        "collision": [],
    },
    "well": {
        "dims": (0.80, 0.80, 0.80),
        "max_tri": 1500,
        "max_kib": 70,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.38}],
    },
    "streetlight": {
        "dims": (0.34, 0.22, 1.00),
        "max_tri": 650,
        "max_kib": 40,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.10}],
    },
}


# -----------------------------------------------------------------------------
# Minimal 5x7 Bitmap Font for Palette Chip Hex Labels
# -----------------------------------------------------------------------------
FONT_5X7 = {
    "#": ["01010", "11111", "01010", "01010", "11111", "01010", "00000"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def draw_text_on_buffer(buf, width, height, text, start_x, top_y, scale, rgba):
    cursor_x = start_x
    for ch in text.upper():
        glyph = FONT_5X7.get(ch, FONT_5X7[" "])
        for gy, row_str in enumerate(glyph):
            for gx, bit in enumerate(row_str):
                if bit == "1":
                    for sy in range(scale):
                        py = height - 1 - (top_y + gy * scale + sy)
                        if py < 0 or py >= height:
                            continue
                        for sx in range(scale):
                            px = cursor_x + gx * scale + sx
                            if 0 <= px < width:
                                idx = (py * width + px) * 4
                                buf[idx : idx + 4] = rgba
        cursor_x += 6 * scale


def fill_rounded_rect(buf, width, height, x0, y0_top, rw, rh, radius, rgba):
    for dy in range(rh):
        py = height - 1 - (y0_top + dy)
        if py < 0 or py >= height:
            continue
        for dx in range(rw):
            px = x0 + dx
            if px < 0 or px >= width:
                continue
            inside = True
            if dx < radius and dy < radius:
                inside = (dx - radius) ** 2 + (dy - radius) ** 2 <= radius ** 2
            elif dx >= rw - radius and dy < radius:
                inside = (dx - (rw - radius - 1)) ** 2 + (dy - radius) ** 2 <= radius ** 2
            elif dx < radius and dy >= rh - radius:
                inside = (dx - radius) ** 2 + (dy - (rh - radius - 1)) ** 2 <= radius ** 2
            elif dx >= rw - radius and dy >= rh - radius:
                inside = (dx - (rw - radius - 1)) ** 2 + (dy - (rh - radius - 1)) ** 2 <= radius ** 2
            if inside:
                idx = (py * width + px) * 4
                buf[idx : idx + 4] = rgba


# -----------------------------------------------------------------------------
# Step 1: Sync Concept Art & Build 9-Color Palette Chip Sheet
# -----------------------------------------------------------------------------
def generate_concepts():
    os.makedirs(CONCEPTS_DREAM_DIR, exist_ok=True)
    concept_a_dst = os.path.join(CONCEPTS_DREAM_DIR, "dream-plaza-bakery.png")
    if os.path.exists(BRAIN_CONCEPT_JPG):
        img = bpy.data.images.load(BRAIN_CONCEPT_JPG, check_existing=True)
        w, h = img.size[0], img.size[1]
        if w > 1536 or h > 1536:
            scale = 1536.0 / max(w, h)
            img.scale(int(round(w * scale)), int(round(h * scale)))
        img.file_format = 'PNG'
        img.filepath_raw = concept_a_dst
        img.save()
        bpy.data.images.remove(img)
        print(f"[INFO] Saved Concept (a) to {concept_a_dst}")
    else:
        print(f"[WARN] Concept source not found: {BRAIN_CONCEPT_JPG}")

    # Concept (b): 9-Color Palette Chip Sheet (1024x1024 PNG)
    W, H = 1024, 1024
    bg_r, bg_g, bg_b = hex_to_srgb_float("#FAF7FC")
    buf = [bg_r, bg_g, bg_b, 1.0] * (W * H)

    ink_rgba = (*hex_to_srgb_float("#3B2A22"), 1.0)
    sub_rgba = (*hex_to_srgb_float("#6D5F7A"), 1.0)
    card_rgba = (*hex_to_srgb_float("#FFFFFF"), 1.0)
    border_rgba = (*hex_to_srgb_float("#E2DCEE"), 1.0)

    draw_text_on_buffer(buf, W, H, "ABRAXAS DREAM PALETTE 9", 148, 36, 5, ink_rgba)

    card_w, card_h = 280, 270
    margin_x, margin_y = 56, 104
    gap_x, gap_y = 36, 32

    for idx, chip in enumerate(DREAM_CORE_9_CHIPS):
        row = idx // 3
        col = idx % 3
        cx = margin_x + col * (card_w + gap_x)
        cy = margin_y + row * (card_h + gap_y)

        fill_rounded_rect(buf, W, H, cx - 3, cy - 3, card_w + 6, card_h + 6, 18, border_rgba)
        fill_rounded_rect(buf, W, H, cx, cy, card_w, card_h, 16, card_rgba)

        sw_rgba = (*hex_to_srgb_float(chip["hex"]), 1.0)
        fill_rounded_rect(buf, W, H, cx + 16, cy + 16, card_w - 32, 166, 12, sw_rgba)

        draw_text_on_buffer(buf, W, H, chip["label"], cx + 22, cy + 196, 3, sub_rgba)
        draw_text_on_buffer(buf, W, H, chip["hex"], cx + 22, cy + 226, 4, ink_rgba)

    chip_dst = os.path.join(CONCEPTS_DREAM_DIR, "dream-palette-chips.png")
    chip_img = bpy.data.images.new("DreamPaletteChips", width=W, height=H, alpha=True)
    chip_img.pixels[:] = buf
    chip_img.file_format = 'PNG'
    chip_img.filepath_raw = chip_dst
    chip_img.save()
    bpy.data.images.remove(chip_img)
    print(f"[INFO] Saved Concept (b) 9-color palette chip sheet to {chip_dst}")
    return [concept_a_dst, chip_dst]


# -----------------------------------------------------------------------------
# Step 3: Generate 4 Transparent Dream FX Sprites (<=128x128, <=200KB total)
# -----------------------------------------------------------------------------
def generate_fx_sprites():
    os.makedirs(PUBLIC_FX_DIR, exist_ok=True)
    S = 128
    fx_info = {}

    # 1. fx-petal.png: Soft floating blossom petal with gentle notch & alpha falloff
    petal_buf = [0.0] * (S * S * 4)
    p_inner = hex_to_srgb_float("#F7DFEC")
    p_outer = hex_to_srgb_float("#E8BDD4")
    for y in range(S):
        ny = (y - S * 0.5) / (S * 0.40)
        for x in range(S):
            nx = (x - S * 0.5) / (S * 0.40)
            # Rotate 30 degrees for natural floating orientation
            rx = nx * 0.866 - ny * 0.500
            ry = nx * 0.500 + ny * 0.866
            # Teardrop petal with slight top notch
            width_mod = max(0.25, 0.78 + 0.28 * ry - 0.35 * (ry ** 2))
            notch = 0.14 * math.exp(-((rx * 4.5) ** 2)) * max(0.0, ry)
            dist = math.sqrt((rx / width_mod) ** 2 + ((ry + notch) * 0.92) ** 2)
            if dist < 1.0:
                alpha = max(0.0, min(1.0, (1.0 - dist) / 0.18))
                alpha = alpha * alpha * (3.0 - 2.0 * alpha) * 0.92
                t = max(0.0, min(1.0, dist * 0.85))
                r = p_inner[0] * (1.0 - t) + p_outer[0] * t
                g = p_inner[1] * (1.0 - t) + p_outer[1] * t
                b = p_inner[2] * (1.0 - t) + p_outer[2] * t
                idx = (y * S + x) * 4
                petal_buf[idx : idx + 4] = [r, g, b, alpha]

    # 2. fx-firefly.png: Warm starlight core + soft amber halo
    firefly_buf = [0.0] * (S * S * 4)
    f_core = hex_to_srgb_float("#FFFDF2")
    f_halo = hex_to_srgb_float("#FFE8A3")
    for y in range(S):
        ny = (y - S * 0.5) / (S * 0.5)
        for x in range(S):
            nx = (x - S * 0.5) / (S * 0.5)
            d = math.sqrt(nx * nx + ny * ny)
            if d < 1.0:
                core = math.exp(-((d / 0.18) ** 2))
                halo = math.exp(-((d / 0.48) ** 2)) * (1.0 - d) ** 2
                alpha = max(0.0, min(1.0, core * 0.95 + halo * 0.55))
                t = max(0.0, min(1.0, d / 0.35))
                r = f_core[0] * (1.0 - t) + f_halo[0] * t
                g = f_core[1] * (1.0 - t) + f_halo[1] * t
                b = f_core[2] * (1.0 - t) + f_halo[2] * t
                idx = (y * S + x) * 4
                firefly_buf[idx : idx + 4] = [r, g, b, alpha]

    # 3. fx-glow.png: Smooth radial glow (zero box border, soft warm-lavender light)
    glow_buf = [0.0] * (S * S * 4)
    g_inner = hex_to_srgb_float("#FFF3C9")
    g_outer = hex_to_srgb_float("#EDE8F8")
    for y in range(S):
        ny = (y - S * 0.5) / (S * 0.5)
        for x in range(S):
            nx = (x - S * 0.5) / (S * 0.5)
            d = math.sqrt(nx * nx + ny * ny)
            if d < 1.0:
                falloff = (1.0 - d * d) ** 2.6
                alpha = falloff * 0.72
                t = max(0.0, min(1.0, d))
                r = g_inner[0] * (1.0 - t) + g_outer[0] * t
                g = g_inner[1] * (1.0 - t) + g_outer[1] * t
                b = g_inner[2] * (1.0 - t) + g_outer[2] * t
                idx = (y * S + x) * 4
                glow_buf[idx : idx + 4] = [r, g, b, alpha]

    # 4. fx-mist.png: Soft multi-lobe horizontal mist wisp
    mist_buf = [0.0] * (S * S * 4)
    m_col1 = hex_to_srgb_float("#EDE8F8")
    m_col2 = hex_to_srgb_float("#DDD8F1")
    lobes = [
        (-0.22, -0.02, 0.42, 0.26, 0.55),
        (0.05, 0.04, 0.46, 0.28, 0.65),
        (0.26, -0.04, 0.38, 0.24, 0.50),
        (-0.08, -0.08, 0.50, 0.22, 0.45),
    ]
    for y in range(S):
        ny = (y - S * 0.5) / (S * 0.5)
        for x in range(S):
            nx = (x - S * 0.5) / (S * 0.5)
            edge_fade = max(0.0, 1.0 - max(abs(nx), abs(ny)) ** 2.2)
            density = 0.0
            for lx, ly, rx_s, ry_s, weight in lobes:
                ld2 = ((nx - lx) / rx_s) ** 2 + ((ny - ly) / ry_s) ** 2
                if ld2 < 1.0:
                    density += weight * ((1.0 - ld2) ** 2)
            alpha = max(0.0, min(0.58, density * edge_fade * 0.52))
            if alpha > 1e-4:
                t = 0.5 + 0.5 * ny
                r = m_col1[0] * t + m_col2[0] * (1.0 - t)
                g = m_col1[1] * t + m_col2[1] * (1.0 - t)
                b = m_col1[2] * t + m_col2[2] * (1.0 - t)
                idx = (y * S + x) * 4
                mist_buf[idx : idx + 4] = [r, g, b, alpha]

    sprites = {
        "fx-petal.png": petal_buf,
        "fx-firefly.png": firefly_buf,
        "fx-glow.png": glow_buf,
        "fx-mist.png": mist_buf,
    }

    total_fx_bytes = 0
    for fname, pix_buf in sprites.items():
        out_path = os.path.join(PUBLIC_FX_DIR, fname)
        img = bpy.data.images.new(fname, width=S, height=S, alpha=True)
        img.pixels[:] = pix_buf
        img.file_format = 'PNG'
        img.filepath_raw = out_path
        img.save()
        bpy.data.images.remove(img)
        bsize = os.path.getsize(out_path)
        total_fx_bytes += bsize
        fx_info[fname] = {
            "path": f"assets/abraxas/fx/{fname}",
            "width": S,
            "height": S,
            "bytes": bsize,
        }
        print(f"[FX OK] {fname:16s} | {S}x{S} RGBA | {bsize} bytes")

    assert total_fx_bytes <= 200 * 1024, f"FX total bytes {total_fx_bytes} > 200KB"
    print(f"[INFO] All 4 FX sprites saved ({total_fx_bytes} bytes total, limit <= 204800 bytes)")
    return fx_info


# -----------------------------------------------------------------------------
# Shared Material Creation & PartBuilder (Identical Rules to build_environment.py)
# -----------------------------------------------------------------------------
def get_or_create_diorama_material(name="AbraxasDreamEnvMat", roughness=0.85):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_backface_culling = True
    nt = mat.node_tree
    nt.nodes.clear()

    out_node = nt.nodes.new("ShaderNodeOutputMaterial")
    out_node.location = (300, 0)

    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = roughness
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.25

    vcol = nt.nodes.new("ShaderNodeVertexColor")
    vcol.location = (-250, 0)
    vcol.layer_name = "COLOR_0"

    nt.links.new(vcol.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])
    return mat


class PartBuilder:
    def __init__(self):
        self.parts = []

    def _finalize_part_mesh(self, bm, color_hex, bevel_width=0.015, bevel_segments=1, smooth=False):
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        temp_mesh = bpy.data.meshes.new("_temp_part")
        bm.to_mesh(temp_mesh)
        bm.free()

        temp_obj = bpy.data.objects.new("_temp_part_obj", temp_mesh)
        bpy.context.collection.objects.link(temp_obj)

        if bevel_width > 0.0 and bevel_segments > 0:
            mod = temp_obj.modifiers.new("Bevel", 'BEVEL')
            mod.width = bevel_width
            mod.segments = bevel_segments
            mod.limit_method = 'ANGLE'
            mod.angle_limit = math.radians(32.0)
            if hasattr(mod, "harden_normals"):
                mod.harden_normals = False

        depsgraph = bpy.context.evaluated_depsgraph_get()
        eval_obj = temp_obj.evaluated_get(depsgraph)
        final_mesh = bpy.data.meshes.new_from_object(eval_obj)

        bpy.context.collection.objects.unlink(temp_obj)
        bpy.data.objects.remove(temp_obj)
        bpy.data.meshes.remove(temp_mesh)

        for poly in final_mesh.polygons:
            poly.use_smooth = smooth

        self.parts.append((final_mesh, color_hex))

    def add_box(self, size, center, color_hex, rot_euler=(0.0, 0.0, 0.0), bevel=0.015, segments=1, smooth=False, taper_top=(1.0, 1.0)):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        sx, sy, sz = size
        for v in bm.verts:
            tx = taper_top[0] if v.co.z > 0 else 1.0
            ty = taper_top[1] if v.co.z > 0 else 1.0
            v.co.x *= sx * tx
            v.co.y *= sy * ty
            v.co.z *= sz
        if any(abs(a) > 1e-5 for a in rot_euler):
            rot_mat = Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
            bmesh.ops.transform(bm, matrix=rot_mat, verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
        self._finalize_part_mesh(bm, color_hex, bevel_width=bevel, bevel_segments=segments, smooth=smooth)

    def add_prism_roof(self, width, depth, height, center_bottom, color_hex, ridge_scale=0.92, bevel=0.02, segments=1, axis='Y'):
        bm = bmesh.new()
        hw, hd = width * 0.5, depth * 0.5
        if axis == 'Y':
            v0 = bm.verts.new((-hw, -hd, 0.0))
            v1 = bm.verts.new((hw, -hd, 0.0))
            v2 = bm.verts.new((hw, hd, 0.0))
            v3 = bm.verts.new((-hw, hd, 0.0))
            v4 = bm.verts.new((0.0, -hd * ridge_scale, height))
            v5 = bm.verts.new((0.0, hd * ridge_scale, height))
            bm.faces.new((v0, v3, v2, v1))
            bm.faces.new((v0, v1, v4))
            bm.faces.new((v2, v3, v5))
            bm.faces.new((v1, v2, v5, v4))
            bm.faces.new((v3, v0, v4, v5))
        else:
            v0 = bm.verts.new((-hw, -hd, 0.0))
            v1 = bm.verts.new((hw, -hd, 0.0))
            v2 = bm.verts.new((hw, hd, 0.0))
            v3 = bm.verts.new((-hw, hd, 0.0))
            v4 = bm.verts.new((-hw * ridge_scale, 0.0, height))
            v5 = bm.verts.new((hw * ridge_scale, 0.0, height))
            bm.faces.new((v0, v3, v2, v1))
            bm.faces.new((v0, v1, v5, v4))
            bm.faces.new((v2, v3, v4, v5))
            bm.faces.new((v1, v2, v5))
            bm.faces.new((v3, v0, v4))
        bmesh.ops.translate(bm, vec=Vector(center_bottom), verts=bm.verts)
        self._finalize_part_mesh(bm, color_hex, bevel_width=bevel, bevel_segments=segments, smooth=False)

    def add_cylinder(self, radius_bottom, radius_top, depth, center, color_hex, vertices=12, rot_euler=(0.0, 0.0, 0.0), bevel=0.012, segments=1, smooth=True, scale_xy=(1.0, 1.0)):
        bm = bmesh.new()
        bmesh.ops.create_cone(
            bm,
            cap_ends=True,
            cap_tris=False,
            segments=vertices,
            radius1=radius_bottom,
            radius2=radius_top,
            depth=depth,
        )
        for v in bm.verts:
            v.co.x *= scale_xy[0]
            v.co.y *= scale_xy[1]
        if any(abs(a) > 1e-5 for a in rot_euler):
            rot_mat = Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
            bmesh.ops.transform(bm, matrix=rot_mat, verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
        self._finalize_part_mesh(bm, color_hex, bevel_width=bevel, bevel_segments=segments, smooth=smooth)

    def add_sphere(self, radius, center, color_hex, subdivisions=2, scale=(1.0, 1.0, 1.0), rot_euler=(0.0, 0.0, 0.0), smooth=True, bevel=0.0):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
        for v in bm.verts:
            v.co.x *= scale[0]
            v.co.y *= scale[1]
            v.co.z *= scale[2]
        if any(abs(a) > 1e-5 for a in rot_euler):
            rot_mat = Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
            bmesh.ops.transform(bm, matrix=rot_mat, verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
        self._finalize_part_mesh(bm, color_hex, bevel_width=bevel, bevel_segments=1 if bevel > 0 else 0, smooth=smooth)

    def build_combined_object(self, key: str, target_dims, lock_x_bounds=False, z_ground_offset=0.0):
        bm = bmesh.new()
        pal_layer = bm.faces.layers.int.new("pal_idx")
        palette_list = []

        for part_mesh, color_hex in self.parts:
            pal_idx = len(palette_list)
            palette_list.append(color_hex)

            part_bm = bmesh.new()
            part_bm.from_mesh(part_mesh)

            vert_map = {}
            for v in part_bm.verts:
                vert_map[v.index] = bm.verts.new(v.co)
            bm.verts.ensure_lookup_table()

            for f in part_bm.faces:
                try:
                    new_f = bm.faces.new([vert_map[v.index] for v in f.verts])
                    new_f.smooth = f.smooth
                    new_f[pal_layer] = pal_idx
                except ValueError:
                    pass
            part_bm.free()
            bpy.data.meshes.remove(part_mesh)
        self.parts.clear()

        bmesh.ops.triangulate(bm, faces=bm.faces)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

        xs = [v.co.x for v in bm.verts]
        ys = [v.co.y for v in bm.verts]
        zs = [v.co.z for v in bm.verts]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        min_z, max_z = min(zs), max(zs)

        cur_w = max(1e-4, max_x - min_x)
        cur_d = max(1e-4, max_y - min_y)
        cur_h = max(1e-4, max_z - min_z)

        tw, td, th = target_dims
        cx = (min_x + max_x) * 0.5
        cy = (min_y + max_y) * 0.5

        sx = 1.0 if lock_x_bounds else (tw / cur_w)
        sy = td / cur_d
        sz = th / cur_h

        for v in bm.verts:
            if not lock_x_bounds:
                v.co.x = (v.co.x - cx) * sx
            v.co.y = (v.co.y - cy) * sy
            v.co.z = (v.co.z - min_z) * sz + z_ground_offset

        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        face_part_indices = [f[pal_layer] for f in bm.faces]
        bm.faces.layers.int.remove(pal_layer)

        mesh = bpy.data.meshes.new(key)
        bm.to_mesh(mesh)
        bm.free()

        part_min_z = {}
        part_max_z = {}
        for poly in mesh.polygons:
            p_idx = face_part_indices[poly.index]
            for v_idx in poly.vertices:
                vz = mesh.vertices[v_idx].co.z
                if p_idx not in part_min_z or vz < part_min_z[p_idx]:
                    part_min_z[p_idx] = vz
                if p_idx not in part_max_z or vz > part_max_z[p_idx]:
                    part_max_z[p_idx] = vz

        col_attr = mesh.color_attributes.new(name="COLOR_0", type='FLOAT_COLOR', domain='CORNER')
        mesh.color_attributes.active_color = col_attr
        mesh.color_attributes.render_color_index = 0

        for poly in mesh.polygons:
            p_idx = face_part_indices[poly.index]
            color_hex = palette_list[p_idx]
            base_r, base_g, base_b, _ = hex_to_linear_rgba(color_hex, 1.0)
            normal_ao = 0.88 + 0.12 * max(0.0, min(1.0, poly.normal.z + 1.0))
            p_min = part_min_z[p_idx]
            p_span = max(1e-4, part_max_z[p_idx] - p_min)
            for loop_idx in poly.loop_indices:
                v_idx = mesh.loops[loop_idx].vertex_index
                vz = mesh.vertices[v_idx].co.z
                t_part_z = max(0.0, min(1.0, (vz - p_min) / p_span))
                part_ao = 0.85 + 0.15 * min(1.0, t_part_z / 0.45)
                ao = max(0.78, min(1.0, part_ao * normal_ao))
                col_attr.data[loop_idx].color = (
                    base_r * ao,
                    base_g * ao,
                    base_b * ao,
                    1.0,
                )

        mat = get_or_create_diorama_material("AbraxasDreamEnvMat", roughness=0.85)
        mesh.materials.append(mat)

        obj = bpy.data.objects.new(key, mesh)
        bpy.context.collection.objects.link(obj)
        obj["used_palette_colors"] = sorted(list(set(palette_list)))
        return obj


# -----------------------------------------------------------------------------
# 7 Asset Builders (Exact Geometry/Dimensions/Origin from build_environment.py)
# -----------------------------------------------------------------------------
def build_plaza_hall(pb: PartBuilder):
    pb.add_box((1.74, 1.42, 0.14), (0.0, 0.0, 0.07), PALETTE["stone"], bevel=0.015)
    pb.add_box((0.76, 0.18, 0.10), (0.0, -0.68, 0.05), PALETTE["stone_light"], bevel=0.012)
    pb.add_box((1.60, 1.28, 0.78), (0.0, 0.0, 0.50), PALETTE["cream"], bevel=0.015)
    for sx in (-0.77, 0.77):
        for sy in (-0.61, 0.61):
            pb.add_box((0.12, 0.12, 0.80), (sx, sy, 0.50), PALETTE["wood"], bevel=0.012)
    pb.add_box((1.80, 1.50, 0.16), (0.0, 0.0, 0.94), PALETTE["stone_dark"], bevel=0.02, taper_top=(0.94, 0.94))
    pb.add_box((1.50, 1.24, 0.16), (0.0, 0.0, 1.08), PALETTE["stone"], bevel=0.02, taper_top=(0.90, 0.90))
    pb.add_box((1.16, 0.96, 0.12), (0.0, 0.0, 1.20), PALETTE["stone_light"], bevel=0.018)
    pb.add_box((0.38, 0.38, 0.24), (0.0, 0.0, 1.34), PALETTE["cream_warm"], bevel=0.012)
    pb.add_prism_roof(0.46, 0.46, 0.18, (0.0, 0.0, 1.44), PALETTE["stone_dark"], bevel=0.015, axis='X')
    pb.add_cylinder(0.11, 0.11, 0.05, (0.0, -0.19, 1.35), PALETTE["gold_light"], vertices=10, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.005)
    pb.add_box((0.62, 0.08, 0.56), (0.0, -0.64, 0.40), PALETTE["wood_dark"], bevel=0.012)
    pb.add_box((0.26, 0.08, 0.50), (-0.14, -0.65, 0.38), PALETTE["wood"], bevel=0.01)
    pb.add_box((0.26, 0.08, 0.50), (0.14, -0.65, 0.38), PALETTE["wood"], bevel=0.01)
    for i, bx in enumerate((-0.52, -0.18, 0.18, 0.52)):
        col = PALETTE["coral"] if i % 2 == 0 else PALETTE["gold"]
        pb.add_box((0.28, 0.06, 0.10), (bx, -0.66, 0.78), col, bevel=0.012)


def build_bakery(pb: PartBuilder):
    pb.add_box((1.50, 1.32, 0.12), (0.0, 0.0, 0.06), PALETTE["stone"], bevel=0.015)
    pb.add_box((1.34, 1.18, 0.86), (0.04, 0.0, 0.52), PALETTE["cream"], bevel=0.015)
    for sx in (-0.61, 0.69):
        for sy in (-0.57, 0.57):
            pb.add_box((0.10, 0.10, 0.86), (sx, sy, 0.52), PALETTE["wood"], bevel=0.01)
    pb.add_box((1.52, 1.36, 0.14), (0.02, 0.0, 0.98), PALETTE["wood"], bevel=0.02)
    pb.add_cylinder(0.32, 0.32, 0.12, (-0.05, -0.58, 1.06), PALETTE["gold"], vertices=12, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.012, scale_xy=(1.4, 0.65))
    pb.add_cylinder(0.26, 0.20, 0.65, (-0.58, 0.05, 0.40), PALETTE["brick"], vertices=10, bevel=0.015)
    pb.add_cylinder(0.16, 0.20, 0.45, (0.35, 0.25, 1.25), PALETTE["brick"], vertices=10, bevel=0.015)
    pb.add_cylinder(0.19, 0.19, 0.08, (0.35, 0.25, 1.46), PALETTE["brick_dark"], vertices=10, bevel=0.01)
    for i in range(5):
        ax = -0.38 + i * 0.16
        col = PALETTE["coral"] if i % 2 == 0 else PALETTE["gold"]
        pb.add_box((0.16, 0.28, 0.08), (ax, -0.66, 0.74), col, rot_euler=(0.35, 0.0, 0.0), bevel=0.01)
    pb.add_box((0.56, 0.08, 0.36), (-0.18, -0.59, 0.44), PALETTE["wood_dark"], bevel=0.01)
    pb.add_box((0.46, 0.06, 0.26), (-0.18, -0.615, 0.44), PALETTE["gold_light"], bevel=0.008)
    pb.add_box((0.32, 0.08, 0.54), (0.36, -0.59, 0.38), PALETTE["wood"], bevel=0.01)
    pb.add_box((0.20, 0.05, 0.05), (0.72, -0.45, 0.72), PALETTE["ink"], bevel=0.006)
    pb.add_cylinder(0.11, 0.11, 0.05, (0.74, -0.45, 0.56), PALETTE["gold"], vertices=10, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.008)


def build_tree_round(pb: PartBuilder):
    pb.add_cylinder(0.15, 0.11, 0.68, (0.0, 0.0, 0.34), PALETTE["wood"], vertices=10, bevel=0.01)
    pb.add_sphere(0.46, (0.0, 0.0, 1.02), PALETTE["grass"], subdivisions=2, scale=(1.05, 1.05, 0.95))
    pb.add_sphere(0.32, (-0.22, -0.14, 0.92), PALETTE["grass_dark"], subdivisions=2)
    pb.add_sphere(0.30, (0.24, 0.12, 0.96), PALETTE["grass_light"], subdivisions=2)
    pb.add_sphere(0.28, (0.0, -0.20, 1.22), PALETTE["grass_light"], subdivisions=2)


def build_bush(pb: PartBuilder):
    pb.add_sphere(0.24, (0.0, 0.0, 0.20), PALETTE["grass"], subdivisions=2, scale=(1.2, 1.0, 0.85))
    pb.add_sphere(0.18, (-0.14, -0.05, 0.16), PALETTE["grass_dark"], subdivisions=2)
    pb.add_sphere(0.17, (0.15, 0.04, 0.18), PALETTE["grass_light"], subdivisions=2)


def build_flower_bed(pb: PartBuilder):
    pb.add_box((0.68, 0.48, 0.09), (0.0, 0.0, 0.045), PALETTE["wood"], bevel=0.015)
    pb.add_sphere(0.28, (0.0, 0.0, 0.10), PALETTE["grass_dark"], subdivisions=2, scale=(1.1, 0.75, 0.38))
    flower_specs = [
        ((-0.18, -0.08, 0.20), PALETTE["coral"]),
        ((0.0, -0.10, 0.21), PALETTE["gold"]),
        ((0.18, -0.06, 0.20), PALETTE["violet"]),
        ((-0.10, 0.08, 0.21), PALETTE["blossom_pink"]),
        ((0.12, 0.08, 0.20), PALETTE["blossom_white"]),
    ]
    for pos, col in flower_specs:
        pb.add_sphere(0.055, pos, col, subdivisions=1, scale=(1.2, 1.2, 0.65))
        pb.add_sphere(0.025, (pos[0], pos[1], pos[2] + 0.02), PALETTE["gold_light"], subdivisions=1)


def build_well(pb: PartBuilder):
    pb.add_cylinder(0.36, 0.36, 0.30, (0.0, 0.0, 0.15), PALETTE["stone"], vertices=12, bevel=0.015)
    pb.add_cylinder(0.39, 0.39, 0.05, (0.0, 0.0, 0.30), PALETTE["stone_light"], vertices=12, bevel=0.012)
    pb.add_cylinder(0.28, 0.28, 0.03, (0.0, 0.0, 0.32), PALETTE["sea"], vertices=12, bevel=0.005)
    for px in (-0.32, 0.32):
        pb.add_box((0.07, 0.07, 0.44), (px, 0.0, 0.52), PALETTE["wood_dark"], bevel=0.008)
    pb.add_cylinder(0.035, 0.035, 0.60, (0.0, 0.0, 0.50), PALETTE["wood_light"], vertices=8, rot_euler=(0.0, math.pi * 0.5, 0.0), bevel=0.004)
    pb.add_prism_roof(0.80, 0.72, 0.24, (0.0, 0.0, 0.64), PALETTE["wood"], bevel=0.015, axis='X')


def build_streetlight(pb: PartBuilder):
    pb.add_cylinder(0.08, 0.065, 0.22, (0.0, 0.0, 0.11), PALETTE["ink"], vertices=8, bevel=0.008)
    pb.add_cylinder(0.045, 0.04, 0.74, (0.0, 0.0, 0.56), PALETTE["wood_dark"], vertices=8, bevel=0.006)
    pb.add_box((0.24, 0.05, 0.05), (0.09, 0.0, 0.92), PALETTE["ink"], bevel=0.006)
    pb.add_cylinder(0.07, 0.05, 0.15, (0.18, 0.0, 0.79), PALETTE["gold"], vertices=8, bevel=0.008)
    pb.add_cylinder(0.085, 0.02, 0.06, (0.18, 0.0, 0.88), PALETTE["ink"], vertices=8, bevel=0.005)


BUILDERS = {
    "plaza-hall": build_plaza_hall,
    "bakery": build_bakery,
    "tree-round": build_tree_round,
    "bush": build_bush,
    "flower-bed": build_flower_bed,
    "well": build_well,
    "streetlight": build_streetlight,
}


# -----------------------------------------------------------------------------
# GLB Export & Color Verification (Same Contract as build_environment.py)
# -----------------------------------------------------------------------------
def export_asset_glb(obj, key: str):
    os.makedirs(PUBLIC_DREAM_DIR, exist_ok=True)
    glb_path = os.path.join(PUBLIC_DREAM_DIR, f"{key}.glb")

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_all_vertex_colors=True,
        export_active_vertex_color_when_no_material=True,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=12,
    )
    return glb_path


HEX_TO_PALETTE_NAME = {v: k for k, v in DREAM_PALETTE.items()}


def verify_glb_colors(glb_path: str, key: str, expected_hex_list: list):
    prev_objs = set(bpy.data.objects)
    prev_meshes = set(bpy.data.meshes)
    prev_mats = set(bpy.data.materials)
    prev_active = bpy.context.view_layer.objects.active
    prev_sel = [o for o in bpy.data.objects if o.select_get()]

    bpy.ops.import_scene.gltf(filepath=glb_path)

    new_objs = set(bpy.data.objects) - prev_objs
    imp_mesh_objs = [o for o in new_objs if o.type == "MESH" and len(o.data.color_attributes) > 0]
    if not imp_mesh_objs:
        print(f"[COLOR VERIFY FAIL] COLOR_0 missing on imported mesh in {glb_path}")
        sys.exit(1)

    linear_colors = []
    for mo in imp_mesh_objs:
        ca = mo.data.color_attributes.get("COLOR_0") or mo.data.color_attributes[0]
        for item in ca.data:
            c = item.color
            linear_colors.append((c[0], c[1], c[2]))

    for o in new_objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in set(bpy.data.meshes) - prev_meshes:
        bpy.data.meshes.remove(m, do_unlink=True)
    for mat in set(bpy.data.materials) - prev_mats:
        bpy.data.materials.remove(mat, do_unlink=True)

    bpy.ops.object.select_all(action='DESELECT')
    for o in prev_sel:
        if o.name in bpy.data.objects:
            o.select_set(True)
    if prev_active and prev_active.name in bpy.data.objects:
        bpy.context.view_layer.objects.active = prev_active

    results = {}
    for hex_str in expected_hex_list:
        label = HEX_TO_PALETTE_NAME.get(hex_str, hex_str)
        exp_rl, exp_gl, exp_bl, _ = hex_to_linear_rgba(hex_str, 1.0)
        exp_r, exp_g, exp_b = hex_to_srgb_255(hex_str)

        best_lin = min(
            linear_colors,
            key=lambda c: (c[0] - exp_rl) ** 2 + (c[1] - exp_gl) ** 2 + (c[2] - exp_bl) ** 2,
        )
        srgb_r_f = linear_to_srgb(best_lin[0]) * 255.0
        srgb_g_f = linear_to_srgb(best_lin[1]) * 255.0
        srgb_b_f = linear_to_srgb(best_lin[2]) * 255.0
        meas_r = int(round(srgb_r_f))
        meas_g = int(round(srgb_g_f))
        meas_b = int(round(srgb_b_f))
        meas_hex = f"#{meas_r:02X}{meas_g:02X}{meas_b:02X}"

        max_diff = max(
            abs(srgb_r_f - exp_r),
            abs(srgb_g_f - exp_g),
            abs(srgb_b_f - exp_b),
        )
        print(
            f"[COLOR VERIFY] {key:16s} | {label:14s} | palette={hex_str} ({exp_r:3d},{exp_g:3d},{exp_b:3d}) "
            f"| measured={meas_hex} ({srgb_r_f:6.2f},{srgb_g_f:6.2f},{srgb_b_f:6.2f}) "
            f"| linear=({best_lin[0]:.4f},{best_lin[1]:.4f},{best_lin[2]:.4f}) | max_diff={max_diff:.2f}/255"
        )
        if max_diff > 6.0:
            print(f"[COLOR VERIFY FAIL] {key} ({label}): max_diff {max_diff:.2f}/255 exceeds ±6/255")
            sys.exit(1)
        results[label] = {
            "paletteHex": hex_str,
            "measuredHex": meas_hex,
            "measuredSrgb255": [round(srgb_r_f, 2), round(srgb_g_f, 2), round(srgb_b_f, 2)],
            "measuredLinear": [round(best_lin[0], 4), round(best_lin[1], 4), round(best_lin[2], 4)],
            "maxDiff255": round(max_diff, 2),
        }
    return results


# -----------------------------------------------------------------------------
# Step 4: Render Previews (dream-test.png & dream-compare.png)
# -----------------------------------------------------------------------------
def build_mannequin_06m():
    """Builds a 0.60m SD 3-head-tall rounded mannequin keeping signature #FF7A59 coral."""
    pb = PartBuilder()
    # Two short rounded legs
    pb.add_cylinder(0.052, 0.048, 0.16, (-0.055, 0.0, 0.08), CHARACTER_REP_HEX, vertices=10, bevel=0.008)
    pb.add_cylinder(0.052, 0.048, 0.16, (0.055, 0.0, 0.08), CHARACTER_REP_HEX, vertices=10, bevel=0.008)
    # Rounded coral body
    pb.add_cylinder(0.135, 0.105, 0.25, (0.0, 0.0, 0.27), CHARACTER_REP_HEX, vertices=14, bevel=0.015)
    # Rounded arms
    pb.add_cylinder(0.038, 0.032, 0.17, (-0.145, 0.0, 0.27), CHARACTER_REP_HEX, vertices=8, rot_euler=(0.0, 0.22, 0.0), bevel=0.006)
    pb.add_cylinder(0.038, 0.032, 0.17, (0.145, 0.0, 0.27), CHARACTER_REP_HEX, vertices=8, rot_euler=(0.0, -0.22, 0.0), bevel=0.006)
    # 0.20m rounded head (cream #FFF8EC) + dot eyes (#3B2A22)
    pb.add_sphere(0.105, (0.0, 0.0, 0.495), CHARACTER_HEAD_HEX, subdivisions=2, scale=(1.04, 1.0, 0.98))
    pb.add_sphere(0.015, (-0.038, -0.098, 0.495), CHARACTER_EYE_HEX, subdivisions=1)
    pb.add_sphere(0.015, (0.038, -0.098, 0.495), CHARACTER_EYE_HEX, subdivisions=1)
    return pb.build_combined_object("_Mannequin06m", (0.34, 0.23, 0.60), lock_x_bounds=True, z_ground_offset=0.0)


def build_showcase_ground(name: str, grass_hex: str, path_hex: str, edge_hex: str):
    pb = PartBuilder()
    pb.add_cylinder(4.35, 4.10, 0.24, (0.0, 0.15, -0.12), edge_hex, vertices=24, bevel=0.02)
    pb.add_cylinder(4.20, 4.20, 0.08, (0.0, 0.15, -0.03), grass_hex, vertices=24, bevel=0.02)
    # Main plaza & bakery path
    pb.add_cylinder(1.55, 1.55, 0.025, (0.0, -0.35, 0.01), path_hex, vertices=20, bevel=0.008)
    pb.add_box((1.35, 2.80, 0.025), (-0.45, -1.20, 0.01), path_hex, rot_euler=(0.0, 0.0, -0.18), bevel=0.008)
    pb.add_box((1.90, 1.15, 0.025), (0.85, -0.15, 0.01), path_hex, rot_euler=(0.0, 0.0, 0.25), bevel=0.008)
    return pb.build_combined_object(name, (8.6, 8.6, 0.26), lock_x_bounds=True, z_ground_offset=-0.24)


def apply_dream_mist_postfx(pixels, width, height):
    """Adds subtle distance/edge lavender mist (#EDE8F8) and soft lantern/firefly glow."""
    mist_r, mist_g, mist_b = hex_to_srgb_float("#EDE8F8")
    glow_r, glow_g, glow_b = hex_to_srgb_float("#FFE8A3")
    petal_r, petal_g, petal_b = hex_to_srgb_float("#E8BDD4")

    # Screen-space positions (normalized 0..1, y=0 bottom, y=1 top)
    # Lantern glow near streetlight & bakery window
    glow_points = [
        (0.51, 0.56, 0.11, 0.28),
        (0.70, 0.49, 0.10, 0.18),
        (0.32, 0.34, 0.06, 0.16),
        (0.64, 0.28, 0.05, 0.15),
    ]
    petals = [
        (0.22, 0.28, 0.012),
        (0.38, 0.21, 0.010),
        (0.76, 0.31, 0.011),
        (0.18, 0.64, 0.011),
        (0.82, 0.67, 0.012),
    ]

    out = list(pixels)
    for y in range(height):
        ny = y / float(height - 1)
        for x in range(width):
            nx = x / float(width - 1)
            idx = (y * width + x) * 4
            r, g, b, a = out[idx], out[idx + 1], out[idx + 2], out[idx + 3]

            # Subtle distance mist at top and outer edges, keeping center/feet crisp
            dx = (nx - 0.50) * 1.15
            dy = (ny - 0.44) * 1.15
            radial = math.sqrt(dx * dx + dy * dy)
            top_haze = max(0.0, (ny - 0.68) / 0.32) * 0.22
            edge_haze = max(0.0, (radial - 0.52) / 0.48) ** 1.6 * 0.26
            mist_amt = max(0.0, min(0.34, top_haze + edge_haze))

            r = r * (1.0 - mist_amt) + mist_r * mist_amt
            g = g * (1.0 - mist_amt) + mist_g * mist_amt
            b = b * (1.0 - mist_amt) + mist_b * mist_amt

            # Soft fake glow sprite feel around streetlight & fireflies
            for gx, gy, gr, gstr in glow_points:
                gd2 = ((nx - gx) / gr) ** 2 + ((ny - gy) / gr) ** 2
                if gd2 < 1.0:
                    gw = ((1.0 - gd2) ** 2.2) * gstr
                    r = min(1.0, r + glow_r * gw * 0.45)
                    g = min(1.0, g + glow_g * gw * 0.42)
                    b = min(1.0, b + glow_b * gw * 0.32)

            # Tiny floating petals
            for px_c, py_c, pr in petals:
                pd2 = ((nx - px_c) / pr) ** 2 + ((ny - py_c) / (pr * 0.65)) ** 2
                if pd2 < 1.0:
                    pw = (1.0 - pd2) ** 1.5 * 0.75
                    r = r * (1.0 - pw) + petal_r * pw
                    g = g * (1.0 - pw) + petal_g * pw
                    b = b * (1.0 - pw) + petal_b * pw

            out[idx] = r
            out[idx + 1] = g
            out[idx + 2] = b
            out[idx + 3] = a
    return out


def render_dream_and_compare_previews(dream_objs):
    os.makedirs(PREVIEWS_DREAM_DIR, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'

    world = bpy.data.worlds.get("DreamPreviewWorld") or bpy.data.worlds.new("DreamPreviewWorld")
    scene.world = world
    bg = world.node_tree.nodes.get("Background")

    cam_data = bpy.data.cameras.new("DreamCam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 6.2
    cam_obj = bpy.data.objects.new("DreamCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    target = Vector((0.0, 0.15, 0.55))
    cam_pos = Vector((5.4, -5.4, 4.9))
    cam_obj.location = cam_pos
    cam_obj.rotation_euler = (target - cam_pos).normalized().to_track_quat('-Z', 'Y').to_euler()

    sun_data = bpy.data.lights.new("DreamSun", type='SUN')
    sun_obj = bpy.data.objects.new("DreamSun", sun_data)
    sun_obj.rotation_euler = Euler((math.radians(48), math.radians(-20), math.radians(35)), 'XYZ')
    bpy.context.collection.objects.link(sun_obj)

    fill_data = bpy.data.lights.new("DreamFill", type='SUN')
    fill_obj = bpy.data.objects.new("DreamFill", fill_data)
    fill_obj.rotation_euler = Euler((math.radians(60), math.radians(30), math.radians(-140)), 'XYZ')
    bpy.context.collection.objects.link(fill_obj)

    # Layout for Plaza + Bakery composition
    layout = {
        "plaza-hall": (Vector((-0.95, 1.40, 0.0)), Euler((0.0, 0.0, math.radians(24)), 'XYZ')),
        "bakery": (Vector((1.45, 0.55, 0.0)), Euler((0.0, 0.0, math.radians(16)), 'XYZ')),
        "well": (Vector((-0.55, -0.15, 0.0)), Euler((0.0, 0.0, math.radians(20)), 'XYZ')),
        "streetlight": (Vector((0.20, 0.45, 0.0)), Euler((0.0, 0.0, math.radians(-25)), 'XYZ')),
        "tree-round": (Vector((-2.25, 0.35, 0.0)), Euler((0.0, 0.0, 0.0), 'XYZ')),
        "bush": (Vector((0.85, 1.85, 0.0)), Euler((0.0, 0.0, 0.3), 'XYZ')),
        "flower-bed": (Vector((-1.35, -0.95, 0.0)), Euler((0.0, 0.0, math.radians(22)), 'XYZ')),
    }

    mannequin_obj = build_mannequin_06m()
    mannequin_obj.location = Vector((0.22, -0.78, 0.0))
    mannequin_obj.rotation_euler = Euler((0.0, 0.0, math.radians(38)), 'XYZ')

    # Add extra instances of tree-round and bush to frame the diorama nicely
    extra_dream_objs = []
    for dup_key, loc, rot in [
        ("tree-round", Vector((0.35, 2.35, 0.0)), Euler((0.0, 0.0, 1.1), 'XYZ')),
        ("bush", Vector((-1.95, -0.45, 0.0)), Euler((0.0, 0.0, -0.5), 'XYZ')),
        ("flower-bed", Vector((1.55, -0.75, 0.0)), Euler((0.0, 0.0, math.radians(24)), 'XYZ')),
    ]:
        src_obj = dream_objs[dup_key]
        dup_obj = src_obj.copy()
        bpy.context.collection.objects.link(dup_obj)
        dup_obj.location = loc
        dup_obj.rotation_euler = rot
        extra_dream_objs.append(dup_obj)

    for k, obj in dream_objs.items():
        loc, rot = layout[k]
        obj.location = loc
        obj.rotation_euler = rot
        obj.hide_render = False

    dream_ground = build_showcase_ground(
        "_DreamGround",
        DREAM_PALETTE["ground_grass"],
        DREAM_PALETTE["path"],
        DREAM_PALETTE["stone_dark"],
    )

    # Configure Dream lighting & sky
    if bg:
        bg.inputs[0].default_value = hex_to_linear_rgba(DREAM_PALETTE["sky"])
        bg.inputs[1].default_value = 1.05
    sun_data.color = hex_to_linear_rgba("#FFF6E5")[:3]
    sun_data.energy = 2.65
    fill_data.color = hex_to_linear_rgba("#E4DCF5")[:3]
    fill_data.energy = 1.25

    # Render 1024x1024 dream-test.png
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    dream_raw_path = os.path.join(PREVIEWS_DREAM_DIR, "_dream_raw_1024.png")
    scene.render.filepath = dream_raw_path
    bpy.ops.render.render(write_still=True)

    dream_img = bpy.data.images.load(dream_raw_path)
    dream_pix_1024 = apply_dream_mist_postfx(list(dream_img.pixels), 1024, 1024)
    bpy.data.images.remove(dream_img)
    if os.path.exists(dream_raw_path):
        os.remove(dream_raw_path)

    dream_test_path = os.path.join(PREVIEWS_DREAM_DIR, "dream-test.png")
    out_dream = bpy.data.images.new("DreamTestFinal", width=1024, height=1024, alpha=True)
    out_dream.pixels[:] = dream_pix_1024
    out_dream.file_format = 'PNG'
    out_dream.filepath_raw = dream_test_path
    out_dream.save()
    bpy.data.images.remove(out_dream)
    print(f"[INFO] Saved Dream preview to {dream_test_path}")

    # Render 512x512 Dream half for side-by-side comparison
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    dream_512_path = os.path.join(PREVIEWS_DREAM_DIR, "_dream_raw_512.png")
    scene.render.filepath = dream_512_path
    bpy.ops.render.render(write_still=True)
    d512_img = bpy.data.images.load(dream_512_path)
    dream_pix_512 = apply_dream_mist_postfx(list(d512_img.pixels), 512, 512)
    bpy.data.images.remove(d512_img)
    if os.path.exists(dream_512_path):
        os.remove(dream_512_path)

    # Hide Dream objects & build Original Vivid objects in the exact same layout
    dream_ground.hide_render = True
    for obj in dream_objs.values():
        obj.hide_render = True
    for obj in extra_dream_objs:
        obj.hide_render = True

    global PALETTE
    PALETTE = dict(ORIG_PALETTE)
    orig_objs = {}
    for k in TEST_KEYS:
        pb = PartBuilder()
        BUILDERS[k](pb)
        o_obj = pb.build_combined_object(f"_orig_{k}", ASSET_SPECS[k]["dims"])
        loc, rot = layout[k]
        o_obj.location = loc
        o_obj.rotation_euler = rot
        orig_objs[k] = o_obj

    extra_orig_objs = []
    for dup_key, loc, rot in [
        ("tree-round", Vector((0.35, 2.35, 0.0)), Euler((0.0, 0.0, 1.1), 'XYZ')),
        ("bush", Vector((-1.95, -0.45, 0.0)), Euler((0.0, 0.0, -0.5), 'XYZ')),
        ("flower-bed", Vector((1.55, -0.75, 0.0)), Euler((0.0, 0.0, math.radians(24)), 'XYZ')),
    ]:
        dup_o = orig_objs[dup_key].copy()
        bpy.context.collection.objects.link(dup_o)
        dup_o.location = loc
        dup_o.rotation_euler = rot
        extra_orig_objs.append(dup_o)

    orig_ground = build_showcase_ground(
        "_OrigGround",
        ORIG_PALETTE["grass"],
        ORIG_PALETTE["path"],
        ORIG_PALETTE["stone_dark"],
    )

    if bg:
        bg.inputs[0].default_value = hex_to_linear_rgba(ORIG_PALETTE["cream"])
        bg.inputs[1].default_value = 1.0
    sun_data.color = (1.0, 1.0, 1.0)
    sun_data.energy = 3.2
    fill_data.color = (1.0, 1.0, 1.0)
    fill_data.energy = 1.1

    orig_512_path = os.path.join(PREVIEWS_DREAM_DIR, "_orig_raw_512.png")
    scene.render.filepath = orig_512_path
    bpy.ops.render.render(write_still=True)
    o512_img = bpy.data.images.load(orig_512_path)
    orig_pix_512 = list(o512_img.pixels)
    bpy.data.images.remove(o512_img)
    if os.path.exists(orig_512_path):
        os.remove(orig_512_path)

    # Composite side-by-side 1024x512: Left = Original Vivid, Right = Dream Pastel
    comp_w, comp_h = 1024, 512
    comp_buf = [1.0] * (comp_w * comp_h * 4)
    for row in range(512):
        src_start = row * 512 * 4
        dst_left = (row * comp_w + 0) * 4
        dst_right = (row * comp_w + 512) * 4
        comp_buf[dst_left : dst_left + 512 * 4] = orig_pix_512[src_start : src_start + 512 * 4]
        comp_buf[dst_right : dst_right + 512 * 4] = dream_pix_512[src_start : src_start + 512 * 4]

    # Center divider line & top labels
    div_rgba = (*hex_to_srgb_float("#3B2A22"), 1.0)
    for row in range(512):
        for dx in (511, 512):
            idx = (row * comp_w + dx) * 4
            comp_buf[idx : idx + 4] = div_rgba

    badge_bg = (*hex_to_srgb_float("#FFF8EC"), 1.0)
    fill_rounded_rect(comp_buf, comp_w, comp_h, 16, 14, 196, 34, 8, badge_bg)
    fill_rounded_rect(comp_buf, comp_w, comp_h, 528, 14, 216, 34, 8, badge_bg)
    draw_text_on_buffer(comp_buf, comp_w, comp_h, "ORIGINAL VIVID", 28, 22, 2, div_rgba)
    draw_text_on_buffer(comp_buf, comp_w, comp_h, "DREAM PASTEL TEST", 540, 22, 2, div_rgba)

    compare_path = os.path.join(PREVIEWS_DREAM_DIR, "dream-compare.png")
    comp_img = bpy.data.images.new("DreamCompareFinal", width=comp_w, height=comp_h, alpha=True)
    comp_img.pixels[:] = comp_buf
    comp_img.file_format = 'PNG'
    comp_img.filepath_raw = compare_path
    comp_img.save()
    bpy.data.images.remove(comp_img)
    print(f"[INFO] Saved side-by-side comparison preview to {compare_path}")

    # Clean up temporary showcase objects
    PALETTE = dict(DREAM_PALETTE)
    for o in list(orig_objs.values()) + extra_orig_objs + extra_dream_objs + [orig_ground, dream_ground, mannequin_obj]:
        bpy.data.objects.remove(o, do_unlink=True)

    return [dream_test_path, compare_path]


# -----------------------------------------------------------------------------
# Main Pipeline Execution
# -----------------------------------------------------------------------------
def main():
    print(f"[INFO] Running build_dream_test.py on Blender {bpy.app.version_string}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0

    concept_paths = generate_concepts()
    fx_sprites = generate_fx_sprites()

    global PALETTE
    PALETTE = dict(DREAM_PALETTE)

    dream_objects = {}
    metadata_assets = {}
    total_tris = 0
    total_bytes = 0

    for key in TEST_KEYS:
        spec = ASSET_SPECS[key]
        pb = PartBuilder()
        BUILDERS[key](pb)

        obj = pb.build_combined_object(key, spec["dims"], lock_x_bounds=False, z_ground_offset=0.0)
        dream_objects[key] = obj

        glb_path = export_asset_glb(obj, key)
        color_verify = verify_glb_colors(glb_path, key, list(obj.get("used_palette_colors", [])))

        tri_count = len(obj.data.polygons)
        byte_size = os.path.getsize(glb_path)
        total_tris += tri_count
        total_bytes += byte_size

        xs = [v.co.x for v in obj.data.vertices]
        ys = [v.co.y for v in obj.data.vertices]
        zs = [v.co.z for v in obj.data.vertices]
        bounds = {
            "width": round(max(xs) - min(xs), 4),
            "depth": round(max(ys) - min(ys), 4),
            "height": round(max(zs) - min(zs), 4),
            "minY": round(min(zs), 4),
            "maxY": round(max(zs), 4),
        }

        assert tri_count <= spec["max_tri"], f"{key} exceeded tri budget: {tri_count} > {spec['max_tri']}"
        assert byte_size <= spec["max_kib"] * 1024, f"{key} exceeded byte budget: {byte_size} > {spec['max_kib'] * 1024}"

        metadata_assets[key] = {
            "path": f"assets/abraxas/dream-test/{key}.glb",
            "scale": 1,
            "collision": spec["collision"],
            "triangles": tri_count,
            "bytes": byte_size,
            "maxTriangles": spec["max_tri"],
            "maxBytes": spec["max_kib"] * 1024,
            "bounds": bounds,
            "materials": len(obj.data.materials),
            "vertexColorAttribute": "COLOR_0",
            "colorAttributeType": "FLOAT_COLOR",
            "dracoCompressed": True,
            "colorVerification": color_verify,
        }
        print(
            f"[OK] {key:16s} | tri={tri_count:4d}/{spec['max_tri']:4d} "
            f"| bytes={byte_size:6d}/{spec['max_kib']*1024:6d} "
            f"| bounds={bounds['width']}x{bounds['depth']}x{bounds['height']}"
        )

    preview_paths = render_dream_and_compare_previews(dream_objects)

    os.makedirs(SOURCE_DREAM_DIR, exist_ok=True)
    meta_path = os.path.join(SOURCE_DREAM_DIR, "asset-metadata.json")
    metadata_doc = {
        "version": 1,
        "blenderVersion": bpy.app.version_string,
        "colorSpaceNote": (
            "Dream 파스텔 시험 빌드(2026-11-01): FLOAT_COLOR COLOR_0, sRGB 팔레트를 Linear-sRGB로 "
            "단 1회 변환 후 선형 공간에서 자체 AO 곱을 1회만 적용, 재임포트 ±6/255 색 검증 통과."
        ),
        "characterSignatureColorKept": CHARACTER_REP_HEX,
        "core9Palette": DREAM_CORE_9_CHIPS,
        "dreamPalette": DREAM_PALETTE,
        "summary": {
            "assetCount": len(metadata_assets),
            "totalTriangles": total_tris,
            "totalBytes": total_bytes,
            "totalKiB": round(total_bytes / 1024.0, 2),
        },
        "assets": metadata_assets,
        "fxSprites": fx_sprites,
        "concepts": [os.path.relpath(p, ROOT_DIR).replace("\\", "/") for p in concept_paths],
        "previews": [os.path.relpath(p, ROOT_DIR).replace("\\", "/") for p in preview_paths],
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata_doc, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Ensure no .blend1 files remain anywhere in assets/source/dream
    for fname in os.listdir(SOURCE_DREAM_DIR):
        if fname.endswith(".blend1"):
            os.remove(os.path.join(SOURCE_DREAM_DIR, fname))

    print(
        f"[INFO] Completed Dream test build: {len(metadata_assets)} GLBs "
        f"({total_tris} tris, {round(total_bytes / 1024.0, 2)} KiB), "
        f"4 FX sprites, 2 concepts, 2 previews."
    )


if __name__ == "__main__":
    main()
