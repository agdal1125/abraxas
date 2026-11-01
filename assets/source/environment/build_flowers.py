# -*- coding: utf-8 -*-
"""
Abraxas Original Wildflower Clusters & Small Grass Builder for Blender 5.2+
Generates 5 wildflower cluster assets (without planter boxes or dirt mounds) and
1 small grass tuft asset with vertex colors (COLOR_0), subtle self-AO, and
Draco-compressed GLB exports.
"""

import bpy
import bmesh
import math
import os
import sys
import json
from mathutils import Vector, Euler

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCE_ENV_DIR = os.path.join(ROOT_DIR, "assets", "source", "environment")
PREVIEWS_ENV_DIR = os.path.join(ROOT_DIR, "assets", "source", "previews", "environment")
PUBLIC_ENV_DIR = os.path.join(ROOT_DIR, "client", "public", "assets", "abraxas", "environment")

PALETTE = {
    "cream": "#FFF8EC",
    "cream_warm": "#F5E9D4",
    "ink": "#3B2A22",
    "wood": "#9B7355",
    "stone": "#B1ADA2",
    "grass": "#5CC96B",
    "grass_dark": "#3A9E57",
    "grass_light": "#7EE089",
    "path": "#F2B35E",
    "coral": "#FF7A59",
    "gold": "#FFB020",
    "gold_Center": "#FFAA1D",
    "amber_center": "#E07A38",
    "flower_red": "#FF5A5F",
    "flower_yellow": "#FFD23F",
    "flower_white": "#FFF8EC",
    "flower_pink": "#FF7EB6",
    "flower_purple": "#9B7BFF",
}

FLOWER_SPECS = {
    "flower-cluster-red": {
        "dims": (0.28, 0.28, 0.16),
        "max_tri": 300,
        "max_bytes": 20000,
        "petal_color": PALETTE["flower_red"],
        "center_color": PALETTE["flower_yellow"],
        "seed": 1,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "flower-cluster-yellow": {
        "dims": (0.28, 0.28, 0.15),
        "max_tri": 300,
        "max_bytes": 20000,
        "petal_color": PALETTE["flower_yellow"],
        "center_color": PALETTE["amber_center"],
        "seed": 2,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "flower-cluster-white": {
        "dims": (0.28, 0.28, 0.14),
        "max_tri": 300,
        "max_bytes": 20000,
        "petal_color": PALETTE["flower_white"],
        "center_color": PALETTE["gold"],
        "seed": 3,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "flower-cluster-pink": {
        "dims": (0.28, 0.28, 0.16),
        "max_tri": 300,
        "max_bytes": 20000,
        "petal_color": PALETTE["flower_pink"],
        "center_color": PALETTE["flower_yellow"],
        "seed": 4,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "flower-cluster-purple": {
        "dims": (0.28, 0.28, 0.17),
        "max_tri": 300,
        "max_bytes": 20000,
        "petal_color": PALETTE["flower_purple"],
        "center_color": PALETTE["flower_yellow"],
        "seed": 5,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
    "grass-small": {
        "dims": (0.18, 0.18, 0.10),
        "max_tri": 120,
        "max_bytes": 15360,
        "seed": 6,
        "collision": [],
        "concept_sheet": "nature-foliage.png",
    },
}


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


def hex_to_linear_rgba(hex_str: str, tint: float = 1.0):
    h = hex_str.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    rl = max(0.0, min(1.0, srgb_to_linear(r) * tint))
    gl = max(0.0, min(1.0, srgb_to_linear(g) * tint))
    bl = max(0.0, min(1.0, srgb_to_linear(b) * tint))
    return (rl, gl, bl, 1.0)


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


class PartBuilder:
    def __init__(self):
        self.parts = []

    def _finalize_part_mesh(self, bm, color_hex, bevel_width=0.0, bevel_segments=0, smooth=False, shade_gradient=0.08):
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

        # Store raw sRGB palette hex per part; COLOR_0 (FLOAT_COLOR) is written once in build_combined_object.
        self.parts.append((final_mesh, color_hex.upper(), shade_gradient))

    def add_box(self, size, center, color_hex, rot_euler=(0.0, 0.0, 0.0), bevel=0.0, segments=0, smooth=False, taper_top=(1.0, 1.0)):
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

    def add_cylinder(self, radius_bottom, radius_top, depth, center, color_hex, vertices=6, rot_euler=(0.0, 0.0, 0.0), bevel=0.0, segments=0, smooth=True, scale_xy=(1.0, 1.0)):
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

    def add_sphere(self, radius, center, color_hex, subdivisions=1, scale=(1.0, 1.0, 1.0), rot_euler=(0.0, 0.0, 0.0), smooth=True):
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
        self._finalize_part_mesh(bm, color_hex, bevel_width=0.0, bevel_segments=0, smooth=smooth, shade_gradient=0.10)

    def add_plump_petal(self, length, width, thickness, center, rot_euler, color_hex):
        """
        Builds a chunky 3D low-poly petal with a broad rounded outer tip (8 triangles).
        Top has 5 domed triangles; bottom has a 3-triangle pentagon base.
        """
        bm = bmesh.new()
        v_base = bm.verts.new((0.0, 0.0, 0.0))
        v_l = bm.verts.new((length * 0.52, -width * 0.52, thickness * 0.12))
        v_tip_l = bm.verts.new((length * 0.96, -width * 0.28, thickness * 0.08))
        v_tip_r = bm.verts.new((length * 0.96, width * 0.28, thickness * 0.08))
        v_r = bm.verts.new((length * 0.52, width * 0.52, thickness * 0.12))
        v_top = bm.verts.new((length * 0.50, 0.0, thickness))

        # Top domed facets (5 tris)
        bm.faces.new((v_base, v_l, v_top))
        bm.faces.new((v_l, v_tip_l, v_top))
        bm.faces.new((v_tip_l, v_tip_r, v_top))
        bm.faces.new((v_tip_r, v_r, v_top))
        bm.faces.new((v_r, v_base, v_top))
        # Bottom pentagon face (triangulates to 3 tris -> 8 tris total)
        bm.faces.new((v_base, v_r, v_tip_r, v_tip_l, v_l))

        if any(abs(a) > 1e-5 for a in rot_euler):
            rot_mat = Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
            bmesh.ops.transform(bm, matrix=rot_mat, verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(center), verts=bm.verts)
        self._finalize_part_mesh(bm, color_hex, bevel_width=0.0, bevel_segments=0, smooth=False, shade_gradient=0.06)

    def add_flower_head(self, center, radius, petal_count, tilt_euler, yaw_offset, petal_color, center_color):
        """
        Builds a 5-petal chunky wildflower blossom disc + center button.
        5 petals * 8 tris + 1 center button (16 tris) = 56 triangles per blossom.
        """
        rot_head = Euler(tilt_euler, 'XYZ').to_matrix()
        head_origin = Vector(center)

        for i in range(petal_count):
            angle = yaw_offset + (2.0 * math.pi * i) / petal_count
            # Slight upward cup angle on each petal
            local_rot = Euler((0.0, -0.16, angle), 'XYZ').to_matrix()
            comb_euler = (rot_head @ local_rot).to_euler('XYZ')
            local_offset = rot_head @ Vector((math.cos(angle) * radius * 0.12, math.sin(angle) * radius * 0.12, 0.0))
            self.add_plump_petal(
                length=radius * 0.90,
                width=radius * 0.72,
                thickness=radius * 0.28,
                center=head_origin + local_offset,
                rot_euler=comb_euler,
                color_hex=petal_color,
            )

        btn_offset = rot_head @ Vector((0.0, 0.0, radius * 0.16))
        self.add_cylinder(
            radius_bottom=radius * 0.34,
            radius_top=radius * 0.26,
            depth=radius * 0.24,
            center=head_origin + btn_offset,
            color_hex=center_color,
            vertices=5,
            rot_euler=tilt_euler,
            bevel=0.0,
            segments=0,
            smooth=False,
        )

    def build_combined_object(self, key: str, target_dims, lock_x_bounds=False, z_ground_offset=0.0):
        bm = bmesh.new()
        part_id_layer = bm.faces.layers.int.new("part_id")
        palette_list = []

        for part_idx, (part_mesh, color_hex, shade_grad) in enumerate(self.parts):
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
                    new_f[part_id_layer] = part_idx
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

        bm.faces.ensure_lookup_table()
        face_part_ids = [f[part_id_layer] for f in bm.faces]

        mesh = bpy.data.meshes.new(key)
        bm.to_mesh(mesh)
        bm.free()

        # Single sRGB -> Linear-sRGB conversion & single linear AO pass written to FLOAT_COLOR
        col_attr = mesh.color_attributes.new(name="COLOR_0", type='FLOAT_COLOR', domain='CORNER')
        mesh.color_attributes.active_color = col_attr
        mesh.color_attributes.render_color_index = 0

        part_z_bounds = {}
        for poly_idx, poly in enumerate(mesh.polygons):
            pid = face_part_ids[poly_idx]
            for loop_idx in poly.loop_indices:
                vz = mesh.vertices[mesh.loops[loop_idx].vertex_index].co.z
                if pid not in part_z_bounds:
                    part_z_bounds[pid] = [vz, vz]
                else:
                    if vz < part_z_bounds[pid][0]:
                        part_z_bounds[pid][0] = vz
                    if vz > part_z_bounds[pid][1]:
                        part_z_bounds[pid][1] = vz

        linear_palette = [hex_to_linear_rgba(h, 1.0) for h in palette_list]

        for poly_idx, poly in enumerate(mesh.polygons):
            pid = face_part_ids[poly_idx]
            base_r, base_g, base_b, _ = linear_palette[pid]
            pz_min, pz_max = part_z_bounds.get(pid, (0.0, 1.0))
            pz_span = max(0.02, pz_max - pz_min)
            nz = poly.normal.z
            normal_ao = 0.96 + 0.04 * max(0.0, nz)
            for loop_idx in poly.loop_indices:
                v = mesh.vertices[mesh.loops[loop_idx].vertex_index]
                t_part = max(0.0, min(1.0, (v.co.z - pz_min) / pz_span))
                # Single linear AO: top of each part reaches 1.0 (exact palette color), base has subtle grounding AO
                part_ao = 0.84 + 0.16 * (t_part ** 0.55)
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
        obj["used_palette_colors"] = sorted(list(set(palette_list)))
        bpy.context.collection.objects.link(obj)
        return obj


def build_wildflower_cluster(pb: PartBuilder, spec: dict):
    """
    Builds a wildflower cluster without any dirt mound or planter box:
    - 4 stems rising directly from the ground plane (z=0)
    - 3 five-petal blossoms + 1 plump flower bud
    - 4 small basal leaves radiating near z=0
    Total triangles: 4*16 (stems) + 3*56 (5-petal blossoms) + 16 (bud) + 4*8 (leaves) = 280 tris (<= 300).
    """
    seed = spec["seed"]
    petal_col = spec["petal_color"]
    center_col = spec["center_color"]
    rot_z = (seed - 1) * 0.55

    def rot_xy(x, y, ang):
        c, s = math.cos(ang), math.sin(ang)
        return (x * c - y * s, x * s + y * c)

    # 3 full 5-petal blossoms + 1 plump bud stem
    stem_configs = [
        (-0.015, -0.010, -0.046, -0.035, 0.145, 0.066, 5, 0.22, -0.18),
        (0.018, -0.012, 0.056, -0.025, 0.132, 0.060, 5, 0.18, 0.24),
        (-0.010, 0.018, -0.018, 0.056, 0.124, 0.058, 5, -0.24, -0.12),
        (0.014, 0.014, 0.042, 0.042, 0.102, 0.030, 0, -0.18, 0.20),
    ]

    for idx, (bx, by, tx, ty, h, frad, pcount, tiltx, tilty) in enumerate(stem_configs):
        rbx, rby = rot_xy(bx, by, rot_z)
        rtx, rty = rot_xy(tx, ty, rot_z)
        mid_x = (rbx + rtx) * 0.5
        mid_y = (rby + rty) * 0.5
        dx = rtx - rbx
        dy = rty - rby
        stem_len = math.sqrt(dx * dx + dy * dy + h * h)
        pitch_x = -dy / max(0.05, h) * 0.75
        pitch_y = dx / max(0.05, h) * 0.75

        pb.add_cylinder(
            radius_bottom=0.012,
            radius_top=0.009,
            depth=stem_len,
            center=(mid_x, mid_y, h * 0.5),
            color_hex=PALETTE["grass_dark"],
            vertices=5,
            rot_euler=(pitch_x, pitch_y, 0.0),
            bevel=0.0,
            segments=0,
            smooth=True,
        )

        if pcount > 0:
            pb.add_flower_head(
                center=(rtx, rty, h),
                radius=frad,
                petal_count=pcount,
                tilt_euler=(tiltx, tilty, 0.0),
                yaw_offset=rot_z + idx * 0.85,
                petal_color=petal_col,
                center_color=center_col,
            )
        else:
            pb.add_cylinder(
                radius_bottom=frad * 0.75,
                radius_top=frad * 0.45,
                depth=frad * 1.25,
                center=(rtx, rty, h + frad * 0.35),
                color_hex=petal_col,
                vertices=5,
                rot_euler=(tiltx, tilty, 0.0),
                bevel=0.0,
                segments=0,
                smooth=True,
            )

    # 4 basal leaves directly at ground level (no dirt box)
    leaf_angles = [rot_z + i * (math.pi * 0.5) + 0.35 for i in range(4)]
    for i, lang in enumerate(leaf_angles):
        l_col = PALETTE["grass"] if i % 2 == 0 else PALETTE["grass_light"]
        lx = math.cos(lang) * 0.018
        ly = math.sin(lang) * 0.018
        pb.add_plump_petal(
            length=0.088 if i % 2 == 0 else 0.076,
            width=0.048,
            thickness=0.022,
            center=(lx, ly, 0.008),
            rot_euler=(0.0, -0.32, lang),
            color_hex=l_col,
        )


def build_grass_small(pb: PartBuilder):
    """
    Builds a small low-poly grass tuft (0.18m diameter, 0.10m height, <= 120 tris).
    Uses 2 lightly beveled main blades + 2 crisp accent blades = 112 triangles.
    """
    blades = [
        ((0.0, 0.0, 0.050), (0.036, 0.028, 0.100), (0.05, 0.0, 0.0), PALETTE["grass"], 0.004),
        ((-0.038, -0.015, 0.044), (0.032, 0.024, 0.086), (0.14, -0.30, 0.25), PALETTE["grass_light"], 0.004),
        ((0.038, 0.018, 0.042), (0.032, 0.024, 0.082), (-0.14, 0.30, -0.22), PALETTE["grass_dark"], 0.0),
        ((0.005, 0.036, 0.038), (0.030, 0.022, 0.074), (-0.28, -0.08, 0.15), PALETTE["grass"], 0.0),
    ]
    for center, size, rot, col, bev in blades:
        pb.add_box(
            size=size,
            center=center,
            color_hex=col,
            rot_euler=rot,
            bevel=bev,
            segments=1 if bev > 0 else 0,
            smooth=False,
            taper_top=(0.24, 0.32),
        )


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


def verify_glb_colors(glb_path: str, key: str, expected_hex_list: list):
    """Re-imports exported GLB and verifies representative COLOR_0 linear values convert back to sRGB within +-6/255."""
    before_objs = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    new_objs = [o for o in bpy.data.objects if o not in before_objs]
    mesh_objs = [o for o in new_objs if o.type == "MESH" and len(o.data.color_attributes) > 0]
    if not mesh_objs:
        print(f"[COLOR VERIFY FAIL] No mesh with color_attributes found in {glb_path}")
        sys.exit(1)

    sampled_srgb = []
    for mo in mesh_objs:
        col_attr = mo.data.color_attributes.get("COLOR_0") or mo.data.color_attributes[0]
        for item in col_attr.data:
            c = item.color
            sr = linear_to_srgb(c[0]) * 255.0
            sg = linear_to_srgb(c[1]) * 255.0
            sb = linear_to_srgb(c[2]) * 255.0
            sampled_srgb.append((sr, sg, sb, c[0], c[1], c[2]))

    results = {}
    for hex_str in expected_hex_list:
        tr, tg, tb = hex_to_srgb_255(hex_str)
        best_diff = 999.0
        best_sample = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        for sr, sg, sb, lr, lg, lb in sampled_srgb:
            diff = max(abs(sr - tr), abs(sg - tg), abs(sb - tb))
            if diff < best_diff:
                best_diff = diff
                best_sample = (sr, sg, sb, lr, lg, lb)

        sr, sg, sb, lr, lg, lb = best_sample
        meas_hex = f"#{int(round(sr)):02X}{int(round(sg)):02X}{int(round(sb)):02X}"
        print(
            f"[COLOR VERIFY] {key:22s} | target={hex_str} ({tr:3d},{tg:3d},{tb:3d}) | "
            f"measured={meas_hex} ({sr:5.1f},{sg:5.1f},{sb:5.1f}) linear=({lr:.4f},{lg:.4f},{lb:.4f}) | "
            f"max_diff={best_diff:.2f}/255"
        )
        if best_diff > 6.0:
            print(f"[COLOR VERIFY FAIL] {key} ({hex_str}) max_diff={best_diff:.2f} > 6.0/255")
            sys.exit(1)
        results[hex_str] = {
            "paletteHex": hex_str,
            "measuredHex": meas_hex,
            "measuredSrgb255": [round(sr, 2), round(sg, 2), round(sb, 2)],
            "measuredLinear": [round(lr, 4), round(lg, 4), round(lb, 4)],
            "maxDiff255": round(best_diff, 2),
        }

    for o in new_objs:
        mesh_data = o.data if o.type == "MESH" else None
        bpy.data.objects.remove(o, do_unlink=True)
        if mesh_data and mesh_data.users == 0:
            bpy.data.meshes.remove(mesh_data)

    return results


def setup_preview_studio():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1024
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
    sun_data.energy = 3.1
    sun_obj = bpy.data.objects.new("PreviewSun", sun_data)
    sun_obj.rotation_euler = Euler((math.radians(48), math.radians(-22), math.radians(32)), 'XYZ')
    bpy.context.collection.objects.link(sun_obj)

    fill_data = bpy.data.lights.new("PreviewFill", type='SUN')
    fill_data.energy = 1.15
    fill_obj = bpy.data.objects.new("PreviewFill", fill_data)
    fill_obj.rotation_euler = Euler((math.radians(60), math.radians(28), math.radians(-140)), 'XYZ')
    bpy.context.collection.objects.link(fill_obj)

    return cam_obj, sun_obj, fill_obj


def build_mannequin_and_stage():
    """
    Builds a 0.60m SD 3-head-tall character mannequin + ground strip for scale comparison.
    """
    pb = PartBuilder()
    # Ground stage strip (z <= 0 so y=0 ground contact is clearly visible)
    pb.add_box((2.90, 0.72, 0.04), (0.0, 0.0, -0.02), PALETTE["stone"], bevel=0.005, segments=1)
    # 0.60m SD mannequin at x = -1.05
    mx = -1.05
    # Legs (0.0 ~ 0.16m)
    pb.add_cylinder(0.038, 0.042, 0.16, (mx - 0.048, 0.0, 0.08), PALETTE["ink"], vertices=8)
    pb.add_cylinder(0.038, 0.042, 0.16, (mx + 0.048, 0.0, 0.08), PALETTE["ink"], vertices=8)
    # Rounded torso/tunic (0.14 ~ 0.40m)
    pb.add_cylinder(0.115, 0.085, 0.26, (mx, 0.0, 0.27), PALETTE["coral"], vertices=12, bevel=0.01, segments=1)
    # Arms
    pb.add_cylinder(0.032, 0.028, 0.18, (mx - 0.115, 0.0, 0.28), PALETTE["cream_warm"], vertices=8, rot_euler=(0.0, 0.22, 0.0))
    pb.add_cylinder(0.032, 0.028, 0.18, (mx + 0.115, 0.0, 0.28), PALETTE["cream_warm"], vertices=8, rot_euler=(0.0, -0.22, 0.0))
    # SD Head (0.40 ~ 0.60m, diameter 0.20m -> total height = 0.60m)
    pb.add_sphere(0.10, (mx, 0.0, 0.50), PALETTE["cream_warm"], subdivisions=2)
    # 0.60m reference tick bar next to mannequin
    pb.add_box((0.015, 0.015, 0.60), (mx - 0.22, 0.0, 0.30), PALETTE["ink"])
    pb.add_box((0.05, 0.015, 0.012), (mx - 0.22, 0.0, 0.594), PALETTE["coral"])
    pb.add_box((0.05, 0.015, 0.012), (mx - 0.22, 0.0, 0.20), PALETTE["gold"])

    return pb.build_combined_object("_MannequinStage", (2.90, 0.72, 0.64), lock_x_bounds=True, z_ground_offset=-0.04)


def render_flowers_preview(built_objects, studio):
    """
    Renders a single 1024x1024 preview sheet at assets/source/previews/environment/flowers.png
    combining:
    - Top half (1024x512): 3/4 isometric game view of the 0.60m mannequin alongside all 5 flower clusters and grass-small
    - Bottom half (1024x512): Front orthographic elevation view showing exact height & ground contact next to the 0.60m mannequin
    """
    os.makedirs(PREVIEWS_ENV_DIR, exist_ok=True)
    cam_obj, _, _ = studio
    scene = bpy.context.scene

    stage_obj = build_mannequin_and_stage()

    order = [
        "flower-cluster-red",
        "flower-cluster-yellow",
        "flower-cluster-white",
        "flower-cluster-pink",
        "flower-cluster-purple",
        "grass-small",
    ]
    xs_pos = [-0.62, -0.26, 0.10, 0.46, 0.82, 1.14]

    for key, px in zip(order, xs_pos):
        obj = built_objects[key]
        obj.location = Vector((px, 0.0, 0.0))
        obj.hide_render = False

    # Top panel: 3/4 Isometric Game View
    target_iso = Vector((0.05, 0.0, 0.18))
    cam_iso = Vector((0.05 + 2.2, -2.6, 1.95))
    cam_obj.location = cam_iso
    cam_obj.rotation_euler = (target_iso - cam_iso).normalized().to_track_quat('-Z', 'Y').to_euler()
    cam_obj.data.ortho_scale = 2.85

    top_tmp = os.path.join(PREVIEWS_ENV_DIR, "_flowers_top.png")
    scene.render.filepath = top_tmp
    bpy.ops.render.render(write_still=True)

    # Bottom panel: Front Orthographic Elevation View (grounding & height check against 0.60m mannequin)
    target_front = Vector((0.05, 0.0, 0.22))
    cam_front = Vector((0.05, -3.2, 0.22))
    cam_obj.location = cam_front
    cam_obj.rotation_euler = (target_front - cam_front).normalized().to_track_quat('-Z', 'Y').to_euler()
    cam_obj.data.ortho_scale = 2.85

    bot_tmp = os.path.join(PREVIEWS_ENV_DIR, "_flowers_bot.png")
    scene.render.filepath = bot_tmp
    bpy.ops.render.render(write_still=True)

    # Composite into 1024x1024 flowers.png
    comp_img = bpy.data.images.new("flowers_comp", width=1024, height=1024, alpha=True)
    comp_pixels = [1.0] * (1024 * 1024 * 4)

    for panel_path, y_offset in ((top_tmp, 512), (bot_tmp, 0)):
        p_img = bpy.data.images.load(panel_path)
        p_pix = list(p_img.pixels)
        for row in range(512):
            src_start = row * 1024 * 4
            dst_start = (y_offset + row) * 1024 * 4
            comp_pixels[dst_start:dst_start + 1024 * 4] = p_pix[src_start:src_start + 1024 * 4]
        bpy.data.images.remove(p_img)
        if os.path.exists(panel_path):
            os.remove(panel_path)

    out_preview = os.path.join(PREVIEWS_ENV_DIR, "flowers.png")
    comp_img.pixels[:] = comp_pixels
    comp_img.file_format = 'PNG'
    comp_img.filepath_raw = out_preview
    comp_img.save()
    bpy.data.images.remove(comp_img)

    bpy.data.objects.remove(stage_obj, do_unlink=True)
    for obj in built_objects.values():
        obj.location = Vector((0.0, 0.0, 0.0))

    return out_preview


def update_asset_metadata(new_entries: dict):
    meta_path = os.path.join(SOURCE_ENV_DIR, "asset-metadata.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta_doc = json.load(f)

    assets_map = meta_doc.get("assets", {})
    for k, v in new_entries.items():
        assets_map[k] = v

    total_tris = sum(item["triangles"] for item in assets_map.values())
    total_bytes = sum(item["bytes"] for item in assets_map.values())
    meta_doc["colorSpaceNote"] = "색공간 수정(2026-11-01): sRGB 팔레트 값을 Linear-sRGB로 한 번만 변환해 COLOR_0(FLOAT_COLOR)에 기록하고 선형 공간에서 AO 곱을 한 번만 적용"
    meta_doc["assets"] = assets_map
    meta_doc["summary"] = {
        "assetCount": len(assets_map),
        "totalTriangles": total_tris,
        "totalBytes": total_bytes,
        "totalKiB": round(total_bytes / 1024.0, 2),
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_doc, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main():
    print(f"[INFO] Running build_flowers.py on Blender {bpy.app.version_string}")
    bpy.ops.wm.read_factory_settings(use_empty=True)

    studio = setup_preview_studio()
    built_objects = {}
    new_metadata = {}

    for key, spec in FLOWER_SPECS.items():
        pb = PartBuilder()
        if key == "grass-small":
            build_grass_small(pb)
        else:
            build_wildflower_cluster(pb, spec)

        obj = pb.build_combined_object(key, spec["dims"], lock_x_bounds=False, z_ground_offset=0.0)
        built_objects[key] = obj

        glb_path = export_asset_glb(obj, key)
        used_colors = list(obj.get("used_palette_colors", []))
        color_verify = verify_glb_colors(glb_path, key, used_colors)
        tri_count = len(obj.data.polygons)
        byte_size = os.path.getsize(glb_path)

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
        assert byte_size <= spec["max_bytes"], f"{key} exceeded byte budget: {byte_size} > {spec['max_bytes']}"

        new_metadata[key] = {
            "path": f"assets/abraxas/environment/{key}.glb",
            "scale": 1,
            "collision": spec["collision"],
            "triangles": tri_count,
            "bytes": byte_size,
            "maxTriangles": spec["max_tri"],
            "maxBytes": spec["max_bytes"],
            "bounds": bounds,
            "materials": len(obj.data.materials),
            "vertexColorAttribute": "COLOR_0",
            "colorAttributeType": "FLOAT_COLOR",
            "dracoCompressed": True,
            "concept": f"assets/source/concepts/environment/{spec['concept_sheet']}",
            "preview": "assets/source/previews/environment/flowers.png",
            "colorVerification": color_verify,
        }
        print(f"[OK] {key:22s} | tri={tri_count:3d}/{spec['max_tri']:3d} | bytes={byte_size:5d}/{spec['max_bytes']:5d} | bounds={bounds['width']}x{bounds['depth']}x{bounds['height']}")

    preview_path = render_flowers_preview(built_objects, studio)
    update_asset_metadata(new_metadata)
    print(f"[INFO] Rendered preview to {preview_path} and updated asset-metadata.json")


if __name__ == "__main__":
    main()
