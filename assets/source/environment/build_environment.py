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
# Palette & Color Utilities (sRGB -> Linear sRGB)
# -----------------------------------------------------------------------------
PALETTE = {
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


def srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_str: str, tint: float = 1.0):
    h = hex_str.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    rl = max(0.0, min(1.0, srgb_to_linear(r) * tint))
    gl = max(0.0, min(1.0, srgb_to_linear(g) * tint))
    bl = max(0.0, min(1.0, srgb_to_linear(b) * tint))
    return (rl, gl, bl, 1.0)


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

        col_attr = final_mesh.color_attributes.new(name="COLOR_0", type='BYTE_COLOR', domain='CORNER')
        base_rgba = hex_to_linear_rgba(color_hex, 1.0)

        zs = [v.co.z for v in final_mesh.vertices] or [0.0]
        z_min, z_max = min(zs), max(zs)
        z_span = max(0.05, z_max - z_min)

        for poly in final_mesh.polygons:
            nz = poly.normal.z
            ny = -poly.normal.y
            normal_boost = 1.0 + 0.06 * nz + 0.03 * ny
            for loop_idx in poly.loop_indices:
                v_idx = final_mesh.loops[loop_idx].vertex_index
                vz = final_mesh.vertices[v_idx].co.z
                t_z = (vz - z_min) / z_span
                height_boost = (1.0 - shade_gradient * 0.6) + shade_gradient * t_z
                factor = max(0.75, min(1.12, normal_boost * height_boost))
                col_attr.data[loop_idx].color = (
                    min(1.0, base_rgba[0] * factor),
                    min(1.0, base_rgba[1] * factor),
                    min(1.0, base_rgba[2] * factor),
                    1.0,
                )

        self.parts.append(final_mesh)

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
        col_layer = bm.loops.layers.color.new("COLOR_0")

        for part_mesh in self.parts:
            part_bm = bmesh.new()
            part_bm.from_mesh(part_mesh)
            p_col = part_bm.loops.layers.color.get("COLOR_0")

            vert_map = {}
            for v in part_bm.verts:
                vert_map[v.index] = bm.verts.new(v.co)
            bm.verts.ensure_lookup_table()

            for f in part_bm.faces:
                try:
                    new_f = bm.faces.new([vert_map[v.index] for v in f.verts])
                    new_f.smooth = f.smooth
                    if p_col is not None:
                        for l_src, l_dst in zip(f.loops, new_f.loops):
                            l_dst[col_layer] = l_src[p_col]
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

        for f in bm.faces:
            for loop in f.loops:
                v = loop.vert
                h_norm = max(0.0, min(1.0, (v.co.z - z_ground_offset) / max(0.1, th)))
                radial = math.sqrt((v.co.x / max(0.1, tw * 0.5)) ** 2 + (v.co.y / max(0.1, td * 0.5)) ** 2)
                ground_ao = 0.82 + 0.18 * math.sqrt(h_norm)
                cavity_ao = 0.88 + 0.12 * min(1.0, radial)
                ao = max(0.76, min(1.0, ground_ao * cavity_ao))
                c = loop[col_layer]
                loop[col_layer] = (c[0] * ao, c[1] * ao, c[2] * ao, 1.0)

        mesh = bpy.data.meshes.new(key)
        bm.to_mesh(mesh)
        bm.free()

        if "COLOR_0" in mesh.color_attributes:
            mesh.color_attributes.active_color = mesh.color_attributes["COLOR_0"]
            mesh.color_attributes.render_color_index = 0

        mat = get_or_create_diorama_material("AbraxasEnvMat", roughness=0.85)
        mesh.materials.append(mat)

        obj = bpy.data.objects.new(key, mesh)
        bpy.context.collection.objects.link(obj)
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
    pb.add_cylinder(0.16, 0.14, 0.40, (0.0, -0.8, 0.20), PALETTE["coral"], vertices=12, bevel=0.01)
    pb.add_sphere(0.14, (0.0, -0.8, 0.50), PALETTE["cream"], subdivisions=2)
    ground_obj = pb.build_combined_object("_ShowcaseGround", (8.0, 8.0, 0.64), lock_x_bounds=True, z_ground_offset=-0.04)

    layout = {
        "plaza-hall": (0.0, 1.8, 0.0),
        "entrance-house": (-2.1, -0.4, 0.0),
        "festival-stage": (2.1, 0.5, 0.0),
        "well": (-0.9, 0.4, 0.0),
        "bench": (0.9, 0.4, 0.0),
        "streetlight": (-0.9, -0.8, 0.0),
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

    sync_concept_images()
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
            "dracoCompressed": True,
            "concept": f"assets/source/concepts/environment/{spec['concept_sheet']}",
            "preview": f"assets/source/previews/environment/{key}.png",
        }
        print(f"[OK] {key:16s} | tri={tri_count:4d}/{spec['max_tri']:4d} | bytes={byte_size:6d}/{spec['max_kib']*1024:6d} | bounds={bounds['width']}x{bounds['depth']}x{bounds['height']}")

    if BUILD_TERRAIN:
        build_terrain_from_v2_map()

    render_zone_showcase(built_objects, studio, "preview-zone-entrance-plaza.png")
    render_kit_overview(built_objects, studio, "preview-kit-overview.png")

    os.makedirs(SOURCE_ENV_DIR, exist_ok=True)
    metadata_doc = {
        "version": 1,
        "blenderVersion": bpy.app.version_string,
        "phase1Only": PHASE1_ONLY,
        "buildTerrain": BUILD_TERRAIN,
        "summary": {
            "assetCount": len(metadata_assets),
            "totalTriangles": total_tris,
            "totalBytes": total_bytes,
            "totalKiB": round(total_bytes / 1024.0, 2),
        },
        "assets": metadata_assets,
    }
    meta_path = os.path.join(SOURCE_ENV_DIR, "asset-metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata_doc, f, indent=2, ensure_ascii=False)

    blend_path = os.path.join(SOURCE_ENV_DIR, "environment_kit.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[INFO] Completed {len(metadata_assets)} assets (total {total_tris} tris, {round(total_bytes/1024.0, 2)} KiB). Saved {meta_path} and {blend_path}")


if __name__ == "__main__":
    main()
