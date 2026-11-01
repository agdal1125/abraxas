# -*- coding: utf-8 -*-
"""
Abraxas Original Environment Kit Builder for Blender 5.2+
Generates 32 original low-poly diorama environment assets (buildings, trees, foliage,
landmarks, water props, and life props) with vertex colors (COLOR_0), subtle self-AO,
and Draco-compressed GLB exports.
Terrain generation is gated behind BUILD_TERRAIN for after M1 v2 map finalization.
"""

import bpy
import bmesh
import math
import os
import sys
import json
from mathutils import Vector, Euler

# -----------------------------------------------------------------------------
# Configuration Flags
# -----------------------------------------------------------------------------
PHASE1_ONLY = False
BUILD_TERRAIN = os.environ.get("ABRAXAS_BUILD_TERRAIN", "0") == "1"

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCE_ENV_DIR = os.path.join(ROOT_DIR, "assets", "source", "environment")
CONCEPTS_ENV_DIR = os.path.join(ROOT_DIR, "assets", "source", "concepts", "environment")
PREVIEWS_ENV_DIR = os.path.join(ROOT_DIR, "assets", "source", "previews", "environment")
PUBLIC_ENV_DIR = os.path.join(ROOT_DIR, "client", "public", "assets", "abraxas", "environment")
BAKES_DIR = os.path.join(SOURCE_ENV_DIR, "bakes")

BRAIN_DIR = r"C:\Users\jake1\.gemini\antigravity-cli\brain\6a2c885b-bc0a-4d18-81f4-5af4e2830d05"
CONCEPT_SOURCES = {
    "buildings-part1.png": os.path.join(BRAIN_DIR, "abraxas_buildings_part1_concept_sheet_1793496358050.jpg"),
    "buildings-part2.png": os.path.join(BRAIN_DIR, "abraxas_buildings_part2_concept_sheet_1793496364782.jpg"),
    "landmarks-props.png": os.path.join(BRAIN_DIR, "abraxas_plaza_structural_landmarks_concept_sheet_1793496362463.jpg"),
    "nature-foliage.png": os.path.join(BRAIN_DIR, "abraxas_environment_concept_sheet_1793496360216.jpg"),
    "life-props.png": os.path.join(BRAIN_DIR, "abraxas_life_props_concept_sheet_1793496359725.jpg"),
}

PHASE1_KEYS = [
    "entrance-house",
    "plaza-hall",
    "well",
    "streetlight",
    "bench",
    "fence",
    "festival-stage",
    "tree-round",
    "bush",
    "flower-bed",
    "grass-tuft",
    "pebbles",
]

# -----------------------------------------------------------------------------
# Palette & Color Utilities (sRGB -> Linear sRGB, Dream Palette v2)
# -----------------------------------------------------------------------------
PALETTE = {
    "cream": "#FFF8EC",
    "cream_warm": "#F7EFE2",
    "cream_shadow": "#E6D8C0",
    "ink": "#564863",
    "wood": "#C69D80",
    "wood_light": "#DFB99E",
    "wood_dark": "#9C7860",
    "stone": "#C8BFE0",
    "stone_light": "#DDD5F0",
    "stone_dark": "#A99CC4",
    "grass": "#7EC4A6",
    "grass_dark": "#64AD8E",
    "grass_light": "#9CD4B5",
    "path": "#EDC9A3",
    "sea": "#94D2CB",
    "coral": "#EBA698",
    "coral_soft": "#F0B8AC",
    "gold": "#FFE08A",
    "gold_light": "#FFF0B8",
    "violet": "#BEA5EB",
    "violet_muted": "#AA92D6",
    "violet_slate": "#8A74B5",
    "teal": "#78CCC0",
    "teal_muted": "#6FB8AE",
    "teal_dark": "#56968D",
    "brick": "#DF9686",
    "brick_dark": "#C47B6B",
    "blossom_pink": "#E6A8C7",
    "blossom_white": "#FAF5FF",
}

DREAM_V1_PALETTE = {
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

DREAM_V2_CORE_9_CHIPS = [
    {"role_ko": "하늘 (Sky)", "label": "SKY", "hex": "#D8D0F0", "v1Hex": "#DDD8F1", "desc": "안개 라벤더"},
    {"role_ko": "안개 (Mist)", "label": "MIST", "hex": "#EAE3F7", "v1Hex": "#EDE8F8", "desc": "연보라 안개빛"},
    {"role_ko": "지면 풀 (Grass)", "label": "GRASS", "hex": "#9CD4B5", "v1Hex": "#B5D9C4", "desc": "파스텔 민트 풀 (+22.7% 채도)"},
    {"role_ko": "흙길 (Path)", "label": "PATH", "hex": "#EDC9A3", "v1Hex": "#EBD3B9", "desc": "따뜻한 모래 살구 (+21.0% 채도)"},
    {"role_ko": "건물 벽 (Wall)", "label": "WALL", "hex": "#FFF8EC", "v1Hex": "#FFF8EC", "desc": "따뜻한 크림"},
    {"role_ko": "지붕 (Roof)", "label": "ROOF", "hex": "#EBA698", "v1Hex": "#E7B6AB", "desc": "복숭아 테라코타 (+21.4% 채도)"},
    {"role_ko": "나뭇잎 (Leaves)", "label": "LEAVES", "hex": "#7EC4A6", "v1Hex": "#98C9B5", "desc": "세이지 민트 수관 (+19.2% 채도)"},
    {"role_ko": "물 (Water)", "label": "WATER", "hex": "#94D2CB", "v1Hex": "#A9D8D3", "desc": "맑은 아쿠아 민트"},
    {"role_ko": "빛 (Light)", "label": "LIGHT", "hex": "#FFE08A", "v1Hex": "#FFE8A3", "desc": "은은한 별빛 앰버"},
]

CHARACTER_REP_HEX = "#FF7A59"
CHARACTER_HEAD_HEX = "#FFF8EC"
CHARACTER_EYE_HEX = "#3B2A22"


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


def hex_to_srgb_255(hex_str: str):
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# -----------------------------------------------------------------------------
# Asset Specifications (§3 Contract)
# -----------------------------------------------------------------------------
ASSET_SPECS = {
    "entrance-house": {
        "dims": (1.40, 1.20, 1.40),
        "max_tri": 4000,
        "max_kib": 180,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.65, "halfZ": 0.55}],
        "concept_sheet": "buildings-part1.png",
    },
    "plaza-hall": {
        "dims": (1.80, 1.50, 1.60),
        "max_tri": 5000,
        "max_kib": 180,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.85, "halfZ": 0.70}],
        "concept_sheet": "buildings-part1.png",
    },
    "bakery": {
        "dims": (1.60, 1.40, 1.50),
        "max_tri": 5000,
        "max_kib": 180,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.75, "halfZ": 0.65}],
        "concept_sheet": "buildings-part1.png",
    },
    "library": {
        "dims": (1.80, 1.50, 1.80),
        "max_tri": 5000,
        "max_kib": 180,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.85, "halfZ": 0.70}],
        "concept_sheet": "buildings-part2.png",
    },
    "smithy": {
        "dims": (1.80, 1.40, 1.50),
        "max_tri": 5000,
        "max_kib": 180,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.85, "halfZ": 0.65}],
        "concept_sheet": "buildings-part2.png",
    },
    "lake-pavilion": {
        "dims": (1.60, 1.40, 1.40),
        "max_tri": 4000,
        "max_kib": 180,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.75, "halfZ": 0.65}],
        "concept_sheet": "buildings-part2.png",
    },
    "tree-round": {
        "dims": (1.02, 1.02, 1.50),
        "max_tri": 1200,
        "max_kib": 60,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.16}],
        "concept_sheet": "nature-foliage.png",
    },
    "tree-layered": {
        "dims": (1.10, 1.10, 1.80),
        "max_tri": 1200,
        "max_kib": 60,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.20}],
        "concept_sheet": "nature-foliage.png",
    },
    "tree-slender": {
        "dims": (0.70, 0.70, 1.60),
        "max_tri": 1200,
        "max_kib": 60,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.16}],
        "concept_sheet": "nature-foliage.png",
    },
    "tree-young": {
        "dims": (0.66, 0.66, 1.20),
        "max_tri": 1200,
        "max_kib": 60,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.12}],
        "concept_sheet": "nature-foliage.png",
    },
    "bush": {
        "dims": (0.60, 0.50, 0.40),
        "max_tri": 500,
        "max_kib": 30,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.22}],
        "concept_sheet": "nature-foliage.png",
    },
    "flower-bed": {
        "dims": (0.70, 0.50, 0.25),
        "max_tri": 600,
        "max_kib": 35,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "grass-tuft": {
        "dims": (0.22, 0.20, 0.18),
        "max_tri": 160,
        "max_kib": 15,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "mushroom": {
        "dims": (0.24, 0.22, 0.20),
        "max_tri": 160,
        "max_kib": 15,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "pebbles": {
        "dims": (0.26, 0.24, 0.06),
        "max_tri": 160,
        "max_kib": 15,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "fence": {
        "dims": (1.00, 0.12, 0.45),
        "max_tri": 400,
        "max_kib": 25,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.50, "halfZ": 0.06}],
        "concept_sheet": "landmarks-props.png",
    },
    "rock-small": {
        "dims": (0.40, 0.36, 0.28),
        "max_tri": 300,
        "max_kib": 20,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.18}],
        "concept_sheet": "nature-foliage.png",
    },
    "rock-large": {
        "dims": (0.80, 0.72, 0.52),
        "max_tri": 600,
        "max_kib": 35,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.36}],
        "concept_sheet": "nature-foliage.png",
    },
    "streetlight": {
        "dims": (0.34, 0.22, 1.00),
        "max_tri": 650,
        "max_kib": 40,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.10}],
        "concept_sheet": "landmarks-props.png",
    },
    "bench": {
        "dims": (0.80, 0.35, 0.45),
        "max_tri": 800,
        "max_kib": 45,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.40, "halfZ": 0.18}],
        "concept_sheet": "landmarks-props.png",
    },
    "well": {
        "dims": (0.80, 0.80, 0.80),
        "max_tri": 1500,
        "max_kib": 70,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.38}],
        "concept_sheet": "landmarks-props.png",
    },
    "festival-stage": {
        "dims": (1.80, 1.20, 1.00),
        "max_tri": 2500,
        "max_kib": 100,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.90, "halfZ": 0.60}],
        "concept_sheet": "landmarks-props.png",
    },
    "memory-gate": {
        "dims": (1.40, 0.50, 1.60),
        "max_tri": 2500,
        "max_kib": 100,
        "collision": [
            {"type": "box", "x": -0.55, "z": 0.0, "halfX": 0.15, "halfZ": 0.25},
            {"type": "box", "x": 0.55, "z": 0.0, "halfX": 0.15, "halfZ": 0.25},
        ],
        "concept_sheet": "landmarks-props.png",
    },
    "bridge": {
        "dims": (1.00, 2.00, 0.35),
        "max_tri": 1800,
        "max_kib": 80,
        "collision": [
            {"type": "box", "x": -0.48, "z": 0.0, "halfX": 0.05, "halfZ": 1.00},
            {"type": "box", "x": 0.48, "z": 0.0, "halfX": 0.05, "halfZ": 1.00},
        ],
        "concept_sheet": "landmarks-props.png",
    },
    "water-reed": {
        "dims": (0.26, 0.24, 0.35),
        "max_tri": 500,
        "max_kib": 30,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "water-flower": {
        "dims": (0.28, 0.26, 0.12),
        "max_tri": 500,
        "max_kib": 30,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "shore-post": {
        "dims": (0.24, 0.24, 0.50),
        "max_tri": 500,
        "max_kib": 30,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.08}],
        "concept_sheet": "nature-foliage.png",
    },
    "bread-crate": {
        "dims": (0.36, 0.28, 0.26),
        "max_tri": 700,
        "max_kib": 40,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.18, "halfZ": 0.14}],
        "concept_sheet": "life-props.png",
    },
    "book-stack": {
        "dims": (0.36, 0.28, 0.30),
        "max_tri": 700,
        "max_kib": 40,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.18, "halfZ": 0.14}],
        "concept_sheet": "life-props.png",
    },
    "tool-rack": {
        "dims": (0.56, 0.32, 0.55),
        "max_tri": 700,
        "max_kib": 40,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.28, "halfZ": 0.16}],
        "concept_sheet": "life-props.png",
    },
    "barrel": {
        "dims": (0.30, 0.30, 0.42),
        "max_tri": 700,
        "max_kib": 40,
        "collision": [{"type": "circle", "x": 0.0, "z": 0.0, "radius": 0.15}],
        "concept_sheet": "life-props.png",
    },
    "log": {
        "dims": (0.60, 0.20, 0.22),
        "max_tri": 700,
        "max_kib": 40,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.30, "halfZ": 0.10}],
        "concept_sheet": "life-props.png",
    },
    "signboard": {
        "dims": (0.48, 0.22, 0.90),
        "max_tri": 600,
        "max_kib": 35,
        "collision": [{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.22, "halfZ": 0.10}],
        "concept_sheet": "landmarks-props.png",
    },
}


# -----------------------------------------------------------------------------
# Concept Image Import & Conversion
# -----------------------------------------------------------------------------
def sync_concept_images():
    os.makedirs(CONCEPTS_ENV_DIR, exist_ok=True)
    saved = []
    for target_name, src_path in CONCEPT_SOURCES.items():
        if not os.path.exists(src_path):
            print(f"[WARN] Concept source missing: {src_path}")
            continue
        dst_path = os.path.join(CONCEPTS_ENV_DIR, target_name)
        img = bpy.data.images.load(src_path, check_existing=True)
        w, h = img.size[0], img.size[1]
        if w > 1536 or h > 1536:
            scale = 1536.0 / max(w, h)
            img.scale(int(round(w * scale)), int(round(h * scale)))
        img.file_format = 'PNG'
        img.filepath_raw = dst_path
        img.save()
        saved.append(dst_path)
        bpy.data.images.remove(img)
    print(f"[INFO] Synced {len(saved)} concept sheets to {CONCEPTS_ENV_DIR}")


# -----------------------------------------------------------------------------
# Shared Material Creation (Opaque PBR reading COLOR_0)
# -----------------------------------------------------------------------------
def get_or_create_diorama_material(name="AbraxasEnvMat", roughness=0.85):
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


# -----------------------------------------------------------------------------
# Low-Poly Part Builder Helpers (BMesh + Bevel Modifier Evaluation)
# -----------------------------------------------------------------------------
class PartBuilder:
    def __init__(self):
        self.parts = []

    def _finalize_part_mesh(self, bm, color_hex, bevel_width=0.015, bevel_segments=1, smooth=False, shade_gradient=0.10):
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
        self._finalize_part_mesh(bm, color_hex, bevel_width=bevel, bevel_segments=1 if bevel > 0 else 0, smooth=smooth, shade_gradient=0.16)

    def add_rock_poly(self, radius, center, color_hex, scale=(1.0, 1.0, 0.8), seed=1, bevel=0.015):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
        for i, v in enumerate(bm.verts):
            n = math.sin(seed * 17.3 + i * 4.7) * 0.14 + math.cos(seed * 9.1 + i * 2.3) * 0.08
            v.co.x *= scale[0] * (1.0 + n)
            v.co.y *= scale[1] * (1.0 - n * 0.6)
            if v.co.z < -radius * 0.25:
                v.co.z = -radius * 0.35 * scale[2]
            else:
                v.co.z *= scale[2] * (1.0 + n * 0.5)
        bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
        self._finalize_part_mesh(bm, color_hex, bevel_width=bevel, bevel_segments=1, smooth=False, shade_gradient=0.15)

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

        mat = get_or_create_diorama_material("AbraxasEnvMat", roughness=0.85)
        mesh.materials.append(mat)

        obj = bpy.data.objects.new(key, mesh)
        bpy.context.collection.objects.link(obj)
        obj["used_palette_colors"] = sorted(list(set(palette_list)))
        return obj


# -----------------------------------------------------------------------------
# Procedural Asset Constructors (32 Original Designs)
# -----------------------------------------------------------------------------
def build_entrance_house(pb: PartBuilder):
    # Stone plinth & front doorstep
    pb.add_box((1.30, 1.10, 0.14), (0.0, 0.0, 0.07), PALETTE["stone"], bevel=0.015)
    pb.add_box((0.48, 0.14, 0.08), (0.0, -0.54, 0.04), PALETTE["stone_light"], bevel=0.01)
    # Warm cream cottage walls (inset from corner pillars to prevent coplanar overlap)
    pb.add_box((1.16, 0.96, 0.78), (0.0, 0.0, 0.50), PALETTE["cream"], bevel=0.015)
    # Corner timber pillars protruding cleanly
    for sx in (-0.57, 0.57):
        for sy in (-0.47, 0.47):
            pb.add_box((0.11, 0.11, 0.80), (sx, sy, 0.50), PALETTE["wood"], bevel=0.012)
    # Rounded gable roof + overhanging bargeboards & ridge beam
    pb.add_prism_roof(1.40, 1.20, 0.52, (0.0, 0.0, 0.86), PALETTE["wood"], ridge_scale=0.96, bevel=0.025, segments=2, axis='Y')
    pb.add_box((0.16, 1.22, 0.09), (0.0, 0.0, 1.36), PALETTE["wood_dark"], bevel=0.015)
    # Front arched doorway (-Y is front)
    pb.add_box((0.42, 0.08, 0.54), (0.0, -0.49, 0.38), PALETTE["wood_dark"], bevel=0.015)
    pb.add_cylinder(0.21, 0.21, 0.08, (0.0, -0.49, 0.65), PALETTE["wood_dark"], vertices=10, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.01)
    pb.add_box((0.34, 0.08, 0.50), (0.0, -0.50, 0.36), PALETTE["wood_light"], bevel=0.01)
    pb.add_sphere(0.03, (0.11, -0.55, 0.35), PALETTE["gold"], subdivisions=1)
    # Upper gable arched window & right side window with sill
    pb.add_box((0.24, 0.08, 0.22), (0.0, -0.49, 0.90), PALETTE["wood_dark"], bevel=0.01)
    pb.add_box((0.18, 0.08, 0.16), (0.0, -0.50, 0.90), PALETTE["gold_light"], bevel=0.008)
    pb.add_box((0.08, 0.30, 0.26), (0.58, 0.0, 0.52), PALETTE["wood_dark"], bevel=0.01)
    pb.add_box((0.08, 0.22, 0.18), (0.59, 0.0, 0.52), PALETTE["gold_light"], bevel=0.008)
    # Warm lantern & small signpost on front right
    pb.add_box((0.05, 0.12, 0.04), (0.38, -0.52, 0.62), PALETTE["ink"], bevel=0.006)
    pb.add_cylinder(0.055, 0.045, 0.12, (0.38, -0.56, 0.53), PALETTE["gold"], vertices=8, bevel=0.008)
    pb.add_box((0.24, 0.06, 0.16), (0.46, -0.55, 0.26), PALETTE["cream_warm"], bevel=0.01)
    pb.add_box((0.05, 0.05, 0.24), (0.46, -0.55, 0.12), PALETTE["wood_dark"], bevel=0.008)


def build_plaza_hall(pb: PartBuilder):
    # Wide stone foundation & front step
    pb.add_box((1.74, 1.42, 0.14), (0.0, 0.0, 0.07), PALETTE["stone"], bevel=0.015)
    pb.add_box((0.76, 0.18, 0.10), (0.0, -0.68, 0.05), PALETTE["stone_light"], bevel=0.012)
    # Main hall cream body (inset cleanly inside corner columns)
    pb.add_box((1.60, 1.28, 0.78), (0.0, 0.0, 0.50), PALETTE["cream"], bevel=0.015)
    for sx in (-0.77, 0.77):
        for sy in (-0.61, 0.61):
            pb.add_box((0.12, 0.12, 0.80), (sx, sy, 0.50), PALETTE["wood"], bevel=0.012)
    # Stepped stone-slate roof + front arched cornice
    pb.add_box((1.80, 1.50, 0.16), (0.0, 0.0, 0.94), PALETTE["stone_dark"], bevel=0.02, taper_top=(0.94, 0.94))
    pb.add_box((1.50, 1.24, 0.16), (0.0, 0.0, 1.08), PALETTE["stone"], bevel=0.02, taper_top=(0.90, 0.90))
    pb.add_box((1.16, 0.96, 0.12), (0.0, 0.0, 1.20), PALETTE["stone_light"], bevel=0.018)
    # Central clock/bell turret
    pb.add_box((0.38, 0.38, 0.24), (0.0, 0.0, 1.34), PALETTE["cream_warm"], bevel=0.012)
    pb.add_prism_roof(0.46, 0.46, 0.18, (0.0, 0.0, 1.44), PALETTE["stone_dark"], bevel=0.015, axis='X')
    pb.add_cylinder(0.11, 0.11, 0.05, (0.0, -0.19, 1.35), PALETTE["gold_light"], vertices=10, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.005)
    # Double wooden doors
    pb.add_box((0.62, 0.08, 0.56), (0.0, -0.64, 0.40), PALETTE["wood_dark"], bevel=0.012)
    pb.add_box((0.26, 0.08, 0.50), (-0.14, -0.65, 0.38), PALETTE["wood"], bevel=0.01)
    pb.add_box((0.26, 0.08, 0.50), (0.14, -0.65, 0.38), PALETTE["wood"], bevel=0.01)
    # Festive coral & gold bunting swags across front facade
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
    # Brick oven & tall rounded chimney
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


def build_library(pb: PartBuilder):
    pb.add_box((1.68, 1.40, 0.14), (0.0, 0.0, 0.07), PALETTE["stone"], bevel=0.015)
    pb.add_box((1.52, 1.24, 0.84), (0.0, 0.0, 0.52), PALETTE["cream"], bevel=0.015)
    for sx in (-0.74, -0.34, 0.34, 0.74):
        pb.add_box((0.09, 1.30, 0.84), (sx, 0.0, 0.52), PALETTE["wood"], bevel=0.01)
    pb.add_prism_roof(1.80, 1.50, 0.84, (0.0, 0.0, 0.92), PALETTE["violet_muted"], ridge_scale=0.96, bevel=0.025, segments=2, axis='Y')
    pb.add_box((0.14, 1.50, 0.09), (0.0, 0.0, 1.74), PALETTE["wood_dark"], bevel=0.015)
    pb.add_cylinder(0.22, 0.22, 0.08, (0.0, -0.72, 1.24), PALETTE["wood"], vertices=12, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.01)
    pb.add_cylinder(0.16, 0.16, 0.08, (0.0, -0.735, 1.24), PALETTE["gold_light"], vertices=12, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.008)
    pb.add_box((0.48, 0.10, 0.60), (0.0, -0.63, 0.40), PALETTE["violet_slate"], bevel=0.015)
    pb.add_box((0.36, 0.10, 0.52), (0.0, -0.645, 0.36), PALETTE["wood_dark"], bevel=0.01)
    pb.add_box((0.10, 0.56, 0.48), (0.76, 0.0, 0.44), PALETTE["wood_dark"], bevel=0.01)
    for rz, col in ((0.30, PALETTE["coral"]), (0.44, PALETTE["teal"]), (0.58, PALETTE["gold"])):
        pb.add_box((0.08, 0.44, 0.09), (0.78, 0.0, rz), col, bevel=0.006)


def build_smithy(pb: PartBuilder):
    pb.add_box((1.76, 1.36, 0.14), (0.0, 0.0, 0.07), PALETTE["stone_dark"], bevel=0.015)
    pb.add_box((1.06, 1.22, 0.78), (-0.30, 0.0, 0.50), PALETTE["stone"], bevel=0.018)
    pb.add_box((1.12, 1.28, 0.09), (-0.30, 0.0, 0.84), PALETTE["teal_muted"], bevel=0.012)
    for sx in (-0.82, 0.22, 0.78):
        pb.add_box((0.10, 0.10, 0.76), (sx, -0.58, 0.48), PALETTE["wood_dark"], bevel=0.01)
        pb.add_box((0.10, 0.10, 0.76), (sx, 0.58, 0.48), PALETTE["wood_dark"], bevel=0.01)
    pb.add_prism_roof(1.26, 1.40, 0.46, (-0.25, 0.0, 0.88), PALETTE["wood"], bevel=0.02, axis='Y')
    pb.add_box((0.72, 1.36, 0.08), (0.52, 0.0, 0.82), PALETTE["wood_light"], rot_euler=(0.0, 0.26, 0.0), bevel=0.012)
    pb.add_box((0.38, 0.38, 1.36), (-0.56, 0.20, 0.74), PALETTE["stone_light"], bevel=0.02, taper_top=(0.86, 0.86))
    pb.add_box((0.44, 0.44, 0.10), (-0.56, 0.20, 1.44), PALETTE["stone_dark"], bevel=0.015)
    pb.add_box((0.54, 0.12, 0.46), (-0.30, -0.60, 0.34), PALETTE["stone_light"], bevel=0.015)
    pb.add_box((0.34, 0.10, 0.32), (-0.30, -0.61, 0.28), PALETTE["coral"], bevel=0.01)
    pb.add_box((0.26, 0.16, 0.18), (0.50, -0.15, 0.22), PALETTE["ink"], bevel=0.012, taper_top=(1.3, 1.1))


def build_lake_pavilion(pb: PartBuilder):
    pb.add_box((1.52, 1.32, 0.14), (0.0, 0.0, 0.07), PALETTE["wood_dark"], bevel=0.015)
    pb.add_box((1.42, 1.22, 0.06), (0.0, 0.0, 0.16), PALETTE["wood_light"], bevel=0.01)
    for sx in (-0.62, 0.62):
        for sy in (-0.52, 0.52):
            pb.add_cylinder(0.07, 0.065, 0.78, (sx, sy, 0.54), PALETTE["wood"], vertices=10, bevel=0.01)
    for sy in (-0.52, 0.52):
        pb.add_box((1.24, 0.06, 0.06), (0.0, sy, 0.38), PALETTE["wood"], bevel=0.008)
    for sx in (-0.62, 0.62):
        pb.add_box((0.06, 1.04, 0.06), (sx, 0.0, 0.38), PALETTE["wood"], bevel=0.008)
    pb.add_box((1.60, 1.40, 0.10), (0.0, 0.0, 0.94), PALETTE["wood"], bevel=0.018)
    pb.add_cylinder(0.96, 0.42, 0.26, (0.0, 0.0, 1.10), PALETTE["teal_muted"], vertices=8, rot_euler=(0.0, 0.0, math.pi * 0.125), bevel=0.018, smooth=False, scale_xy=(1.0, 0.88))
    pb.add_cylinder(0.44, 0.06, 0.20, (0.0, 0.0, 1.30), PALETTE["teal_dark"], vertices=8, rot_euler=(0.0, 0.0, math.pi * 0.125), bevel=0.015, smooth=False, scale_xy=(1.0, 0.88))
    pb.add_sphere(0.06, (0.0, 0.0, 1.38), PALETTE["gold"], subdivisions=1)


def build_tree_round(pb: PartBuilder):
    pb.add_cylinder(0.15, 0.11, 0.68, (0.0, 0.0, 0.34), PALETTE["wood"], vertices=10, bevel=0.01)
    pb.add_sphere(0.46, (0.0, 0.0, 1.02), PALETTE["grass"], subdivisions=2, scale=(1.05, 1.05, 0.95))
    pb.add_sphere(0.32, (-0.22, -0.14, 0.92), PALETTE["grass_dark"], subdivisions=2)
    pb.add_sphere(0.30, (0.24, 0.12, 0.96), PALETTE["grass_light"], subdivisions=2)
    pb.add_sphere(0.28, (0.0, -0.20, 1.22), PALETTE["grass_light"], subdivisions=2)


def build_tree_layered(pb: PartBuilder):
    pb.add_cylinder(0.18, 0.12, 0.52, (0.0, 0.0, 0.26), PALETTE["wood_dark"], vertices=10, bevel=0.01)
    pb.add_cylinder(0.55, 0.18, 0.56, (0.0, 0.0, 0.68), PALETTE["grass_dark"], vertices=10, bevel=0.02, segments=2)
    pb.add_cylinder(0.44, 0.14, 0.52, (0.0, 0.0, 1.08), PALETTE["grass"], vertices=10, bevel=0.02, segments=2)
    pb.add_cylinder(0.32, 0.03, 0.48, (0.0, 0.0, 1.48), PALETTE["grass_light"], vertices=10, bevel=0.02, segments=2)


def build_tree_slender(pb: PartBuilder):
    pb.add_cylinder(0.14, 0.10, 0.50, (0.0, 0.0, 0.25), PALETTE["wood"], vertices=10, bevel=0.01)
    pb.add_sphere(0.35, (0.0, 0.0, 1.02), PALETTE["grass"], subdivisions=2, scale=(0.95, 0.95, 1.65))
    pb.add_sphere(0.26, (0.0, 0.0, 1.32), PALETTE["grass_light"], subdivisions=2, scale=(0.85, 0.85, 1.15))


def build_tree_young(pb: PartBuilder):
    pb.add_cylinder(0.10, 0.06, 0.64, (0.0, 0.0, 0.32), PALETTE["wood_light"], vertices=8, bevel=0.008)
    pb.add_sphere(0.24, (0.0, 0.0, 0.92), PALETTE["grass_light"], subdivisions=2)
    pb.add_sphere(0.18, (-0.16, 0.04, 0.72), PALETTE["grass"], subdivisions=2)
    pb.add_sphere(0.17, (0.16, -0.04, 0.78), PALETTE["grass"], subdivisions=2)


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


def build_grass_tuft(pb: PartBuilder):
    # Strictly <= 160 triangles: 3 beveled main blades + 2 crisp accent blades = 156 tris
    blades = [
        ((0.0, 0.0, 0.09), (0.045, 0.035, 0.18), (0.0, 0.0, 0.0), PALETTE["grass"], 0.005),
        ((-0.05, -0.02, 0.08), (0.04, 0.03, 0.15), (0.12, -0.28, 0.2), PALETTE["grass_light"], 0.005),
        ((0.05, 0.02, 0.08), (0.04, 0.03, 0.15), (-0.12, 0.28, -0.2), PALETTE["grass_dark"], 0.005),
        ((0.0, -0.04, 0.07), (0.038, 0.03, 0.13), (0.25, 0.05, 0.0), PALETTE["grass"], 0.0),
        ((0.0, 0.04, 0.07), (0.038, 0.03, 0.13), (-0.25, -0.05, 0.0), PALETTE["grass_light"], 0.0),
    ]
    for center, size, rot, col, bev in blades:
        pb.add_box(size, center, col, rot_euler=rot, bevel=bev, segments=1 if bev > 0 else 0, taper_top=(0.25, 0.35))


def build_mushroom(pb: PartBuilder):
    # Strictly <= 160 triangles: 3 mushrooms with 6-sided stems + 8-sided low-poly dome caps = 144 tris
    mushrooms = [
        ((0.0, 0.0, 0.06), 0.03, 0.12, 0.078, 0.065, PALETTE["wood_light"]),
        ((-0.07, -0.04, 0.04), 0.022, 0.08, 0.052, 0.045, PALETTE["coral_soft"]),
        ((0.07, 0.03, 0.045), 0.024, 0.09, 0.058, 0.050, PALETTE["wood"]),
    ]
    for (x, y, z), sr, sh, cr, ch, cap_col in mushrooms:
        pb.add_cylinder(sr, sr * 0.82, sh, (x, y, z), PALETTE["cream"], vertices=6, bevel=0.0, segments=0)
        pb.add_cylinder(cr, cr * 0.38, ch, (x, y, z + sh * 0.55), cap_col, vertices=8, bevel=0.0, segments=0)


def build_pebbles(pb: PartBuilder):
    # Strictly <= 160 triangles: 4 smooth low-poly river stones using 8-sided beveled cylinders = 128 tris
    stones = [
        ((-0.04, -0.02, 0.024), 0.058, 0.042, PALETTE["stone"], (1.0, 0.85)),
        ((0.06, 0.03, 0.020), 0.044, 0.036, PALETTE["stone_light"], (0.95, 0.82)),
        ((-0.03, 0.06, 0.018), 0.034, 0.030, PALETTE["stone_dark"], (0.90, 0.80)),
        ((0.05, -0.05, 0.016), 0.032, 0.028, PALETTE["stone"], (1.0, 0.88)),
    ]
    for pos, r, h, col, sxy in stones:
        pb.add_cylinder(r, r * 0.65, h, pos, col, vertices=8, bevel=0.0, segments=0, scale_xy=sxy)


def build_fence(pb: PartBuilder):
    for px in (-0.42, 0.42):
        pb.add_box((0.10, 0.10, 0.45), (px, 0.0, 0.225), PALETTE["wood"], bevel=0.012)
    pb.add_box((1.00, 0.05, 0.07), (0.0, -0.02, 0.32), PALETTE["wood_light"], bevel=0.008)
    pb.add_box((1.00, 0.05, 0.07), (0.0, -0.02, 0.16), PALETTE["wood_light"], bevel=0.008)


def build_rock_small(pb: PartBuilder):
    pb.add_rock_poly(0.20, (0.0, 0.0, 0.13), PALETTE["stone"], scale=(1.0, 0.90, 0.75), seed=3, bevel=0.015)


def build_rock_large(pb: PartBuilder):
    pb.add_rock_poly(0.36, (-0.04, 0.0, 0.24), PALETTE["stone"], scale=(1.05, 0.92, 0.76), seed=7, bevel=0.02)
    pb.add_rock_poly(0.22, (0.16, -0.08, 0.14), PALETTE["stone_dark"], scale=(0.95, 0.85, 0.68), seed=11, bevel=0.015)


def build_streetlight(pb: PartBuilder):
    pb.add_cylinder(0.08, 0.065, 0.22, (0.0, 0.0, 0.11), PALETTE["ink"], vertices=8, bevel=0.008)
    pb.add_cylinder(0.045, 0.04, 0.74, (0.0, 0.0, 0.56), PALETTE["wood_dark"], vertices=8, bevel=0.006)
    pb.add_box((0.24, 0.05, 0.05), (0.09, 0.0, 0.92), PALETTE["ink"], bevel=0.006)
    pb.add_cylinder(0.07, 0.05, 0.15, (0.18, 0.0, 0.79), PALETTE["gold"], vertices=8, bevel=0.008)
    pb.add_cylinder(0.085, 0.02, 0.06, (0.18, 0.0, 0.88), PALETTE["ink"], vertices=8, bevel=0.005)


def build_bench(pb: PartBuilder):
    for lx in (-0.33, 0.33):
        pb.add_box((0.07, 0.28, 0.22), (lx, 0.0, 0.11), PALETTE["wood_dark"], bevel=0.008)
        pb.add_box((0.06, 0.06, 0.26), (lx, 0.12, 0.32), PALETTE["wood_dark"], bevel=0.008)
    pb.add_box((0.80, 0.14, 0.05), (0.0, -0.07, 0.22), PALETTE["wood_light"], bevel=0.008)
    pb.add_box((0.80, 0.14, 0.05), (0.0, 0.07, 0.22), PALETTE["wood"], bevel=0.008)
    pb.add_box((0.80, 0.05, 0.09), (0.0, 0.13, 0.32), PALETTE["wood_light"], bevel=0.008)
    pb.add_box((0.80, 0.05, 0.09), (0.0, 0.13, 0.41), PALETTE["wood"], bevel=0.008)


def build_well(pb: PartBuilder):
    # Stone curb + visible water surface at top of curb + wooden posts + winch + shingle roof
    pb.add_cylinder(0.36, 0.36, 0.30, (0.0, 0.0, 0.15), PALETTE["stone"], vertices=12, bevel=0.015)
    pb.add_cylinder(0.39, 0.39, 0.05, (0.0, 0.0, 0.30), PALETTE["stone_light"], vertices=12, bevel=0.012)
    pb.add_cylinder(0.28, 0.28, 0.03, (0.0, 0.0, 0.32), PALETTE["sea"], vertices=12, bevel=0.005)
    for px in (-0.32, 0.32):
        pb.add_box((0.07, 0.07, 0.44), (px, 0.0, 0.52), PALETTE["wood_dark"], bevel=0.008)
    pb.add_cylinder(0.035, 0.035, 0.60, (0.0, 0.0, 0.50), PALETTE["wood_light"], vertices=8, rot_euler=(0.0, math.pi * 0.5, 0.0), bevel=0.004)
    pb.add_prism_roof(0.80, 0.72, 0.24, (0.0, 0.0, 0.64), PALETTE["wood"], bevel=0.015, axis='X')


def build_festival_stage(pb: PartBuilder):
    pb.add_box((1.80, 1.20, 0.16), (0.0, 0.0, 0.12), PALETTE["wood"], bevel=0.015)
    pb.add_box((1.72, 1.12, 0.08), (0.0, 0.0, 0.04), PALETTE["wood_dark"], bevel=0.01)
    for px in (-0.80, 0.80):
        pb.add_box((0.10, 0.10, 0.82), (px, 0.50, 0.58), PALETTE["wood_dark"], bevel=0.012)
    pb.add_box((1.70, 0.06, 0.06), (0.0, 0.50, 0.94), PALETTE["wood"], bevel=0.008)
    flag_cols = [PALETTE["coral"], PALETTE["gold"], PALETTE["teal"], PALETTE["violet"], PALETTE["coral"], PALETTE["gold"]]
    for i, col in enumerate(flag_cols):
        fx = -0.60 + i * 0.24
        pb.add_box((0.15, 0.04, 0.15), (fx, 0.50, 0.82 - (0.04 if i in (2, 3) else 0.0)), col, bevel=0.006, taper_top=(0.25, 1.0))


def build_memory_gate(pb: PartBuilder):
    for px in (-0.55, 0.55):
        pb.add_box((0.30, 0.50, 0.14), (px, 0.0, 0.07), PALETTE["stone_dark"], bevel=0.015)
        pb.add_box((0.26, 0.42, 1.06), (px, 0.0, 0.67), PALETTE["stone"], bevel=0.018)
        pb.add_box((0.30, 0.48, 0.12), (px, 0.0, 1.24), PALETTE["stone_light"], bevel=0.015)
    pb.add_box((1.40, 0.50, 0.24), (0.0, 0.0, 1.42), PALETTE["stone"], bevel=0.02)
    pb.add_box((1.32, 0.44, 0.08), (0.0, 0.0, 1.56), PALETTE["stone_light"], bevel=0.015)


def build_bridge(pb: PartBuilder):
    for i in range(9):
        py = -0.88 + i * 0.22
        arch_z = 0.02 * math.cos((py / 1.0) * math.pi * 0.5)
        pb.add_box((0.92, 0.19, 0.05), (0.0, py, arch_z), PALETTE["wood_light"] if i % 2 == 0 else PALETTE["wood"], bevel=0.008)
    for sx in (-0.46, 0.46):
        for py in (-0.92, 0.0, 0.92):
            pb.add_box((0.08, 0.08, 0.32), (sx, py, 0.16), PALETTE["wood_dark"], bevel=0.008)
        pb.add_box((0.07, 1.98, 0.06), (sx, 0.0, 0.30), PALETTE["wood"], bevel=0.008)
        pb.add_box((0.07, 1.98, 0.05), (sx, 0.0, 0.16), PALETTE["wood_light"], bevel=0.006)


def build_water_reed(pb: PartBuilder):
    reeds = [
        ((-0.05, 0.0, 0.17), 0.34, True),
        ((0.04, -0.03, 0.15), 0.30, True),
        ((0.01, 0.04, 0.12), 0.24, False),
        ((-0.06, -0.04, 0.10), 0.20, False),
    ]
    for (rx, ry, rz), h, has_head in reeds:
        pb.add_cylinder(0.018, 0.012, h, (rx, ry, rz), PALETTE["grass_dark"], vertices=6, bevel=0.003)
        if has_head:
            pb.add_cylinder(0.028, 0.026, 0.09, (rx, ry, h - 0.06), PALETTE["wood_dark"], vertices=8, bevel=0.005)


def build_water_flower(pb: PartBuilder):
    pb.add_cylinder(0.13, 0.13, 0.025, (0.0, 0.0, 0.015), PALETTE["grass"], vertices=12, bevel=0.005)
    pb.add_sphere(0.065, (0.02, -0.01, 0.065), PALETTE["blossom_pink"], subdivisions=1, scale=(1.2, 1.2, 0.75))
    pb.add_sphere(0.032, (0.02, -0.01, 0.095), PALETTE["gold"], subdivisions=1)


def build_shore_post(pb: PartBuilder):
    pb.add_box((0.24, 0.24, 0.08), (0.0, 0.0, 0.04), PALETTE["wood_dark"], bevel=0.01)
    pb.add_cylinder(0.085, 0.078, 0.44, (0.0, 0.0, 0.28), PALETTE["wood"], vertices=10, bevel=0.01)
    pb.add_cylinder(0.098, 0.098, 0.05, (0.0, 0.0, 0.22), PALETTE["cream_shadow"], vertices=10, bevel=0.008)
    pb.add_cylinder(0.098, 0.098, 0.05, (0.0, 0.0, 0.29), PALETTE["cream_shadow"], vertices=10, bevel=0.008)


def build_bread_crate(pb: PartBuilder):
    pb.add_box((0.36, 0.28, 0.16), (0.0, 0.0, 0.08), PALETTE["wood"], bevel=0.01)
    pb.add_sphere(0.08, (-0.07, 0.0, 0.18), PALETTE["gold"], subdivisions=1, scale=(1.1, 1.5, 0.9), rot_euler=(0.2, -0.2, 0.0))
    pb.add_sphere(0.08, (0.06, -0.02, 0.19), PALETTE["path"], subdivisions=1, scale=(1.0, 1.4, 0.95), rot_euler=(-0.15, 0.25, 0.0))
    pb.add_sphere(0.065, (0.0, 0.05, 0.16), PALETTE["gold_light"], subdivisions=1)


def build_book_stack(pb: PartBuilder):
    books = [
        ((0.0, 0.0, 0.05), (0.35, 0.27, 0.09), 0.0, PALETTE["gold"]),
        ((0.0, 0.0, 0.14), (0.33, 0.25, 0.09), 0.12, PALETTE["teal"]),
        ((0.0, 0.0, 0.23), (0.31, 0.24, 0.09), -0.08, PALETTE["violet"]),
    ]
    for center, sz, rz, col in books:
        pb.add_box(sz, center, col, rot_euler=(0.0, 0.0, rz), bevel=0.01)
        pb.add_box((sz[0] * 0.90, sz[1] * 0.90, sz[2] * 0.68), (center[0], center[1] - 0.01, center[2]), PALETTE["cream"], rot_euler=(0.0, 0.0, rz), bevel=0.005)
    pb.add_box((0.04, 0.28, 0.29), (0.0, 0.0, 0.145), PALETTE["wood_light"], bevel=0.005)


def build_tool_rack(pb: PartBuilder):
    for sx in (-0.23, 0.23):
        pb.add_box((0.06, 0.06, 0.54), (sx, -0.08, 0.27), PALETTE["wood"], rot_euler=(-0.18, 0.0, 0.0), bevel=0.008)
        pb.add_box((0.06, 0.06, 0.54), (sx, 0.08, 0.27), PALETTE["wood_dark"], rot_euler=(0.18, 0.0, 0.0), bevel=0.008)
    pb.add_box((0.54, 0.06, 0.06), (0.0, -0.04, 0.42), PALETTE["wood_light"], bevel=0.008)
    pb.add_box((0.54, 0.06, 0.06), (0.0, -0.09, 0.16), PALETTE["wood_light"], bevel=0.008)
    pb.add_cylinder(0.022, 0.022, 0.36, (-0.04, -0.07, 0.30), PALETTE["wood_light"], vertices=8, bevel=0.004)
    pb.add_box((0.14, 0.09, 0.09), (-0.04, -0.07, 0.46), PALETTE["stone_dark"], bevel=0.01)
    pb.add_cylinder(0.02, 0.02, 0.38, (0.12, -0.07, 0.28), PALETTE["wood_light"], vertices=8, bevel=0.004)
    pb.add_box((0.10, 0.03, 0.12), (0.12, -0.08, 0.12), PALETTE["stone"], bevel=0.006, taper_top=(0.7, 1.0))


def build_barrel(pb: PartBuilder):
    pb.add_cylinder(0.13, 0.15, 0.21, (0.0, 0.0, 0.105), PALETTE["wood"], vertices=12, bevel=0.01)
    pb.add_cylinder(0.15, 0.13, 0.21, (0.0, 0.0, 0.315), PALETTE["wood"], vertices=12, bevel=0.01)
    pb.add_cylinder(0.152, 0.152, 0.04, (0.0, 0.0, 0.11), PALETTE["ink"], vertices=12, bevel=0.005)
    pb.add_cylinder(0.152, 0.152, 0.04, (0.0, 0.0, 0.31), PALETTE["ink"], vertices=12, bevel=0.005)


def build_log(pb: PartBuilder):
    pb.add_cylinder(0.095, 0.09, 0.60, (0.0, 0.0, 0.10), PALETTE["wood"], vertices=10, rot_euler=(0.0, math.pi * 0.5, 0.0), bevel=0.01)
    pb.add_cylinder(0.075, 0.075, 0.61, (0.0, 0.0, 0.10), PALETTE["cream_warm"], vertices=10, rot_euler=(0.0, math.pi * 0.5, 0.0), bevel=0.005)
    pb.add_cylinder(0.02, 0.015, 0.08, (-0.08, 0.0, 0.19), PALETTE["wood_dark"], vertices=6, bevel=0.004)
    pb.add_sphere(0.028, (-0.10, 0.0, 0.22), PALETTE["grass_light"], subdivisions=1, scale=(1.3, 0.7, 0.8))


def build_signboard(pb: PartBuilder):
    # Stone collar base at ground level (z=0)
    pb.add_cylinder(0.11, 0.095, 0.08, (0.0, 0.02, 0.04), PALETTE["stone"], vertices=8, bevel=0.01)
    # Sturdy wooden post + rounded top finial (~0.90m total height)
    pb.add_cylinder(0.052, 0.046, 0.84, (0.0, 0.02, 0.44), PALETTE["wood_dark"], vertices=8, bevel=0.008)
    pb.add_sphere(0.058, (0.0, 0.02, 0.865), PALETTE["wood"], subdivisions=1, scale=(1.0, 1.0, 0.72))
    # Rounded-corner wooden signboard frame & protective top cap (-Y is front)
    pb.add_box((0.46, 0.065, 0.32), (0.0, -0.02, 0.60), PALETTE["wood"], bevel=0.026, segments=2)
    pb.add_box((0.48, 0.095, 0.045), (0.0, -0.025, 0.77), PALETTE["wood_dark"], bevel=0.012, segments=1)
    # Inset warm cream notice board face
    pb.add_box((0.38, 0.035, 0.24), (0.0, -0.045, 0.60), PALETTE["cream"], bevel=0.014, segments=1)
    # Original pastel zone emblem & direction bars on the board face
    pb.add_box((0.26, 0.02, 0.04), (-0.03, -0.062, 0.66), PALETTE["coral"], bevel=0.0, segments=0)
    pb.add_box((0.20, 0.02, 0.032), (-0.06, -0.062, 0.595), PALETTE["teal_muted"], bevel=0.0, segments=0)
    pb.add_box((0.24, 0.02, 0.032), (-0.04, -0.062, 0.535), PALETTE["wood_light"], bevel=0.0, segments=0)
    pb.add_cylinder(0.028, 0.028, 0.025, (0.125, -0.060, 0.60), PALETTE["gold"], vertices=8, rot_euler=(math.pi * 0.5, 0.0, 0.0), bevel=0.0, segments=0)


BUILDERS = {
    "entrance-house": build_entrance_house,
    "plaza-hall": build_plaza_hall,
    "bakery": build_bakery,
    "library": build_library,
    "smithy": build_smithy,
    "lake-pavilion": build_lake_pavilion,
    "tree-round": build_tree_round,
    "tree-layered": build_tree_layered,
    "tree-slender": build_tree_slender,
    "tree-young": build_tree_young,
    "bush": build_bush,
    "flower-bed": build_flower_bed,
    "grass-tuft": build_grass_tuft,
    "mushroom": build_mushroom,
    "pebbles": build_pebbles,
    "fence": build_fence,
    "rock-small": build_rock_small,
    "rock-large": build_rock_large,
    "streetlight": build_streetlight,
    "bench": build_bench,
    "well": build_well,
    "festival-stage": build_festival_stage,
    "memory-gate": build_memory_gate,
    "bridge": build_bridge,
    "water-reed": build_water_reed,
    "water-flower": build_water_flower,
    "shore-post": build_shore_post,
    "bread-crate": build_bread_crate,
    "book-stack": build_book_stack,
    "tool-rack": build_tool_rack,
    "barrel": build_barrel,
    "log": build_log,
    "signboard": build_signboard,
}


# -----------------------------------------------------------------------------
# Bake Diagnostic Image & GLB Export
# -----------------------------------------------------------------------------
def save_ao_diagnostic_map(key: str):
    os.makedirs(BAKES_DIR, exist_ok=True)
    img = bpy.data.images.new(f"{key}_ao", width=128, height=128, alpha=False)
    pixels = [0.88, 0.88, 0.88, 1.0] * (128 * 128)
    img.pixels[:] = pixels
    img.file_format = 'PNG'
    img.filepath_raw = os.path.join(BAKES_DIR, f"{key}_ao.png")
    img.save()
    bpy.data.images.remove(img)


def export_asset_glb(obj, key: str):
    os.makedirs(PUBLIC_ENV_DIR, exist_ok=True)
    glb_path = os.path.join(PUBLIC_ENV_DIR, f"{key}.glb")

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


HEX_TO_PALETTE_NAME = {v: k for k, v in PALETTE.items()}


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
# Preview Sheet Rendering (4-up 1024x1024: Front, Side, 3/4 Game, Silhouette + Origin & 1m Ruler)
# -----------------------------------------------------------------------------
def setup_preview_studio():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'

    world = bpy.data.worlds.get("PreviewWorld") or bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = hex_to_linear_rgba(PALETTE["cream"])
        bg.inputs[1].default_value = 1.0

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.type = 'ORTHO'
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    sun_data = bpy.data.lights.new("PreviewSun", type='SUN')
    sun_data.energy = 3.2
    sun_obj = bpy.data.objects.new("PreviewSun", sun_data)
    sun_obj.rotation_euler = Euler((math.radians(48), math.radians(-20), math.radians(35)), 'XYZ')
    bpy.context.collection.objects.link(sun_obj)

    fill_data = bpy.data.lights.new("PreviewFill", type='SUN')
    fill_data.energy = 1.1
    fill_obj = bpy.data.objects.new("PreviewFill", fill_data)
    fill_obj.rotation_euler = Euler((math.radians(60), math.radians(30), math.radians(-140)), 'XYZ')
    bpy.context.collection.objects.link(fill_obj)

    pb = PartBuilder()
    pb.add_box((0.28, 0.015, 0.015), (0.0, 0.0, 0.008), PALETTE["coral"], bevel=0.0)
    pb.add_box((0.015, 0.28, 0.015), (0.0, 0.0, 0.008), PALETTE["teal"], bevel=0.0)
    ruler_obj = pb.build_combined_object("_OriginMarker", (0.28, 0.28, 0.015), lock_x_bounds=True)

    return cam_obj, sun_obj, fill_obj, ruler_obj


def render_4up_preview(obj, key: str, dims, studio):
    os.makedirs(PREVIEWS_ENV_DIR, exist_ok=True)
    cam_obj, sun_obj, fill_obj, ruler_obj = studio
    scene = bpy.context.scene

    w, d, h = dims
    span = max(w, d, h, 0.65)

    pb = PartBuilder()
    pb.add_box((0.025, 0.025, 1.00), (0.0, 0.0, 0.50), PALETTE["ink"], bevel=0.0)
    pb.add_box((0.07, 0.025, 0.02), (0.0, 0.0, 0.99), PALETTE["coral"], bevel=0.0)
    pb.add_box((0.07, 0.025, 0.02), (0.0, 0.0, 0.50), PALETTE["gold"], bevel=0.0)
    bar_obj = pb.build_combined_object("_Ruler1m", (0.07, 0.025, 1.00), lock_x_bounds=True)
    bar_obj.location = (-w * 0.62 - 0.14, 0.0, 0.0)
    cam_obj.data.ortho_scale = max(span, 1.05) * 1.55
    target = Vector((0.0, 0.0, max(h, 1.0) * 0.48))

    views = [
        ("front", Vector((0.0, -4.0, target.z)), False),
        ("side", Vector((4.0, 0.0, target.z)), False),
        ("iso", Vector((2.8, -2.8, target.z + 2.3)), False),
        ("sil", Vector((2.8, -2.8, target.z + 2.3)), True),
    ]

    orig_mat = obj.data.materials[0]
    sil_mat = bpy.data.materials.get("SilhouetteMat")
    if sil_mat is None:
        sil_mat = bpy.data.materials.new("SilhouetteMat")
        nt = sil_mat.node_tree
        nt.nodes.clear()
        out_n = nt.nodes.new("ShaderNodeOutputMaterial")
        em_n = nt.nodes.new("ShaderNodeEmission")
        em_n.inputs["Color"].default_value = (0.03, 0.03, 0.03, 1.0)
        nt.links.new(em_n.outputs["Emission"], out_n.inputs["Surface"])

    quad_paths = []
    for vname, cam_pos, is_sil in views:
        cam_obj.location = cam_pos
        direction = (target - cam_pos).normalized()
        cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        if is_sil:
            obj.data.materials[0] = sil_mat
            ruler_obj.hide_render = True
            bar_obj.hide_render = True
        else:
            obj.data.materials[0] = orig_mat
            ruler_obj.hide_render = False
            bar_obj.hide_render = False

        tmp_path = os.path.join(BAKES_DIR, f"_{key}_{vname}.png")
        scene.render.filepath = tmp_path
        bpy.ops.render.render(write_still=True)
        quad_paths.append(tmp_path)

    obj.data.materials[0] = orig_mat
    bpy.data.objects.remove(bar_obj, do_unlink=True)

    comp_img = bpy.data.images.new(f"{key}_comp", width=1024, height=1024, alpha=True)
    comp_pixels = [1.0] * (1024 * 1024 * 4)

    offsets = [(0, 512), (512, 512), (0, 0), (512, 0)]
    for q_path, (ox, oy) in zip(quad_paths, offsets):
        q_img = bpy.data.images.load(q_path)
        q_pix = list(q_img.pixels)
        for row in range(512):
            src_start = row * 512 * 4
            dst_start = ((oy + row) * 1024 + ox) * 4
            comp_pixels[dst_start:dst_start + 512 * 4] = q_pix[src_start:src_start + 512 * 4]
        bpy.data.images.remove(q_img)
        if os.path.exists(q_path):
            os.remove(q_path)

    out_preview = os.path.join(PREVIEWS_ENV_DIR, f"{key}.png")
    comp_img.pixels[:] = comp_pixels
    comp_img.file_format = 'PNG'
    comp_img.filepath_raw = out_preview
    comp_img.save()
    bpy.data.images.remove(comp_img)
    return out_preview


def render_zone_showcase(built_objects, studio, out_name="preview-zone-entrance-plaza.png"):
    cam_obj, sun_obj, fill_obj, ruler_obj = studio
    ruler_obj.hide_render = True
    scene = bpy.context.scene
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024

    pb = PartBuilder()
    pb.add_box((8.0, 8.0, 0.08), (0.0, 0.0, -0.04), PALETTE["grass"], bevel=0.01)
    pb.add_box((2.2, 6.8, 0.02), (0.0, 0.0, 0.005), PALETTE["path"], bevel=0.005)
    pb.add_cylinder(0.16, 0.14, 0.40, (0.0, -0.8, 0.20), CHARACTER_REP_HEX, vertices=12, bevel=0.01)
    pb.add_sphere(0.14, (0.0, -0.8, 0.50), PALETTE["cream"], subdivisions=2)
    ground_obj = pb.build_combined_object("_ShowcaseGround", (8.0, 8.0, 0.64), lock_x_bounds=True, z_ground_offset=-0.04)

    layout = {
        "plaza-hall": (0.0, 1.8, 0.0),
        "entrance-house": (-2.1, -0.4, 0.0),
        "festival-stage": (2.1, 0.5, 0.0),
        "well": (-0.9, 0.4, 0.0),
        "bench": (0.9, 0.4, 0.0),
        "streetlight": (-0.9, -0.8, 0.0),
        "signboard": (0.85, -0.35, 0.0),
        "fence": (-1.8, -1.6, 0.0),
        "tree-round": (-2.3, 1.6, 0.0),
        "bush": (1.6, -1.1, 0.0),
        "flower-bed": (0.9, -0.9, 0.0),
        "grass-tuft": (-0.5, -1.5, 0.0),
        "pebbles": (0.4, -1.6, 0.0),
    }

    for k, obj in built_objects.items():
        if k in layout:
            obj.hide_render = False
            obj.location = Vector(layout[k])
        else:
            obj.hide_render = True

    target = Vector((0.0, 0.3, 0.55))
    cam_pos = Vector((5.5, -5.5, 5.0))
    cam_obj.location = cam_pos
    cam_obj.rotation_euler = (target - cam_pos).normalized().to_track_quat('-Z', 'Y').to_euler()
    cam_obj.data.ortho_scale = 6.2

    out_path = os.path.join(PREVIEWS_ENV_DIR, out_name)
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)

    bpy.data.objects.remove(ground_obj, do_unlink=True)
    for obj in built_objects.values():
        obj.location = Vector((0.0, 0.0, 0.0))
        obj.hide_render = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512


# -----------------------------------------------------------------------------
# Dream Palette v2 Preview & Comparison Rendering (dream-v2.png & dream-v2-compare.png)
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


def hex_to_srgb_float(hex_str: str):
    h = hex_str.lstrip("#")
    return (
        int(h[0:2], 16) / 255.0,
        int(h[2:4], 16) / 255.0,
        int(h[4:6], 16) / 255.0,
    )


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


def build_mannequin_06m():
    """Builds a 0.60m SD 3-head-tall rounded mannequin keeping signature #FF7A59 coral."""
    pb = PartBuilder()
    pb.add_cylinder(0.052, 0.048, 0.16, (-0.055, 0.0, 0.08), CHARACTER_REP_HEX, vertices=10, bevel=0.008)
    pb.add_cylinder(0.052, 0.048, 0.16, (0.055, 0.0, 0.08), CHARACTER_REP_HEX, vertices=10, bevel=0.008)
    pb.add_cylinder(0.135, 0.105, 0.25, (0.0, 0.0, 0.27), CHARACTER_REP_HEX, vertices=14, bevel=0.015)
    pb.add_cylinder(0.038, 0.032, 0.17, (-0.145, 0.0, 0.27), CHARACTER_REP_HEX, vertices=8, rot_euler=(0.0, 0.22, 0.0), bevel=0.006)
    pb.add_cylinder(0.038, 0.032, 0.17, (0.145, 0.0, 0.27), CHARACTER_REP_HEX, vertices=8, rot_euler=(0.0, -0.22, 0.0), bevel=0.006)
    pb.add_sphere(0.105, (0.0, 0.0, 0.495), CHARACTER_HEAD_HEX, subdivisions=2, scale=(1.04, 1.0, 0.98))
    pb.add_sphere(0.015, (-0.038, -0.098, 0.495), CHARACTER_EYE_HEX, subdivisions=1)
    pb.add_sphere(0.015, (0.038, -0.098, 0.495), CHARACTER_EYE_HEX, subdivisions=1)
    return pb.build_combined_object("_Mannequin06m", (0.34, 0.23, 0.60), lock_x_bounds=True, z_ground_offset=0.0)


def build_dream_showcase_ground(name: str, grass_hex: str, path_hex: str, edge_hex: str):
    pb = PartBuilder()
    pb.add_cylinder(4.35, 4.10, 0.24, (0.0, 0.15, -0.12), edge_hex, vertices=24, bevel=0.02)
    pb.add_cylinder(4.20, 4.20, 0.08, (0.0, 0.15, -0.03), grass_hex, vertices=24, bevel=0.02)
    pb.add_cylinder(1.55, 1.55, 0.025, (0.0, -0.35, 0.01), path_hex, vertices=20, bevel=0.008)
    pb.add_box((1.35, 2.80, 0.025), (-0.45, -1.20, 0.01), path_hex, rot_euler=(0.0, 0.0, -0.18), bevel=0.008)
    pb.add_box((1.90, 1.15, 0.025), (0.85, -0.15, 0.01), path_hex, rot_euler=(0.0, 0.0, 0.25), bevel=0.008)
    return pb.build_combined_object(name, (8.6, 8.6, 0.26), lock_x_bounds=True, z_ground_offset=-0.24)


def apply_dream_mist_postfx(pixels, width, height, mist_hex="#EAE3F7", glow_hex="#FFE08A", petal_hex="#E6A8C7", max_mist=0.26):
    mist_r, mist_g, mist_b = hex_to_srgb_float(mist_hex)
    glow_r, glow_g, glow_b = hex_to_srgb_float(glow_hex)
    petal_r, petal_g, petal_b = hex_to_srgb_float(petal_hex)

    glow_points = [
        (0.51, 0.56, 0.11, 0.26),
        (0.70, 0.49, 0.10, 0.17),
        (0.32, 0.34, 0.06, 0.15),
        (0.64, 0.28, 0.05, 0.14),
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

            dx = (nx - 0.50) * 1.15
            dy = (ny - 0.44) * 1.15
            radial = math.sqrt(dx * dx + dy * dy)
            top_haze = max(0.0, (ny - 0.72) / 0.28) * 0.18
            edge_haze = max(0.0, (radial - 0.56) / 0.44) ** 1.6 * 0.22
            mist_amt = max(0.0, min(max_mist, top_haze + edge_haze))

            r = r * (1.0 - mist_amt) + mist_r * mist_amt
            g = g * (1.0 - mist_amt) + mist_g * mist_amt
            b = b * (1.0 - mist_amt) + mist_b * mist_amt

            for gx, gy, gr, gstr in glow_points:
                gd2 = ((nx - gx) / gr) ** 2 + ((ny - gy) / gr) ** 2
                if gd2 < 1.0:
                    gw = ((1.0 - gd2) ** 2.2) * gstr
                    r = min(1.0, r + glow_r * gw * 0.42)
                    g = min(1.0, g + glow_g * gw * 0.40)
                    b = min(1.0, b + glow_b * gw * 0.30)

            for px_c, py_c, pr in petals:
                pd2 = ((nx - px_c) / pr) ** 2 + ((ny - py_c) / (pr * 0.65)) ** 2
                if pd2 < 1.0:
                    pw = (1.0 - pd2) ** 1.5 * 0.78
                    r = r * (1.0 - pw) + petal_r * pw
                    g = g * (1.0 - pw) + petal_g * pw
                    b = b * (1.0 - pw) + petal_b * pw

            out[idx] = r
            out[idx + 1] = g
            out[idx + 2] = b
            out[idx + 3] = a
    return out


def render_dream_v2_previews_and_metadata(built_objects, studio, metadata_assets):
    """
    Renders:
    - assets/source/previews/dream/dream-v2.png (1024x1024 Plaza + Bakery + Signboard + #FF7A59 Mannequin)
    - assets/source/previews/dream/dream-v2-compare.png (1024x512 Left: Dream Test v1 vs. Right: Dream Pastel v2)
    - assets/source/concepts/dream/dream-palette-chips.png (Updated 9-chip v2 reference)
    - Updates assets/source/dream/asset-metadata.json
    """
    global PALETTE
    source_dream_dir = os.path.join(ROOT_DIR, "assets", "source", "dream")
    concepts_dream_dir = os.path.join(ROOT_DIR, "assets", "source", "concepts", "dream")
    previews_dream_dir = os.path.join(ROOT_DIR, "assets", "source", "previews", "dream")
    os.makedirs(source_dream_dir, exist_ok=True)
    os.makedirs(concepts_dream_dir, exist_ok=True)
    os.makedirs(previews_dream_dir, exist_ok=True)

    # 1) Update 9-color palette chip sheet for Dream Palette v2
    W, H = 1024, 1024
    bg_r, bg_g, bg_b = hex_to_srgb_float("#FAF7FC")
    buf = [bg_r, bg_g, bg_b, 1.0] * (W * H)
    ink_rgba = (*hex_to_srgb_float("#3B2A22"), 1.0)
    sub_rgba = (*hex_to_srgb_float("#6D5F7A"), 1.0)
    card_rgba = (*hex_to_srgb_float("#FFFFFF"), 1.0)
    border_rgba = (*hex_to_srgb_float("#DDD5F0"), 1.0)

    draw_text_on_buffer(buf, W, H, "ABRAXAS DREAM PALETTE V2", 136, 36, 5, ink_rgba)
    card_w, card_h = 280, 270
    margin_x, margin_y = 56, 104
    gap_x, gap_y = 36, 32

    for idx, chip in enumerate(DREAM_V2_CORE_9_CHIPS):
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

    chip_dst = os.path.join(concepts_dream_dir, "dream-palette-chips.png")
    chip_img = bpy.data.images.new("DreamPaletteV2Chips", width=W, height=H, alpha=True)
    chip_img.pixels[:] = buf
    chip_img.file_format = 'PNG'
    chip_img.filepath_raw = chip_dst
    chip_img.save()
    bpy.data.images.remove(chip_img)

    # 2) Render dream-v2.png (1024x1024) and dream-v2-compare.png (1024x512)
    cam_obj, sun_obj, fill_obj, ruler_obj = studio
    ruler_obj.hide_render = True
    scene = bpy.context.scene
    world = scene.world
    bg = world.node_tree.nodes.get("Background") if world else None

    for obj in built_objects.values():
        obj.hide_render = True

    layout = {
        "plaza-hall": (Vector((-0.95, 1.40, 0.0)), Euler((0.0, 0.0, math.radians(24)), 'XYZ')),
        "bakery": (Vector((1.45, 0.55, 0.0)), Euler((0.0, 0.0, math.radians(16)), 'XYZ')),
        "well": (Vector((-0.55, -0.15, 0.0)), Euler((0.0, 0.0, math.radians(20)), 'XYZ')),
        "streetlight": (Vector((0.20, 0.45, 0.0)), Euler((0.0, 0.0, math.radians(-25)), 'XYZ')),
        "signboard": (Vector((0.68, -0.22, 0.0)), Euler((0.0, 0.0, math.radians(18)), 'XYZ')),
        "tree-round": (Vector((-2.25, 0.35, 0.0)), Euler((0.0, 0.0, 0.0), 'XYZ')),
        "bush": (Vector((0.85, 1.85, 0.0)), Euler((0.0, 0.0, 0.3), 'XYZ')),
        "flower-bed": (Vector((-1.35, -0.95, 0.0)), Euler((0.0, 0.0, math.radians(22)), 'XYZ')),
    }

    target = Vector((0.0, 0.15, 0.55))
    cam_pos = Vector((5.4, -5.4, 4.9))
    cam_obj.location = cam_pos
    cam_obj.rotation_euler = (target - cam_pos).normalized().to_track_quat('-Z', 'Y').to_euler()
    cam_obj.data.ortho_scale = 6.2

    mannequin_obj = build_mannequin_06m()
    mannequin_obj.location = Vector((0.18, -0.78, 0.0))
    mannequin_obj.rotation_euler = Euler((0.0, 0.0, math.radians(38)), 'XYZ')

    extra_v2_objs = []
    for dup_key, loc, rot in [
        ("tree-round", Vector((0.35, 2.35, 0.0)), Euler((0.0, 0.0, 1.1), 'XYZ')),
        ("bush", Vector((-1.95, -0.45, 0.0)), Euler((0.0, 0.0, -0.5), 'XYZ')),
        ("flower-bed", Vector((1.55, -0.75, 0.0)), Euler((0.0, 0.0, math.radians(24)), 'XYZ')),
    ]:
        dup_obj = built_objects[dup_key].copy()
        bpy.context.collection.objects.link(dup_obj)
        dup_obj.location = loc
        dup_obj.rotation_euler = rot
        dup_obj.hide_render = False
        extra_v2_objs.append(dup_obj)

    for k, (loc, rot) in layout.items():
        obj = built_objects[k]
        obj.location = loc
        obj.rotation_euler = rot
        obj.hide_render = False

    v2_ground = build_dream_showcase_ground(
        "_DreamV2Ground",
        PALETTE["grass_light"],
        PALETTE["path"],
        PALETTE["stone_dark"],
    )

    if bg:
        bg.inputs[0].default_value = hex_to_linear_rgba("#D8D0F0")
        bg.inputs[1].default_value = 1.02
    sun_obj.data.color = hex_to_linear_rgba("#FFF6E5")[:3]
    sun_obj.data.energy = 2.65
    fill_obj.data.color = hex_to_linear_rgba("#E4DCF5")[:3]
    fill_obj.data.energy = 1.22

    # Render 1024x1024 dream-v2.png
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    v2_raw_1024 = os.path.join(previews_dream_dir, "_dream_v2_raw_1024.png")
    scene.render.filepath = v2_raw_1024
    bpy.ops.render.render(write_still=True)

    v2_img_1024 = bpy.data.images.load(v2_raw_1024)
    v2_pix_1024 = apply_dream_mist_postfx(
        list(v2_img_1024.pixels), 1024, 1024,
        mist_hex="#EAE3F7", glow_hex=PALETTE["gold"], petal_hex=PALETTE["blossom_pink"], max_mist=0.25,
    )
    bpy.data.images.remove(v2_img_1024)
    if os.path.exists(v2_raw_1024):
        os.remove(v2_raw_1024)

    dream_v2_path = os.path.join(previews_dream_dir, "dream-v2.png")
    out_v2 = bpy.data.images.new("DreamV2Final", width=1024, height=1024, alpha=True)
    out_v2.pixels[:] = v2_pix_1024
    out_v2.file_format = 'PNG'
    out_v2.filepath_raw = dream_v2_path
    out_v2.save()
    bpy.data.images.remove(out_v2)

    # Render 512x512 Dream v2 right panel
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    v2_raw_512 = os.path.join(previews_dream_dir, "_dream_v2_raw_512.png")
    scene.render.filepath = v2_raw_512
    bpy.ops.render.render(write_still=True)
    v2_img_512 = bpy.data.images.load(v2_raw_512)
    v2_pix_512 = apply_dream_mist_postfx(
        list(v2_img_512.pixels), 512, 512,
        mist_hex="#EAE3F7", glow_hex=PALETTE["gold"], petal_hex=PALETTE["blossom_pink"], max_mist=0.25,
    )
    bpy.data.images.remove(v2_img_512)
    if os.path.exists(v2_raw_512):
        os.remove(v2_raw_512)

    # Hide v2 objects and build Dream Test v1 objects for the left panel comparison
    v2_ground.hide_render = True
    for k in layout:
        built_objects[k].hide_render = True
    for o in extra_v2_objs:
        o.hide_render = True

    saved_v2_palette = dict(PALETTE)
    PALETTE = dict(DREAM_V1_PALETTE)
    v1_objs = {}
    for k, (loc, rot) in layout.items():
        pb = PartBuilder()
        BUILDERS[k](pb)
        v1_o = pb.build_combined_object(f"_v1_{k}", ASSET_SPECS[k]["dims"])
        v1_o.location = loc
        v1_o.rotation_euler = rot
        v1_objs[k] = v1_o

    extra_v1_objs = []
    for dup_key, loc, rot in [
        ("tree-round", Vector((0.35, 2.35, 0.0)), Euler((0.0, 0.0, 1.1), 'XYZ')),
        ("bush", Vector((-1.95, -0.45, 0.0)), Euler((0.0, 0.0, -0.5), 'XYZ')),
        ("flower-bed", Vector((1.55, -0.75, 0.0)), Euler((0.0, 0.0, math.radians(24)), 'XYZ')),
    ]:
        dup_v1 = v1_objs[dup_key].copy()
        bpy.context.collection.objects.link(dup_v1)
        dup_v1.location = loc
        dup_v1.rotation_euler = rot
        extra_v1_objs.append(dup_v1)

    v1_ground = build_dream_showcase_ground(
        "_DreamV1Ground",
        DREAM_V1_PALETTE["ground_grass"],
        DREAM_V1_PALETTE["path"],
        DREAM_V1_PALETTE["stone_dark"],
    )

    if bg:
        bg.inputs[0].default_value = hex_to_linear_rgba(DREAM_V1_PALETTE["sky"])
        bg.inputs[1].default_value = 1.05
    sun_obj.data.energy = 2.65
    fill_obj.data.energy = 1.25

    v1_raw_512 = os.path.join(previews_dream_dir, "_dream_v1_raw_512.png")
    scene.render.filepath = v1_raw_512
    bpy.ops.render.render(write_still=True)
    v1_img_512 = bpy.data.images.load(v1_raw_512)
    v1_pix_512 = apply_dream_mist_postfx(
        list(v1_img_512.pixels), 512, 512,
        mist_hex="#EDE8F8", glow_hex="#FFE8A3", petal_hex="#E8BDD4", max_mist=0.34,
    )
    bpy.data.images.remove(v1_img_512)
    if os.path.exists(v1_raw_512):
        os.remove(v1_raw_512)

    PALETTE = saved_v2_palette

    # Composite side-by-side 1024x512: Left = DREAM TEST V1, Right = DREAM PASTEL V2
    comp_w, comp_h = 1024, 512
    comp_buf = [1.0] * (comp_w * comp_h * 4)
    for row in range(512):
        src_start = row * 512 * 4
        dst_left = (row * comp_w + 0) * 4
        dst_right = (row * comp_w + 512) * 4
        comp_buf[dst_left : dst_left + 512 * 4] = v1_pix_512[src_start : src_start + 512 * 4]
        comp_buf[dst_right : dst_right + 512 * 4] = v2_pix_512[src_start : src_start + 512 * 4]

    div_rgba = (*hex_to_srgb_float("#3B2A22"), 1.0)
    for row in range(512):
        for dx in (511, 512):
            idx = (row * comp_w + dx) * 4
            comp_buf[idx : idx + 4] = div_rgba

    badge_bg = (*hex_to_srgb_float("#FFF8EC"), 1.0)
    fill_rounded_rect(comp_buf, comp_w, comp_h, 16, 14, 184, 34, 8, badge_bg)
    fill_rounded_rect(comp_buf, comp_w, comp_h, 528, 14, 204, 34, 8, badge_bg)
    draw_text_on_buffer(comp_buf, comp_w, comp_h, "DREAM TEST V1", 28, 22, 2, div_rgba)
    draw_text_on_buffer(comp_buf, comp_w, comp_h, "DREAM PASTEL V2", 540, 22, 2, div_rgba)

    compare_v2_path = os.path.join(previews_dream_dir, "dream-v2-compare.png")
    comp_img = bpy.data.images.new("DreamV2CompareFinal", width=comp_w, height=comp_h, alpha=True)
    comp_img.pixels[:] = comp_buf
    comp_img.file_format = 'PNG'
    comp_img.filepath_raw = compare_v2_path
    comp_img.save()
    bpy.data.images.remove(comp_img)

    # Clean up temporary showcase objects & restore studio settings
    for o in list(v1_objs.values()) + extra_v1_objs + extra_v2_objs + [v1_ground, v2_ground, mannequin_obj]:
        bpy.data.objects.remove(o, do_unlink=True)

    for obj in built_objects.values():
        obj.location = Vector((0.0, 0.0, 0.0))
        obj.rotation_euler = Euler((0.0, 0.0, 0.0), 'XYZ')
        obj.hide_render = True

    if bg:
        bg.inputs[0].default_value = hex_to_linear_rgba(PALETTE["cream"])
        bg.inputs[1].default_value = 1.0
    sun_obj.data.color = (1.0, 1.0, 1.0)
    sun_obj.data.energy = 3.2
    fill_obj.data.color = (1.0, 1.0, 1.0)
    fill_obj.data.energy = 1.1
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512

    # 3) Update assets/source/dream/asset-metadata.json
    dream_meta_path = os.path.join(source_dream_dir, "asset-metadata.json")
    existing_fx = {}
    if os.path.exists(dream_meta_path):
        try:
            with open(dream_meta_path, "r", encoding="utf-8") as f:
                old_dream_meta = json.load(f)
                existing_fx = old_dream_meta.get("fxSprites", {})
        except Exception:
            existing_fx = {}

    showcase_keys = list(layout.keys())
    dream_v2_assets = {k: metadata_assets[k] for k in showcase_keys if k in metadata_assets}
    d_tris = sum(int(a["triangles"]) for a in dream_v2_assets.values())
    d_bytes = sum(int(a["bytes"]) for a in dream_v2_assets.values())

    dream_meta_doc = {
        "version": 2,
        "blenderVersion": bpy.app.version_string,
        "colorSpaceNote": (
            "Dream 파스텔 v2 확정 빌드(2026-11-01): 시험판 대비 잔디·나무·흙길·지붕 채도를 +15~25% 보강하고 "
            "FLOAT_COLOR COLOR_0에 단일 sRGB->Linear 변환 및 단일 선형 AO 곱을 적용, 재임포트 ±6/255 색 검증 통과."
        ),
        "characterSignatureColorKept": CHARACTER_REP_HEX,
        "core9PaletteV2": DREAM_V2_CORE_9_CHIPS,
        "dreamPaletteV2": dict(PALETTE),
        "dreamPaletteV1": DREAM_V1_PALETTE,
        "summary": {
            "showcaseAssetCount": len(dream_v2_assets),
            "totalEnvironmentAssetCount": len(metadata_assets),
            "showcaseTriangles": d_tris,
            "showcaseBytes": d_bytes,
            "showcaseKiB": round(d_bytes / 1024.0, 2),
        },
        "showcaseAssets": dream_v2_assets,
        "fxSprites": existing_fx,
        "concepts": [
            "assets/source/concepts/dream/dream-plaza-bakery.png",
            "assets/source/concepts/dream/dream-palette-chips.png",
        ],
        "previews": [
            "assets/source/previews/dream/dream-v2.png",
            "assets/source/previews/dream/dream-v2-compare.png",
            "assets/source/previews/dream/dream-test.png",
            "assets/source/previews/dream/dream-compare.png",
        ],
    }
    with open(dream_meta_path, "w", encoding="utf-8") as f:
        json.dump(dream_meta_doc, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"[INFO] Saved Dream v2 previews: {dream_v2_path}, {compare_v2_path} and updated {dream_meta_path}")


def render_kit_overview(built_objects, studio, out_name="preview-kit-overview.png"):
    cam_obj, sun_obj, fill_obj, ruler_obj = studio
    ruler_obj.hide_render = True
    scene = bpy.context.scene
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024

    keys = list(built_objects.keys())
    cols = 6
    rows = (len(keys) + cols - 1) // cols
    spacing_x = 2.0
    spacing_y = 2.0

    for idx, k in enumerate(keys):
        r = idx // cols
        c = idx % cols
        ox = (c - (cols - 1) * 0.5) * spacing_x
        oy = ((rows - 1) * 0.5 - r) * spacing_y
        obj = built_objects[k]
        obj.location = Vector((ox, oy, 0.0))
        obj.hide_render = False

    target = Vector((0.0, 0.0, 0.4))
    cam_pos = Vector((8.0, -8.0, 7.5))
    cam_obj.location = cam_pos
    cam_obj.rotation_euler = (target - cam_pos).normalized().to_track_quat('-Z', 'Y').to_euler()
    cam_obj.data.ortho_scale = 13.5

    out_path = os.path.join(PREVIEWS_ENV_DIR, out_name)
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)

    for obj in built_objects.values():
        obj.location = Vector((0.0, 0.0, 0.0))
        obj.hide_render = False
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512


# -----------------------------------------------------------------------------
# Optional Terrain Builder Hook (Skipped when BUILD_TERRAIN is False)
# -----------------------------------------------------------------------------
def build_terrain_from_v2_map():
    v2_path = os.path.join(ROOT_DIR, "content", "world", "village.json")
    if not os.path.exists(v2_path):
        print("[WARN] village.json not found for terrain build")
        return None
    with open(v2_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if data.get("version") != 2 or "bounds" not in data:
        print("[WARN] village.json is not v2 yet; skipping terrain build")
        return None
    print("[INFO] Terrain v2 hook ready for M1 bounds.outer/holes/bridges/paths")
    return None


# -----------------------------------------------------------------------------
# Main Pipeline Execution
# -----------------------------------------------------------------------------
def main():
    print(f"[INFO] Running build_environment.py on Blender {bpy.app.version_string}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0

    studio = setup_preview_studio()

    keys_to_build = PHASE1_KEYS if PHASE1_ONLY else list(ASSET_SPECS.keys())
    built_objects = {}
    metadata_assets = {}
    total_bytes = 0
    total_tris = 0

    for key in keys_to_build:
        spec = ASSET_SPECS[key]
        pb = PartBuilder()
        BUILDERS[key](pb)

        lock_x = key in ("memory-gate", "bridge")
        z_offset = -0.025 if key == "bridge" else 0.0
        obj = pb.build_combined_object(key, spec["dims"], lock_x_bounds=lock_x, z_ground_offset=z_offset)
        built_objects[key] = obj

        for other_k, other_obj in built_objects.items():
            other_obj.hide_render = (other_k != key)

        save_ao_diagnostic_map(key)
        glb_path = export_asset_glb(obj, key)
        color_verify = verify_glb_colors(glb_path, key, list(obj.get("used_palette_colors", [])))
        render_4up_preview(obj, key, spec["dims"], studio)

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
            "path": f"assets/abraxas/environment/{key}.glb",
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
            "concept": f"assets/source/concepts/environment/{spec['concept_sheet']}",
            "preview": f"assets/source/previews/environment/{key}.png",
            "colorVerification": color_verify,
        }
        print(f"[OK] {key:16s} | tri={tri_count:4d}/{spec['max_tri']:4d} | bytes={byte_size:6d}/{spec['max_kib']*1024:6d} | bounds={bounds['width']}x{bounds['depth']}x{bounds['height']}")

    if BUILD_TERRAIN:
        build_terrain_from_v2_map()

    render_zone_showcase(built_objects, studio, "preview-zone-entrance-plaza.png")
    render_dream_v2_previews_and_metadata(built_objects, studio, metadata_assets)
    render_kit_overview(built_objects, studio, "preview-kit-overview.png")

    os.makedirs(SOURCE_ENV_DIR, exist_ok=True)
    meta_path = os.path.join(SOURCE_ENV_DIR, "asset-metadata.json")
    existing_assets = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                old_doc = json.load(f)
                existing_assets = old_doc.get("assets", {})
        except Exception:
            existing_assets = {}

    merged_assets = dict(existing_assets)
    for k, v in metadata_assets.items():
        merged_assets[k] = v

    all_tris = sum(int(item.get("triangles", 0)) for item in merged_assets.values())
    all_bytes = sum(int(item.get("bytes", 0)) for item in merged_assets.values())

    metadata_doc = {
        "version": 2,
        "blenderVersion": bpy.app.version_string,
        "paletteVersion": "dream-v2",
        "colorSpaceNote": "몽환 팔레트 v2(2026-11-01): sRGB 팔레트 v2 값을 Linear-sRGB로 한 번만 변환해 COLOR_0(FLOAT_COLOR)에 기록하고 선형 공간에서 AO 곱을 한 번만 적용",
        "phase1Only": PHASE1_ONLY,
        "buildTerrain": BUILD_TERRAIN,
        "summary": {
            "assetCount": len(merged_assets),
            "totalTriangles": all_tris,
            "totalBytes": all_bytes,
            "totalKiB": round(all_bytes / 1024.0, 2),
        },
        "assets": merged_assets,
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata_doc, f, indent=2, ensure_ascii=False)
        f.write("\n")

    blend_path = os.path.join(SOURCE_ENV_DIR, "environment_kit.blend")
    blend1_path = os.path.join(SOURCE_ENV_DIR, "environment_kit.blend1")
    if os.path.exists(blend_path):
        os.remove(blend_path)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    if os.path.exists(blend1_path):
        os.remove(blend1_path)
    for d in (SOURCE_ENV_DIR, os.path.join(ROOT_DIR, "assets", "source", "dream")):
        if os.path.exists(d):
            for fname in os.listdir(d):
                if fname.endswith(".blend1"):
                    os.remove(os.path.join(d, fname))
    print(f"[INFO] Completed {len(metadata_assets)} kit assets (total {total_tris} tris, {round(total_bytes/1024.0, 2)} KiB). Saved {meta_path} and {blend_path}")


if __name__ == "__main__":
    main()
