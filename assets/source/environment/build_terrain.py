# -*- coding: utf-8 -*-
"""
Abraxas Continuous Terrain Builder for Blender 5.2+
Reads content/world/village.json (v2: bounds.outer, bounds.holes, bounds.bridges, paths, coast: organic-v1)
and generates a single continuous low-poly diorama island mesh (terrain.glb):
- World coordinates match village.json (x -> X, z -> Z in Three.js after +Y-up glTF export).
- Origin at (0, 0, 0), top surface at y = 0.0, island thickness 0.35m (minY = -0.35m)
  with rounded bevel edge, subdivided organic coastline, and warm earth/stone cliff cross-section.
- Inland pond holes lowered to water level y = -0.08m with beveled banks.
- Paths colored via vertex colors (COLOR_0, FLOAT_COLOR) with width = path.width and soft feathered edges.
- sRGB palette hex values are converted to Linear-sRGB once, and AO is multiplied once in linear space.
- Verifies exported GLB vertex colors (grass #5CC96B family, path #F2B35E family within ±6/255).
- No external ocean plane (rendered by engine).
"""

import bpy
import bmesh
import math
import os
import sys
import json
import struct
from mathutils import Vector, Euler
from mathutils.geometry import delaunay_2d_cdt

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
VILLAGE_JSON_PATH = os.path.join(ROOT_DIR, "content", "world", "village.json")
SOURCE_ENV_DIR = os.path.join(ROOT_DIR, "assets", "source", "environment")
PREVIEWS_ENV_DIR = os.path.join(ROOT_DIR, "assets", "source", "previews", "environment")
PUBLIC_ENV_DIR = os.path.join(ROOT_DIR, "client", "public", "assets", "abraxas", "environment")
BAKES_DIR = os.path.join(SOURCE_ENV_DIR, "bakes")

MAX_TRIANGLES = 30000
MAX_BYTES = 1024 * 1024  # 1 MiB

# -----------------------------------------------------------------------------
# Palette & Color Utilities (sRGB -> Linear sRGB once, matching build_environment.py)
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
    "path_center": "#F3D5B5",
    "path_edge": "#D9B087",
    "sea": "#94D2CB",
    "sea_shallow": "#B0E2DC",
    "sea_deep": "#78BEB6",
    "coral": "#EBA698",
    "gold": "#FFE08A",
    "teal": "#78CCC0",
}

HEX_TO_PALETTE_NAME = {v: k for k, v in PALETTE.items()}

TERRAIN_VERIFY_HEX_LIST = [
    PALETTE["grass"],
    PALETTE["grass_dark"],
    PALETTE["grass_light"],
    PALETTE["path"],
    PALETTE["path_center"],
    PALETTE["path_edge"],
]


def srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c: float) -> float:
    c = max(0.0, min(1.0, c))
    if c <= 0.0031308:
        return c * 12.92
    return 1.055 * (c ** (1.0 / 2.4)) - 0.055


def hex_to_srgb_255(hex_str: str):
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def hex_to_linear_rgb(hex_str: str, tint: float = 1.0):
    h = hex_str.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    return (
        max(0.0, min(1.0, srgb_to_linear(r) * tint)),
        max(0.0, min(1.0, srgb_to_linear(g) * tint)),
        max(0.0, min(1.0, srgb_to_linear(b) * tint)),
    )


def hex_to_linear_rgba(hex_str: str, tint: float = 1.0):
    r, g, b = hex_to_linear_rgb(hex_str, tint)
    return (r, g, b, 1.0)


def lerp_rgb(c1, c2, t: float):
    t = max(0.0, min(1.0, t))
    return (
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t,
    )


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if abs(edge1 - edge0) < 1e-8:
        return 1.0 if x >= edge1 else 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


# -----------------------------------------------------------------------------
# Material Creation (Opaque PBR reading COLOR_0, matching build_environment.py)
# -----------------------------------------------------------------------------
def get_or_create_diorama_material(name="AbraxasEnvMat", roughness=0.88):
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
        bsdf.inputs["Specular IOR Level"].default_value = 0.22

    vcol = nt.nodes.new("ShaderNodeVertexColor")
    vcol.location = (-250, 0)
    vcol.layer_name = "COLOR_0"

    nt.links.new(vcol.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])
    return mat


# -----------------------------------------------------------------------------
# 2D Polygon, Smoothing & Distance Field Helpers in World (x, z) Coordinates
# -----------------------------------------------------------------------------
def signed_area_xz(poly):
    area = 0.0
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % n]
        area += x0 * z1 - x1 * z0
    return 0.5 * area


def ensure_positive_area_xz(poly):
    if signed_area_xz(poly) < 0.0:
        return list(reversed(poly))
    return list(poly)


def smooth_hex_boundary_xz(poly, passes=2, weight=0.20, preserve_bbox=True):
    """
    Smooths polygon vertices into a continuous organic coastline curve
    while optionally preserving the exact bounding box of the original polygon.
    """
    orig_xs = [p[0] for p in poly]
    orig_zs = [p[1] for p in poly]
    min_x0, max_x0 = min(orig_xs), max(orig_xs)
    min_z0, max_z0 = min(orig_zs), max(orig_zs)
    cx = 0.5 * (min_x0 + max_x0)
    cz = 0.5 * (min_z0 + max_z0)

    pts = list(poly)
    n = len(pts)
    for _ in range(passes):
        nxt = []
        for i in range(n):
            px, pz = pts[(i - 1) % n]
            x, z = pts[i]
            qx, qz = pts[(i + 1) % n]
            sx = (1.0 - 2.0 * weight) * x + weight * (px + qx)
            sz = (1.0 - 2.0 * weight) * z + weight * (pz + qz)
            nxt.append((sx, sz))
        pts = nxt

    if preserve_bbox:
        cur_xs = [p[0] for p in pts]
        cur_zs = [p[1] for p in pts]
        span_x0 = max(1e-6, max_x0 - min_x0)
        span_z0 = max(1e-6, max_z0 - min_z0)
        span_x1 = max(1e-6, max(cur_xs) - min(cur_xs))
        span_z1 = max(1e-6, max(cur_zs) - min(cur_zs))
        cx1 = 0.5 * (min(cur_xs) + max(cur_xs))
        cz1 = 0.5 * (min(cur_zs) + max(cur_zs))
        sx = span_x0 / span_x1
        sz = span_z0 / span_z1
        pts = [((x - cx1) * sx + cx, (z - cz1) * sz + cz) for (x, z) in pts]

    return pts


def subdivide_polygon_xz(poly, subdivisions=3):
    out = []
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % n]
        for s in range(subdivisions):
            t = s / float(subdivisions)
            out.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
    return out


def compute_inward_miter_normals_xz(poly, smooth_passes=3):
    """
    For a polygon with signed_area_xz(poly) > 0, the inward normal of edge
    (dx, dz) is (-dz, dx) / length.
    Returns smoothed inward miter normals [(nx, nz), ...] at each vertex.
    """
    n = len(poly)
    edge_normals = []
    for i in range(n):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % n]
        dx = x1 - x0
        dz = z1 - z0
        length = max(1e-8, math.hypot(dx, dz))
        edge_normals.append((-dz / length, dx / length))

    miters = []
    for i in range(n):
        nx_prev, nz_prev = edge_normals[(i - 1) % n]
        nx_curr, nz_curr = edge_normals[i]
        mx = nx_prev + nx_curr
        mz = nz_prev + nz_curr
        mlen = math.hypot(mx, mz)
        if mlen < 1e-6:
            mx, mz = nx_curr, nz_curr
        else:
            mx /= mlen
            mz /= mlen
        dot = max(0.60, mx * nx_curr + mz * nz_curr)
        scale = min(1.28, 1.0 / dot)
        miters.append((mx * scale, mz * scale))

    for _ in range(smooth_passes):
        smoothed = []
        for i in range(n):
            px, pz = miters[(i - 1) % n]
            cx, cz = miters[i]
            nx, nz = miters[(i + 1) % n]
            sx = 0.25 * px + 0.50 * cx + 0.25 * nx
            sz = 0.25 * pz + 0.50 * cz + 0.25 * nz
            smoothed.append((sx, sz))
        miters = smoothed

    return miters


def offset_and_smooth_ring_xz(poly, miters, offset_dist: float, corner_relax: float = 0.0):
    n = len(poly)
    ring = [
        (poly[i][0] + miters[i][0] * offset_dist, poly[i][1] + miters[i][1] * offset_dist)
        for i in range(n)
    ]
    if corner_relax > 0.0:
        relaxed = []
        for i in range(n):
            px, pz = ring[(i - 1) % n]
            cx, cz = ring[i]
            nx, nz = ring[(i + 1) % n]
            rx = (1.0 - 2.0 * corner_relax) * cx + corner_relax * (px + nx)
            rz = (1.0 - 2.0 * corner_relax) * cz + corner_relax * (pz + nz)
            relaxed.append((rx, rz))
        ring = relaxed
    return ring


def point_in_poly_xz(pt, poly) -> bool:
    x, z = pt
    inside = False
    n = len(poly)
    for i in range(n):
        x0, z0 = poly[i]
        x1, z1 = poly[(i + 1) % n]
        if (z0 > z) != (z1 > z):
            x_intersect = (x1 - x0) * (z - z0) / (z1 - z0 + 1e-15) + x0
            if x < x_intersect:
                inside = not inside
    return inside


def dist_point_to_segment_xz(px: float, pz: float, ax: float, az: float, bx: float, bz: float) -> float:
    vx = bx - ax
    vz = bz - az
    len_sq = vx * vx + vz * vz
    if len_sq < 1e-12:
        return math.hypot(px - ax, pz - az)
    t = max(0.0, min(1.0, ((px - ax) * vx + (pz - az) * vz) / len_sq))
    proj_x = ax + t * vx
    proj_z = az + t * vz
    return math.hypot(px - proj_x, pz - proj_z)


def dist_point_to_triangle_xz(px: float, pz: float, a, b, c) -> float:
    ax, az = a
    bx, bz = b
    cx, cz = c
    d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz)
    d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz)
    d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az)
    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    if not (has_neg and has_pos):
        return 0.0
    return min(
        dist_point_to_segment_xz(px, pz, ax, az, bx, bz),
        dist_point_to_segment_xz(px, pz, bx, bz, cx, cz),
        dist_point_to_segment_xz(px, pz, cx, cz, ax, az),
    )


def dist_point_to_poly_edges_xz(px: float, pz: float, poly) -> float:
    best = 1e9
    n = len(poly)
    for i in range(n):
        ax, az = poly[i]
        bx, bz = poly[(i + 1) % n]
        d = dist_point_to_segment_xz(px, pz, ax, az, bx, bz)
        if d < best:
            best = d
    return best


def build_path_primitives(raw_paths):
    """
    Processes village.json paths to:
    1) Detect 3-cycles of mutually connected road hexes (junction triangles) so
       their interiors are filled cleanly without tiny green holes.
    Returns (raw_segments, junction_triangles) where:
    - raw_segments: [(ax, az, bx, bz, half_width), ...]
    - junction_triangles: [((ax, az), (bx, bz), (cx, cz), half_width), ...]
    """
    node_coords = {}
    adj = {}
    edge_width = {}

    def node_key(x: float, z: float):
        k = (round(x, 3), round(z, 3))
        if k not in node_coords:
            node_coords[k] = (x, z)
        return k

    raw_segments = []
    for item in raw_paths:
        w = float(item.get("width", 0.9))
        hw = w * 0.5
        pts = item.get("points", [])
        for i in range(len(pts) - 1):
            ax, az = float(pts[i]["x"]), float(pts[i]["z"])
            bx, bz = float(pts[i + 1]["x"]), float(pts[i + 1]["z"])
            ka = node_key(ax, az)
            kb = node_key(bx, bz)
            if ka == kb:
                continue
            adj.setdefault(ka, set()).add(kb)
            adj.setdefault(kb, set()).add(ka)
            ek = (min(ka, kb), max(ka, kb))
            edge_width[ek] = max(edge_width.get(ek, 0.0), hw)
            raw_segments.append((ax, az, bx, bz, hw))

    # Find 3-cycles (junction triangles)
    junction_triangles = []
    nodes_sorted = sorted(adj.keys())
    for u in nodes_sorted:
        for v in sorted(adj[u]):
            if v <= u:
                continue
            for w in sorted(adj[v]):
                if w <= v or w not in adj[u]:
                    continue
                hw = edge_width.get((u, v), 0.45)
                junction_triangles.append((node_coords[u], node_coords[v], node_coords[w], hw))
    return raw_segments, junction_triangles


def world_to_blender(x: float, y: float, z: float) -> Vector:
    """
    Maps Three.js world (x, y, z) to Blender (X_b, Y_b, Z_b) so that
    Blender's glTF exporter with export_yup=True outputs (X=x, Y=y, Z=z).
    """
    return Vector((x, -z, y))


# -----------------------------------------------------------------------------
# Color & Self-AO Evaluators (Linear-sRGB once, Linear AO once)
# -----------------------------------------------------------------------------
class TerrainColorEvaluator:
    def __init__(self, outer_poly, holes_polys, path_segments, junction_triangles):
        self.outer_poly = outer_poly
        self.holes_polys = holes_polys
        self.path_segments = path_segments
        self.junction_triangles = junction_triangles

        # Single sRGB -> Linear-sRGB conversion for each palette color
        self.c_grass = hex_to_linear_rgb(PALETTE["grass"])
        self.c_grass_dark = hex_to_linear_rgb(PALETTE["grass_dark"])
        self.c_grass_light = hex_to_linear_rgb(PALETTE["grass_light"])
        self.c_path = hex_to_linear_rgb(PALETTE["path"])
        self.c_path_center = hex_to_linear_rgb(PALETTE["path_center"])
        self.c_path_edge = hex_to_linear_rgb(PALETTE["path_edge"])
        self.c_wood = hex_to_linear_rgb(PALETTE["wood"])
        self.c_wood_light = hex_to_linear_rgb(PALETTE["wood_light"])
        self.c_wood_dark = hex_to_linear_rgb(PALETTE["wood_dark"])
        self.c_stone = hex_to_linear_rgb(PALETTE["stone"])
        self.c_stone_light = hex_to_linear_rgb(PALETTE["stone_light"])
        self.c_stone_dark = hex_to_linear_rgb(PALETTE["stone_dark"])
        self.c_sea = hex_to_linear_rgb(PALETTE["sea"])
        self.c_sea_shallow = hex_to_linear_rgb(PALETTE["sea_shallow"])
        self.c_sea_deep = hex_to_linear_rgb(PALETTE["sea_deep"])

        # Precompute 5 golden-angle wave directions for isotropic meadow patches
        self.wave_dirs = [
            (math.cos(i * 2.39996), math.sin(i * 2.39996), 0.21 + 0.04 * (i % 3), i * 1.7)
            for i in range(5)
        ]

    def grass_rgb_at(self, x: float, z: float):
        """
        Isotropic sum of 5 rotated waves -> organic round meadow patches:
        - Near meadow == 0: exact PALETTE["grass"] (#5CC96B)
        - At sunny wave peaks: reaches PALETTE["grass_light"] (#7EE089)
        - At shaded wave troughs: reaches PALETTE["grass_dark"] (#3A9E57)
        """
        acc = 0.0
        for dx, dz, freq, phase in self.wave_dirs:
            acc += math.sin((x * dx + z * dz) * freq + phase)
        meadow = acc / 5.0

        if meadow >= 0.0:
            t_light = smoothstep(0.04, 0.58, meadow)
            return lerp_rgb(self.c_grass, self.c_grass_light, t_light)
        else:
            t_dark = smoothstep(0.04, 0.58, -meadow)
            return lerp_rgb(self.c_grass, self.c_grass_dark, t_dark)

    def path_blend_and_rgb_at(self, x: float, z: float):
        if not self.path_segments and not self.junction_triangles:
            return 0.0, self.c_path

        min_norm_d = 1e9
        for ax, az, bx, bz, hw in self.path_segments:
            d = dist_point_to_segment_xz(x, z, ax, az, bx, bz) / max(0.1, hw)
            if d < min_norm_d:
                min_norm_d = d

        for tri_a, tri_b, tri_c, hw in self.junction_triangles:
            d = dist_point_to_triangle_xz(x, z, tri_a, tri_b, tri_c) / max(0.1, hw)
            if d < min_norm_d:
                min_norm_d = d

        # Feathered edge around d = 1.0 * half_width (width = path.width = 0.9m)
        path_weight = 1.0 - smoothstep(0.90, 1.10, min_norm_d)
        if path_weight <= 1e-4:
            return 0.0, self.c_path

        # Along path centerline (min_norm_d ~ 0.0), alternate smoothly between
        # pure PALETTE["path"] (#F2B35E) and PALETTE["path_center"] (#F5C276);
        # at shoulder (min_norm_d ~ 0.55), transition between #F2B35E and PALETTE["path_edge"] (#D99B4E).
        center_wave = 0.5 + 0.5 * math.sin(x * 0.45 + z * 0.38)
        edge_wave = 0.5 + 0.5 * math.cos(x * 0.42 - z * 0.47)

        center_t = (1.0 - smoothstep(0.0, 0.42, min_norm_d)) * smoothstep(0.25, 0.78, center_wave)
        edge_t = smoothstep(0.32, 0.54, min_norm_d) * smoothstep(0.25, 0.78, edge_wave)

        p_col = lerp_rgb(self.c_path, self.c_path_center, center_t)
        p_col = lerp_rgb(p_col, self.c_path_edge, edge_t)
        return path_weight, p_col

    def _distances_to_boundaries(self, x: float, z: float):
        d_outer = dist_point_to_poly_edges_xz(x, z, self.outer_poly)
        d_hole = min(
            (dist_point_to_poly_edges_xz(x, z, h) for h in self.holes_polys),
            default=1e9,
        )
        return d_outer, d_hole

    def top_surface_base_rgb(self, x: float, z: float, d_outer=None, d_hole=None):
        """
        Computes unshaded linear RGB on the top surface (without AO).
        """
        if d_outer is None or d_hole is None:
            d_outer, d_hole = self._distances_to_boundaries(x, z)

        grass_col = self.grass_rgb_at(x, z)
        path_w, path_col = self.path_blend_and_rgb_at(x, z)
        base_col = lerp_rgb(grass_col, path_col, path_w)

        if d_outer < 1.0 and path_w < 0.8:
            edge_t = (1.0 - smoothstep(0.05, 1.0, d_outer)) * (1.0 - path_w)
            base_col = lerp_rgb(base_col, self.c_grass_dark, edge_t * 0.30)

        if d_hole < 0.85 and path_w < 0.8:
            bank_t = (1.0 - smoothstep(0.05, 0.85, d_hole)) * (1.0 - path_w)
            base_col = lerp_rgb(base_col, self.c_grass_dark, bank_t * 0.35)

        return base_col

    def top_surface_ao(self, d_outer: float, d_hole: float) -> float:
        ao_outer = 0.93 + 0.07 * smoothstep(0.0, 0.9, d_outer)
        ao_hole = 0.91 + 0.09 * smoothstep(0.0, 0.7, d_hole)
        return max(0.85, min(1.0, ao_outer * ao_hole))

    def top_surface_rgba(self, x: float, z: float):
        d_outer, d_hole = self._distances_to_boundaries(x, z)
        base_col = self.top_surface_base_rgb(x, z, d_outer, d_hole)
        ao = self.top_surface_ao(d_outer, d_hole)
        return (base_col[0] * ao, base_col[1] * ao, base_col[2] * ao, 1.0)

    def outer_rim_rgba(self, x: float, z: float, ring_idx: int, nx: float, nz: float):
        """
        6-ring cushion/diorama cliff cross-section (single linear AO multiplication):
        0: inner grass lip (y = 0.00)
        1: rounded grass bevel upper (y = -0.025)
        2: rounded grass bevel lower / turf lip (y = -0.070)
        3: upper warm dirt cliff (y = -0.145)
        4: mid warm dirt/stone cliff (y = -0.255)
        5: bottom beveled base (y = -0.350)
        """
        if ring_idx == 0:
            return self.top_surface_rgba(x, z)

        sun_boost = 1.0 + 0.04 * (nx * 0.6 + nz * 0.8)
        strata = 0.5 + 0.5 * math.sin(x * 0.45 - z * 0.38)

        if ring_idx == 1:
            top_base = self.top_surface_base_rgb(x, z)
            col = lerp_rgb(top_base, self.c_grass_dark, 0.32)
            ao = 0.94 * sun_boost
        elif ring_idx == 2:
            col = lerp_rgb(self.c_grass_dark, self.c_wood_light, 0.38)
            ao = 0.91 * sun_boost
        elif ring_idx == 3:
            col = lerp_rgb(self.c_wood_light, self.c_wood, 0.40 + 0.25 * strata)
            ao = 0.88 * sun_boost
        elif ring_idx == 4:
            col = lerp_rgb(self.c_wood, self.c_stone_dark, 0.32 + 0.22 * strata)
            ao = 0.83 * sun_boost
        else:
            col = lerp_rgb(self.c_wood_dark, self.c_stone_dark, 0.45)
            ao = 0.78 * sun_boost

        ao = max(0.78, min(1.0, ao))
        return (
            col[0] * ao,
            col[1] * ao,
            col[2] * ao,
            1.0,
        )

    def pond_bank_rgba(self, x: float, z: float, ring_idx: int):
        if ring_idx == 0:
            return self.top_surface_rgba(x, z)
        elif ring_idx == 1:
            top_base = self.top_surface_base_rgb(x, z)
            col = lerp_rgb(top_base, self.c_grass_dark, 0.42)
            ao = 0.92
        elif ring_idx == 2:
            col = lerp_rgb(self.c_wood_light, self.c_stone_light, 0.52)
            ao = 0.88
        else:
            col = lerp_rgb(self.c_sea_shallow, self.c_sea, 0.30)
            ao = 0.92
        return (col[0] * ao, col[1] * ao, col[2] * ao, 1.0)

    def pond_water_rgba(self, x: float, z: float, hole_poly):
        d_bank = dist_point_to_poly_edges_xz(x, z, hole_poly)
        t_depth = smoothstep(0.05, 1.35, d_bank)
        col = lerp_rgb(self.c_sea_shallow, self.c_sea, min(1.0, t_depth * 1.25))
        if t_depth > 0.55:
            col = lerp_rgb(col, self.c_sea_deep, (t_depth - 0.55) * 0.50)
        ao = 0.92 + 0.08 * smoothstep(0.0, 0.6, d_bank)
        ao = max(0.78, min(1.0, ao))
        return (
            col[0] * ao,
            col[1] * ao,
            col[2] * ao,
            1.0,
        )


# -----------------------------------------------------------------------------
# Spatial Hash for Adaptive Interior Point Seeding
# -----------------------------------------------------------------------------
class SpatialHash2D:
    def __init__(self, cell_size=0.25):
        self.cell_size = cell_size
        self.cells = {}

    def _key(self, x: float, z: float):
        return (int(math.floor(x / self.cell_size)), int(math.floor(z / self.cell_size)))

    def can_insert(self, x: float, z: float, min_dist: float) -> bool:
        cx, cz = self._key(x, z)
        r = int(math.ceil(min_dist / self.cell_size))
        min_sq = min_dist * min_dist
        for dx in range(-r, r + 1):
            for dz in range(-r, r + 1):
                for px, pz in self.cells.get((cx + dx, cz + dz), ()):
                    if (px - x) ** 2 + (pz - z) ** 2 < min_sq:
                        return False
        return True

    def insert(self, x: float, z: float):
        k = self._key(x, z)
        self.cells.setdefault(k, []).append((x, z))


# -----------------------------------------------------------------------------
# Continuous Terrain Mesh Construction
# -----------------------------------------------------------------------------
def build_terrain_object():
    with open(VILLAGE_JSON_PATH, "r", encoding="utf-8") as f:
        village = json.load(f)

    assert village.get("version") == 2 and "bounds" in village, "village.json must be v2 with bounds"
    bounds_data = village["bounds"]
    coast_tag = village.get("coast", "organic-v1")

    outer_raw = [(float(p["x"]), float(p["z"])) for p in bounds_data["outer"]]
    outer_raw = ensure_positive_area_xz(outer_raw)
    # Gently smooth the 160-vertex organic coastline while preserving exact bounding box
    outer_smoothed = smooth_hex_boundary_xz(outer_raw, passes=1, weight=0.18, preserve_bbox=True)

    holes_raw = []
    for h in bounds_data.get("holes", []):
        h_pts = [(float(p["x"]), float(p["z"])) for p in h]
        h_pts = ensure_positive_area_xz(h_pts)
        holes_raw.append(smooth_hex_boundary_xz(h_pts, passes=1, weight=0.16, preserve_bbox=True))

    path_segments, junction_triangles = build_path_primitives(village.get("paths", []))

    # Subdivide outer coastline (160 -> 480 vertices, ~0.24m segment length) and smooth 2 passes
    # so the organic shoreline curves cleanly without faceted kinks
    outer_sub = smooth_hex_boundary_xz(
        subdivide_polygon_xz(outer_smoothed, subdivisions=3),
        passes=2,
        weight=0.20,
        preserve_bbox=True,
    )
    outer_miters = compute_inward_miter_normals_xz(outer_sub, smooth_passes=3)

    # 6-ring cushion/diorama profile for outer island bevel & 0.35m dirt cliff cross-section:
    outer_profile = [
        (0.160, 0.000, 0.16),   # Ring 0: inner grass top at y = 0.00
        (0.090, -0.025, 0.12),  # Ring 1: rounded bevel upper shoulder
        (0.035, -0.070, 0.08),  # Ring 2: rounded bevel lower grass lip
        (0.010, -0.145, 0.04),  # Ring 3: upper warm dirt cross-section
        (0.000, -0.255, 0.00),  # Ring 4: mid dirt/stone cliff at exact bounds.outer
        (0.032, -0.350, 0.08),  # Ring 5: bottom beveled base at y = -0.35
    ]
    outer_rings_xz = [
        offset_and_smooth_ring_xz(outer_sub, outer_miters, off, relax)
        for off, _y, relax in outer_profile
    ]

    # 4-ring profile for each pond hole lowered to water height y = -0.08m:
    pond_profile = [
        (-0.120, 0.000, 0.14),  # Pond Ring 0: land grass lip at y = 0.00
        (-0.055, -0.018, 0.10), # Pond Ring 1: bank top bevel
        (0.010, -0.052, 0.08),  # Pond Ring 2: warm shore earth/stone slope
        (0.075, -0.080, 0.10),  # Pond Ring 3: waterline edge at y = -0.08
    ]
    holes_sub_list = []
    holes_rings_xz = []
    for h_smoothed in holes_raw:
        # Subdivide 88-vertex rounded pond into 176 vertices (~0.125m segment length)
        h_sub = smooth_hex_boundary_xz(
            subdivide_polygon_xz(h_smoothed, subdivisions=2),
            passes=1,
            weight=0.16,
            preserve_bbox=True,
        )
        h_miters = compute_inward_miter_normals_xz(h_sub, smooth_passes=3)
        h_rings = [
            offset_and_smooth_ring_xz(h_sub, h_miters, off, relax)
            for off, _y, relax in pond_profile
        ]
        holes_sub_list.append(h_sub)
        holes_rings_xz.append(h_rings)

    color_eval = TerrainColorEvaluator(outer_sub, holes_sub_list, path_segments, junction_triangles)
    for ax, az, bx, bz, _hw in path_segments:
        assert color_eval.path_blend_and_rgb_at((ax + bx) / 2, (az + bz) / 2)[0] > 0.99
    test_eval = TerrainColorEvaluator([], [], [(0, 0, 2, 0, 0.45)], [])
    assert test_eval.path_blend_and_rgb_at(1, 0.405)[0] > 0.99
    assert test_eval.path_blend_and_rgb_at(1, 0.495)[0] < 0.01

    # -------------------------------------------------------------------------
    # Constrained Delaunay Triangulation for Top Surface (y = 0.0)
    # -------------------------------------------------------------------------
    top_outer_ring = outer_rings_xz[0]
    top_hole_rings = [hr[0] for hr in holes_rings_xz]

    cdt_verts = []
    cdt_edges = []
    shash = SpatialHash2D(cell_size=0.25)

    # 1) Add outer_ring0 constraint loop
    n_out = len(top_outer_ring)
    for i, (x, z) in enumerate(top_outer_ring):
        cdt_verts.append((x, z))
        shash.insert(x, z)
        cdt_edges.append((i, (i + 1) % n_out))

    # 2) Add each hole_ring0 constraint loop
    for h_ring in top_hole_rings:
        base = len(cdt_verts)
        nh = len(h_ring)
        for i, (x, z) in enumerate(h_ring):
            cdt_verts.append((x, z))
            shash.insert(x, z)
            cdt_edges.append((base + i, base + (i + 1) % nh))

    def valid_top_interior_pt(px: float, pz: float, min_boundary_clearance: float) -> bool:
        if not point_in_poly_xz((px, pz), top_outer_ring):
            return False
        if dist_point_to_poly_edges_xz(px, pz, top_outer_ring) < min_boundary_clearance:
            return False
        for h_ring in top_hole_rings:
            if point_in_poly_xz((px, pz), h_ring):
                return False
            if dist_point_to_poly_edges_xz(px, pz, h_ring) < min_boundary_clearance:
                return False
        return True

    # 3) Seed path-aligned vertices so vertex-colored paths (width 0.9m) have smooth edges
    for ax, az, bx, bz, hw in path_segments:
        seg_len = math.hypot(bx - ax, bz - az)
        if seg_len < 1e-5:
            continue
        tx, tz = (bx - ax) / seg_len, (bz - az) / seg_len
        nx, nz = -tz, tx
        steps = max(2, int(math.ceil(seg_len / 0.28)))
        for s_idx in range(steps + 1):
            t = s_idx / float(steps)
            cx = ax + tx * seg_len * t
            cz = az + tz * seg_len * t
            for lat in (0.0, -0.90 * hw, 0.90 * hw, -1.10 * hw, 1.10 * hw):
                px = cx + nx * lat
                pz = cz + nz * lat
                if valid_top_interior_pt(px, pz, 0.20) and shash.can_insert(px, pz, 0.04):
                    cdt_verts.append((px, pz))
                    shash.insert(px, pz)

    # Seed vertices inside 3-way junction triangles
    for tri_a, tri_b, tri_c, _hw in junction_triangles:
        for w0, w1, w2 in ((1 / 3, 1 / 3, 1 / 3), (0.5, 0.25, 0.25), (0.25, 0.5, 0.25), (0.25, 0.25, 0.5)):
            px = w0 * tri_a[0] + w1 * tri_b[0] + w2 * tri_c[0]
            pz = w0 * tri_a[1] + w1 * tri_b[1] + w2 * tri_c[1]
            if valid_top_interior_pt(px, pz, 0.20) and shash.can_insert(px, pz, 0.20):
                cdt_verts.append((px, pz))
                shash.insert(px, pz)

    # 4) Seed equilateral triangular grid across remaining grass interior
    xs_all = [p[0] for p in top_outer_ring]
    zs_all = [p[1] for p in top_outer_ring]
    min_x, max_x = min(xs_all), max(xs_all)
    min_z, max_z = min(zs_all), max(zs_all)

    grid_dx = 0.50
    grid_dz = grid_dx * math.sqrt(3.0) * 0.5
    row = 0
    z_cur = min_z + grid_dz
    while z_cur < max_z:
        x_cur = min_x + (grid_dx * 0.5 if (row % 2 == 1) else 0.0)
        while x_cur < max_x:
            if valid_top_interior_pt(x_cur, z_cur, 0.24) and shash.can_insert(x_cur, z_cur, 0.25):
                cdt_verts.append((x_cur, z_cur))
                shash.insert(x_cur, z_cur)
            x_cur += grid_dx
        z_cur += grid_dz
        row += 1

    v_cdt, _e_cdt, f_cdt, _, _, _ = delaunay_2d_cdt(
        [Vector((x, z)) for (x, z) in cdt_verts],
        cdt_edges,
        [],
        0,
        1e-5,
    )

    # -------------------------------------------------------------------------
    # Assemble BMesh with Exact Vertex Welding and Guaranteed Outward/Up Normals
    # -------------------------------------------------------------------------
    bm = bmesh.new()
    vert_cache = {}

    def get_bm_vert(x: float, y: float, z: float):
        key = (round(x, 4), round(y, 4), round(z, 4))
        v = vert_cache.get(key)
        if v is None:
            v = bm.verts.new(world_to_blender(x, y, z))
            vert_cache[key] = v
        return v

    face_records = []

    def add_oriented_triangle(p0, p1, p2, c0, c1, c2, expected_normal_b: Vector, is_smooth: bool):
        v0 = get_bm_vert(*p0)
        v1 = get_bm_vert(*p1)
        v2 = get_bm_vert(*p2)
        if v0 == v1 or v1 == v2 or v2 == v0:
            return
        n = (v1.co - v0.co).cross(v2.co - v0.co)
        if n.length_squared < 1e-12:
            return
        if n.dot(expected_normal_b) < 0.0:
            v1, v2 = v2, v1
            c1, c2 = c2, c1
        try:
            f = bm.faces.new((v0, v1, v2))
            f.smooth = is_smooth
            face_records.append((f, (c0, c1, c2)))
        except ValueError:
            pass

    up_normal_b = Vector((0.0, 0.0, 1.0))

    # 1) Add Top Surface triangles (y = 0.0)
    top_color_cache = {}

    def get_top_color(x: float, z: float):
        k = (round(x, 4), round(z, 4))
        c = top_color_cache.get(k)
        if c is None:
            c = color_eval.top_surface_rgba(x, z)
            top_color_cache[k] = c
        return c

    for f_indices in f_cdt:
        if len(f_indices) < 3:
            continue
        cx = sum(v_cdt[idx].x for idx in f_indices) / float(len(f_indices))
        cz = sum(v_cdt[idx].y for idx in f_indices) / float(len(f_indices))
        if not point_in_poly_xz((cx, cz), top_outer_ring):
            continue
        if any(point_in_poly_xz((cx, cz), h_ring) for h_ring in top_hole_rings):
            continue

        for k in range(1, len(f_indices) - 1):
            i0, i1, i2 = f_indices[0], f_indices[k], f_indices[k + 1]
            x0, z0 = v_cdt[i0].x, v_cdt[i0].y
            x1, z1 = v_cdt[i1].x, v_cdt[i1].y
            x2, z2 = v_cdt[i2].x, v_cdt[i2].y
            add_oriented_triangle(
                (x0, 0.0, z0),
                (x1, 0.0, z1),
                (x2, 0.0, z2),
                get_top_color(x0, z0),
                get_top_color(x1, z1),
                get_top_color(x2, z2),
                up_normal_b,
                is_smooth=True,
            )

    # 2) Add Outer Bevel & Dirt Cliff Cross-Section Strips (Rings 0..5)
    n_outer = len(outer_sub)
    outer_ring_colors = []
    for r_idx in range(len(outer_profile)):
        ring_xz = outer_rings_xz[r_idx]
        cols = []
        for i in range(n_outer):
            x, z = ring_xz[i]
            nx_out = -outer_miters[i][0]
            nz_out = -outer_miters[i][1]
            cols.append(color_eval.outer_rim_rgba(x, z, r_idx, nx_out, nz_out))
        outer_ring_colors.append(cols)

    for r_idx in range(len(outer_profile) - 1):
        y_upper = outer_profile[r_idx][1]
        y_lower = outer_profile[r_idx + 1][1]
        ring_upper = outer_rings_xz[r_idx]
        ring_lower = outer_rings_xz[r_idx + 1]
        cols_upper = outer_ring_colors[r_idx]
        cols_lower = outer_ring_colors[r_idx + 1]
        strip_smooth = r_idx < 2

        for i in range(n_outer):
            inext = (i + 1) % n_outer
            u0 = (ring_upper[i][0], y_upper, ring_upper[i][1])
            u1 = (ring_upper[inext][0], y_upper, ring_upper[inext][1])
            l0 = (ring_lower[i][0], y_lower, ring_lower[i][1])
            l1 = (ring_lower[inext][0], y_lower, ring_lower[inext][1])

            out_x = -(outer_miters[i][0] + outer_miters[inext][0]) * 0.5
            out_z = -(outer_miters[i][1] + outer_miters[inext][1]) * 0.5
            expected_n = Vector((out_x, -out_z, 0.35 if r_idx < 4 else -0.15))

            add_oriented_triangle(
                u0, u1, l1,
                cols_upper[i], cols_upper[inext], cols_lower[inext],
                expected_n,
                is_smooth=strip_smooth,
            )
            add_oriented_triangle(
                u0, l1, l0,
                cols_upper[i], cols_lower[inext], cols_lower[i],
                expected_n,
                is_smooth=strip_smooth,
            )

    # 3) Add Pond Bank Strips (Pond Rings 0..3) and Water Surface (y = -0.08m) for each hole
    for h_idx, h_rings in enumerate(holes_rings_xz):
        h_sub = holes_sub_list[h_idx]
        n_h = len(h_sub)
        h_miters = compute_inward_miter_normals_xz(h_sub, smooth_passes=3)

        pond_ring_colors = []
        for r_idx in range(len(pond_profile)):
            ring_xz = h_rings[r_idx]
            cols = [color_eval.pond_bank_rgba(x, z, r_idx) for (x, z) in ring_xz]
            pond_ring_colors.append(cols)

        for r_idx in range(len(pond_profile) - 1):
            y_upper = pond_profile[r_idx][1]
            y_lower = pond_profile[r_idx + 1][1]
            ring_upper = h_rings[r_idx]
            ring_lower = h_rings[r_idx + 1]
            cols_upper = pond_ring_colors[r_idx]
            cols_lower = pond_ring_colors[r_idx + 1]

            for i in range(n_h):
                inext = (i + 1) % n_h
                u0 = (ring_upper[i][0], y_upper, ring_upper[i][1])
                u1 = (ring_upper[inext][0], y_upper, ring_upper[inext][1])
                l0 = (ring_lower[i][0], y_lower, ring_lower[i][1])
                l1 = (ring_lower[inext][0], y_lower, ring_lower[inext][1])

                in_x = (h_miters[i][0] + h_miters[inext][0]) * 0.5
                in_z = (h_miters[i][1] + h_miters[inext][1]) * 0.5
                expected_n = Vector((in_x, -in_z, 0.85))

                add_oriented_triangle(
                    u0, u1, l1,
                    cols_upper[i], cols_upper[inext], cols_lower[inext],
                    expected_n,
                    is_smooth=True,
                )
                add_oriented_triangle(
                    u0, l1, l0,
                    cols_upper[i], cols_lower[inext], cols_lower[i],
                    expected_n,
                    is_smooth=True,
                )

        # Triangulate the pond water surface at y = -0.08m inside Pond Ring 3
        water_ring = h_rings[3]
        w_verts = list(water_ring)
        w_edges = [(i, (i + 1) % len(water_ring)) for i in range(len(water_ring))]
        w_hash = SpatialHash2D(cell_size=0.25)
        for x, z in w_verts:
            w_hash.insert(x, z)

        w_xs = [p[0] for p in water_ring]
        w_zs = [p[1] for p in water_ring]
        w_min_x, w_max_x = min(w_xs), max(w_xs)
        w_min_z, w_max_z = min(w_zs), max(w_zs)

        wz = w_min_z + 0.32
        w_row = 0
        while wz < w_max_z:
            wx = w_min_x + (0.20 if (w_row % 2 == 1) else 0.0)
            while wx < w_max_x:
                if (
                    point_in_poly_xz((wx, wz), water_ring)
                    and dist_point_to_poly_edges_xz(wx, wz, water_ring) >= 0.20
                    and w_hash.can_insert(wx, wz, 0.25)
                ):
                    w_verts.append((wx, wz))
                    w_hash.insert(wx, wz)
                wx += 0.40
            wz += 0.35
            w_row += 1

        wv_cdt, _we_cdt, wf_cdt, _, _, _ = delaunay_2d_cdt(
            [Vector((x, z)) for (x, z) in w_verts],
            w_edges,
            [],
            0,
            1e-5,
        )

        water_y = -0.080
        for f_indices in wf_cdt:
            if len(f_indices) < 3:
                continue
            cx = sum(wv_cdt[idx].x for idx in f_indices) / float(len(f_indices))
            cz = sum(wv_cdt[idx].y for idx in f_indices) / float(len(f_indices))
            if not point_in_poly_xz((cx, cz), water_ring):
                continue
            for k in range(1, len(f_indices) - 1):
                i0, i1, i2 = f_indices[0], f_indices[k], f_indices[k + 1]
                x0, z0 = wv_cdt[i0].x, wv_cdt[i0].y
                x1, z1 = wv_cdt[i1].x, wv_cdt[i1].y
                x2, z2 = wv_cdt[i2].x, wv_cdt[i2].y
                c0 = pond_ring_colors[3][i0] if i0 < len(water_ring) else color_eval.pond_water_rgba(x0, z0, water_ring)
                c1 = pond_ring_colors[3][i1] if i1 < len(water_ring) else color_eval.pond_water_rgba(x1, z1, water_ring)
                c2 = pond_ring_colors[3][i2] if i2 < len(water_ring) else color_eval.pond_water_rgba(x2, z2, water_ring)
                add_oriented_triangle(
                    (x0, water_y, z0),
                    (x1, water_y, z1),
                    (x2, water_y, z2),
                    c0, c1, c2,
                    up_normal_b,
                    is_smooth=True,
                )

    bm.normal_update()

    valid_face_loop_cols = [loop_cols for f, loop_cols in face_records if f.is_valid]

    mesh = bpy.data.meshes.new("terrain")
    bm.to_mesh(mesh)
    bm.free()

    # Write linear RGBA colors directly to FLOAT_COLOR corner attribute COLOR_0
    # (prevents BYTE_COLOR double sRGB->Linear gamma conversion on glTF export)
    col_attr = mesh.color_attributes.new(name="COLOR_0", type='FLOAT_COLOR', domain='CORNER')
    mesh.color_attributes.active_color = col_attr
    mesh.color_attributes.render_color_index = 0

    for poly_idx, poly in enumerate(mesh.polygons):
        loop_cols = valid_face_loop_cols[poly_idx]
        for loop_idx, rgba in zip(poly.loop_indices, loop_cols):
            col_attr.data[loop_idx].color = rgba

    mat = get_or_create_diorama_material("AbraxasEnvMat", roughness=0.88)
    mesh.materials.append(mat)

    obj = bpy.data.objects.new("terrain", mesh)
    obj.location = Vector((0.0, 0.0, 0.0))
    obj.rotation_euler = Euler((0.0, 0.0, 0.0), 'XYZ')
    obj.scale = Vector((1.0, 1.0, 1.0))
    obj["coast"] = coast_tag
    obj["used_palette_colors"] = list(TERRAIN_VERIFY_HEX_LIST)
    bpy.context.collection.objects.link(obj)
    return obj


# -----------------------------------------------------------------------------
# GLB Export, Position Bounds & Color Verification
# -----------------------------------------------------------------------------
def export_terrain_glb(obj):
    os.makedirs(PUBLIC_ENV_DIR, exist_ok=True)
    glb_path = os.path.join(PUBLIC_ENV_DIR, "terrain.glb")

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


def inspect_glb_position_bounds(glb_path: str):
    """
    Reads the glTF 2.0 JSON chunk from the exported GLB to verify exact
    Three.js (+Y up, +X right, +Z forward) POSITION accessor min/max bounds.
    """
    with open(glb_path, "rb") as f:
        magic, _version, _length = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF", "Invalid GLB magic"
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        assert chunk_type == 0x4E4F534A, "Expected JSON chunk"
        gltf_json = json.loads(f.read(chunk_len).decode("utf-8"))

    pos_idx = gltf_json["meshes"][0]["primitives"][0]["attributes"]["POSITION"]
    acc = gltf_json["accessors"][pos_idx]
    return acc["min"], acc["max"], acc["count"]


def verify_glb_colors(glb_path: str, key: str, expected_hex_list: list):
    """
    Re-imports the exported GLB, reads COLOR_0 linear values, converts them back
    to sRGB 0..255, and verifies each expected palette color (grass #5CC96B family,
    path #F2B35E family) matches within ±6/255. Exits with code 1 on failure.
    """
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
# Quarter-View Preview Render (assets/source/previews/environment/terrain.png)
# -----------------------------------------------------------------------------
def render_terrain_quarter_view(terrain_obj):
    os.makedirs(PREVIEWS_ENV_DIR, exist_ok=True)
    os.makedirs(BAKES_DIR, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'

    world = bpy.data.worlds.get("TerrainPreviewWorld") or bpy.data.worlds.new("TerrainPreviewWorld")
    scene.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = hex_to_linear_rgba(PALETTE["cream"])
        bg.inputs[1].default_value = 1.0

    cam_data = bpy.data.cameras.new("TerrainPreviewCam")
    cam_data.type = 'ORTHO'
    cam_data.clip_start = 0.1
    cam_data.clip_end = 200.0
    cam_data.ortho_scale = 42.5
    cam_obj = bpy.data.objects.new("TerrainPreviewCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    target = Vector((0.0, 0.0, -0.10))
    cam_pos = Vector((26.0, -26.0, 23.5))
    cam_obj.location = cam_pos
    cam_obj.rotation_euler = (target - cam_pos).normalized().to_track_quat('-Z', 'Y').to_euler()

    sun_data = bpy.data.lights.new("TerrainSun", type='SUN')
    sun_data.energy = 3.2
    sun_obj = bpy.data.objects.new("TerrainSun", sun_data)
    sun_obj.rotation_euler = Euler((math.radians(48), math.radians(-20), math.radians(35)), 'XYZ')
    bpy.context.collection.objects.link(sun_obj)

    fill_data = bpy.data.lights.new("TerrainFill", type='SUN')
    fill_data.energy = 1.15
    fill_obj = bpy.data.objects.new("TerrainFill", fill_data)
    fill_obj.rotation_euler = Euler((math.radians(60), math.radians(30), math.radians(-140)), 'XYZ')
    bpy.context.collection.objects.link(fill_obj)

    out_preview = os.path.join(PREVIEWS_ENV_DIR, "terrain.png")
    scene.render.filepath = out_preview
    bpy.ops.render.render(write_still=True)

    bpy.data.objects.remove(cam_obj, do_unlink=True)
    bpy.data.objects.remove(sun_obj, do_unlink=True)
    bpy.data.objects.remove(fill_obj, do_unlink=True)
    return out_preview


# -----------------------------------------------------------------------------
# Main Pipeline
# -----------------------------------------------------------------------------
def main():
    print(f"[INFO] Running build_terrain.py on Blender {bpy.app.version_string}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0

    terrain_obj = build_terrain_object()
    glb_path = export_terrain_glb(terrain_obj)
    color_verify = verify_glb_colors(glb_path, "terrain", list(terrain_obj.get("used_palette_colors", TERRAIN_VERIFY_HEX_LIST)))
    preview_path = render_terrain_quarter_view(terrain_obj)

    tri_count = len(terrain_obj.data.polygons)
    byte_size = os.path.getsize(glb_path)
    gltf_min, gltf_max, gltf_vert_count = inspect_glb_position_bounds(glb_path)

    # gltf_min / gltf_max are in Three.js world space: [X, Y, Z]
    min_x, min_y, min_z = [round(v, 4) for v in gltf_min]
    max_x, max_y, max_z = [round(v, 4) for v in gltf_max]
    bounds = {
        "width": round(max_x - min_x, 4),
        "depth": round(max_z - min_z, 4),
        "height": round(max_y - min_y, 4),
        "minX": min_x,
        "maxX": max_x,
        "minY": min_y,
        "maxY": max_y,
        "minZ": min_z,
        "maxZ": max_z,
    }

    if tri_count > MAX_TRIANGLES:
        print(f"[BUDGET FAIL] terrain exceeded tri budget: {tri_count} > {MAX_TRIANGLES}")
        sys.exit(1)
    if byte_size > MAX_BYTES:
        print(f"[BUDGET FAIL] terrain exceeded byte budget: {byte_size} > {MAX_BYTES}")
        sys.exit(1)

    # Update assets/source/environment/asset-metadata.json
    meta_path = os.path.join(SOURCE_ENV_DIR, "asset-metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            meta_doc = json.load(f)
    else:
        meta_doc = {
            "version": 1,
            "blenderVersion": bpy.app.version_string,
            "colorSpaceNote": "색공간 수정(2026-11-01): sRGB 팔레트 값을 Linear-sRGB로 한 번만 변환해 COLOR_0(FLOAT_COLOR)에 기록하고 선형 공간에서 AO 곱을 한 번만 적용",
            "phase1Only": False,
            "buildTerrain": True,
            "summary": {},
            "assets": {},
        }

    meta_doc["version"] = 2
    meta_doc["paletteVersion"] = "dream-v2"
    meta_doc["blenderVersion"] = bpy.app.version_string
    meta_doc["colorSpaceNote"] = "몽환 팔레트 v2(2026-11-01): sRGB 팔레트 v2 값을 Linear-sRGB로 한 번만 변환해 COLOR_0(FLOAT_COLOR)에 기록하고 선형 공간에서 AO 곱을 한 번만 적용"
    meta_doc["buildTerrain"] = True
    meta_doc.setdefault("assets", {})["terrain"] = {
        "path": "assets/abraxas/environment/terrain.glb",
        "scale": 1,
        "coast": str(terrain_obj.get("coast", "organic-v1")),
        "collision": [],
        "triangles": tri_count,
        "bytes": byte_size,
        "maxTriangles": MAX_TRIANGLES,
        "maxBytes": MAX_BYTES,
        "bounds": bounds,
        "materials": len(terrain_obj.data.materials),
        "vertexColorAttribute": "COLOR_0",
        "colorAttributeType": "FLOAT_COLOR",
        "dracoCompressed": True,
        "preview": "assets/source/previews/environment/terrain.png",
        "colorVerification": color_verify,
    }

    all_assets = meta_doc["assets"]
    tot_tris = sum(int(a.get("triangles", 0)) for a in all_assets.values())
    tot_bytes = sum(int(a.get("bytes", 0)) for a in all_assets.values())
    meta_doc["summary"] = {
        "assetCount": len(all_assets),
        "totalTriangles": tot_tris,
        "totalBytes": tot_bytes,
        "totalKiB": round(tot_bytes / 1024.0, 2),
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_doc, f, indent=2, ensure_ascii=False)
        f.write("\n")

    blend_path = os.path.join(SOURCE_ENV_DIR, "terrain.blend")
    blend1_path = os.path.join(SOURCE_ENV_DIR, "terrain.blend1")
    if os.path.exists(blend_path):
        os.remove(blend_path)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    if os.path.exists(blend1_path):
        os.remove(blend1_path)

    print(
        f"[OK] terrain | coast={terrain_obj.get('coast', 'organic-v1')} | tri={tri_count}/{MAX_TRIANGLES} "
        f"| gltf_verts={gltf_vert_count} | bytes={byte_size}/{MAX_BYTES} ({round(byte_size/1024.0, 2)} KiB) "
        f"| bounds={bounds} | preview={preview_path}"
    )


if __name__ == "__main__":
    main()
