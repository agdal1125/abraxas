import bpy
import bmesh
import math
import json
import struct
import os
from mathutils import Vector, Matrix, Euler

WORKSPACE = "C:/Users/jake1/Desktop/abraxas/.claude/worktrees/overhaul-characters"
ARTIFACT_DIR = "C:/Users/jake1/.gemini/antigravity-cli/brain/101c2ff1-b0d8-495b-baac-4c63174efa87"
SOURCE_DIR = f"{WORKSPACE}/assets/source/characters"
CONCEPT_DIR = f"{WORKSPACE}/assets/source/concepts/characters"
PREVIEW_DIR = f"{WORKSPACE}/assets/source/previews/characters"
EXPORT_DIR = f"{WORKSPACE}/client/public/assets/abraxas/characters"

for d in [SOURCE_DIR, CONCEPT_DIR, PREVIEW_DIR, EXPORT_DIR]:
    os.makedirs(d, exist_ok=True)


def srgb_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_str: str, alpha: float = 1.0):
    h = hex_str.lstrip("#")
    r = srgb_to_linear(int(h[0:2], 16) / 255.0)
    g = srgb_to_linear(int(h[2:4], 16) / 255.0)
    b = srgb_to_linear(int(h[4:6], 16) / 255.0)
    return (r, g, b, alpha)


PALETTE = {
    "cream": "#FFF8EC",
    "warm_body": "#EED6B8",
    "eggshell": "#E9D7BB",
    "ink": "#3B2A22",
    "wood": "#9B7355",
    "stone": "#777777",
    "gray_body": "#A0A0A0",
    "gray_cap": "#777777",
    "a": "#FF7A59",
    "b": "#FFB020",
    "c": "#8E6BFF",
    "d": "#14B8A6",
}

CONCEPT_SOURCES = {
    "player": f"{ARTIFACT_DIR}/character_concept_player_1793496357497.jpg",
    "char-a": f"{ARTIFACT_DIR}/character_concept_chara_1793496376028.jpg",
    "char-b": f"{ARTIFACT_DIR}/character_concept_charb_1793496394723.jpg",
    "char-c": f"{ARTIFACT_DIR}/char_c_1793496351405.jpg",
    "char-d": f"{ARTIFACT_DIR}/char_d_1793496370897.jpg",
    "quest-npc": f"{ARTIFACT_DIR}/quest_npc_1793496386962.jpg",
}


def copy_concepts_to_png():
    for key, src_path in CONCEPT_SOURCES.items():
        dst_path = f"{CONCEPT_DIR}/{key}.png"
        if not os.path.exists(src_path):
            raise FileNotFoundError(f"Missing concept artifact for {key}: {src_path}")
        img = bpy.data.images.load(src_path, check_existing=False)
        w, h = img.size[0], img.size[1]
        if w > 1536 or h > 1536:
            img.scale(min(1536, w), min(1536, h))
        img.filepath_raw = dst_path
        img.file_format = "PNG"
        img.save()
        bpy.data.images.remove(img)
        print(f"[CONCEPT] Saved {dst_path} ({w}x{h})")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = 24
    scene.render.fps_base = 1.0
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"


def finish_part_mesh(bm, name: str, color_hex: str, weight_map: dict, smooth: bool = True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = smooth

    col_attr = mesh.color_attributes.new(name="COLOR_0", type="BYTE_COLOR", domain="CORNER")
    rgba = hex_to_linear_rgba(color_hex, 1.0)
    for i in range(len(col_attr.data)):
        col_attr.data[i].color = rgba

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    for bone_name, w in weight_map.items():
        vg = obj.vertex_groups.new(name=bone_name)
        vg.add(list(range(len(mesh.vertices))), w, "REPLACE")

    return obj


def make_ellipsoid(rx, ry, rz, center, u_seg=16, v_seg=10, taper_top=0.0, bulge_bottom=0.0, flatten_bottom=0.0, tilt_euler=(0.0, 0.0, 0.0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u_seg, v_segments=v_seg, radius=1.0)
    rot_mat = Euler(tilt_euler, "XYZ").to_matrix().to_4x4()
    for v in bm.verts:
        z_norm = v.co.z
        scale_xy = 1.0 - taper_top * z_norm
        if bulge_bottom != 0.0 and z_norm < 0.25:
            scale_xy += bulge_bottom * ((0.25 - z_norm) / 1.25) ** 1.3
        x = v.co.x * rx * scale_xy
        y = v.co.y * ry * scale_xy
        z = v.co.z * rz
        if flatten_bottom > 0.0 and z_norm < -1.0 + flatten_bottom:
            z = (-1.0 + flatten_bottom) * rz
        p = rot_mat @ Vector((x, y, z))
        v.co = p + Vector(center)
    return bm


def make_beveled_box(sx, sy, sz, center, bevel_width=0.018, bevel_segments=1, tilt_euler=(0.0, 0.0, 0.0), taper_top=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        t_factor = 1.0 - taper_top * (v.co.z * 2.0)
        v.co.x *= sx * t_factor
        v.co.y *= sy * t_factor
        v.co.z *= sz
    if bevel_width > 0:
        bmesh.ops.bevel(
            bm,
            geom=bm.edges[:],
            offset=bevel_width,
            offset_type="OFFSET",
            segments=bevel_segments,
            profile=0.5,
            affect="EDGES",
        )
    rot_mat = Euler(tilt_euler, "XYZ").to_matrix().to_4x4()
    for v in bm.verts:
        v.co = (rot_mat @ v.co) + Vector(center)
    return bm


def make_beveled_cylinder(r_bottom, r_top, height, center, segs=12, bevel_width=0.010, bevel_segments=1, tilt_euler=(0.0, 0.0, 0.0), scale_xy=(1.0, 1.0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segs,
        radius1=r_bottom,
        radius2=r_top,
        depth=height,
    )
    cap_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
    if bevel_width > 0 and cap_edges:
        bmesh.ops.bevel(
            bm,
            geom=cap_edges,
            offset=bevel_width,
            offset_type="OFFSET",
            segments=bevel_segments,
            profile=0.5,
            affect="EDGES",
        )
    rot_mat = Euler(tilt_euler, "XYZ").to_matrix().to_4x4()
    for v in bm.verts:
        p = Vector((v.co.x * scale_xy[0], v.co.y * scale_xy[1], v.co.z))
        v.co = (rot_mat @ p) + Vector(center)
    return bm


def make_torus(major_r, minor_r, center, major_seg=16, minor_seg=8, tilt_euler=(0.0, 0.0, 0.0), scale_xyz=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r,
        minor_radius=minor_r,
        major_segments=major_seg,
        minor_segments=minor_seg,
        location=(0, 0, 0),
    )
    tmp_obj = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(tmp_obj.data)
    bpy.data.objects.remove(tmp_obj, do_unlink=True)
    rot_mat = Euler(tilt_euler, "XYZ").to_matrix().to_4x4()
    for v in bm.verts:
        p = Vector((v.co.x * scale_xyz[0], v.co.y * scale_xyz[1], v.co.z * scale_xyz[2]))
        v.co = (rot_mat @ p) + Vector(center)
    return bm


def make_eggshell_cap(center, rx=0.132, ry=0.128, rz=0.118, thickness=0.012, num_teeth=8):
    bm = bmesh.new()
    u_seg = num_teeth * 2
    v_seg = 5
    outer_rings = []
    inner_rings = []

    for iv in range(v_seg + 1):
        t = iv / v_seg
        phi = t * (math.pi * 0.48)
        ring_out = []
        ring_in = []
        for iu in range(u_seg):
            theta = (iu / u_seg) * math.tau
            tooth = 1.0 if (iu % 2 == 0) else 0.0
            rim_z_offset = (-0.025 if tooth > 0.5 else 0.008) * ((1.0 - t) ** 1.5)
            cos_p = math.cos(phi)
            sin_p = math.sin(phi)
            ox = math.cos(theta) * rx * cos_p
            oy = math.sin(theta) * ry * cos_p
            oz = rz * sin_p + rim_z_offset

            ix = math.cos(theta) * (rx - thickness) * cos_p
            iy = math.sin(theta) * (ry - thickness) * cos_p
            iz = (rz - thickness) * sin_p + rim_z_offset + 0.002

            ring_out.append(bm.verts.new((ox + center[0], oy + center[1], oz + center[2])))
            ring_in.append(bm.verts.new((ix + center[0], iy + center[1], iz + center[2])))
        outer_rings.append(ring_out)
        inner_rings.append(ring_in)

    for iv in range(v_seg):
        for iu in range(u_seg):
            nu = (iu + 1) % u_seg
            bm.faces.new((outer_rings[iv][iu], outer_rings[iv][nu], outer_rings[iv + 1][nu], outer_rings[iv + 1][iu]))
            bm.faces.new((inner_rings[iv][nu], inner_rings[iv][iu], inner_rings[iv + 1][iu], inner_rings[iv + 1][nu]))

    for iu in range(u_seg):
        nu = (iu + 1) % u_seg
        bm.faces.new((inner_rings[0][iu], inner_rings[0][nu], outer_rings[0][nu], outer_rings[0][iu]))

    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.001)
    return bm


def make_pennant_flag(flag_origin):
    bm = bmesh.new()
    half_y = 0.007
    pts_2d = [
        (0.0, 0.040),
        (0.0, -0.040),
        (0.098, 0.004),
    ]
    front_v = [bm.verts.new((flag_origin[0] + x, flag_origin[1] - half_y, flag_origin[2] + z)) for x, z in pts_2d]
    back_v = [bm.verts.new((flag_origin[0] + x, flag_origin[1] + half_y, flag_origin[2] + z)) for x, z in pts_2d]
    bm.faces.new((front_v[0], front_v[1], front_v[2]))
    bm.faces.new((back_v[2], back_v[1], back_v[0]))
    for i in range(3):
        ni = (i + 1) % 3
        bm.faces.new((front_v[i], back_v[i], back_v[ni], front_v[ni]))
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.003, segments=1, profile=0.5, affect="EDGES")
    return bm


def add_common_face(parts, head_center, head_rx, head_ry, head_rz):
    eye_y = head_center[1] - head_ry * 0.95
    eye_z = head_center[2] - 0.008
    for side in (-1, 1):
        bm_eye = make_ellipsoid(0.011, 0.007, 0.015, (side * 0.044, eye_y, eye_z), u_seg=8, v_seg=6)
        parts.append(finish_part_mesh(bm_eye, f"eye_{side}", PALETTE["ink"], {"head": 1.0}))
    bm_mouth = make_ellipsoid(0.012, 0.006, 0.005, (0.0, head_center[1] - head_ry * 0.97, head_center[2] - 0.038), u_seg=8, v_seg=6)
    parts.append(finish_part_mesh(bm_mouth, "mouth", PALETTE["ink"], {"head": 1.0}))


def add_common_limbs(parts, leg_color, arm_color, hand_color, shoulder_x=0.092, shoulder_z=0.30, hip_x=0.052, segs=12):
    for side, suffix in ((-1, "r"), (1, "l")):
        b_leg = f"leg_{suffix}"
        bm_leg = make_beveled_cylinder(0.036, 0.038, 0.11, (side * hip_x, 0.0, 0.068), segs=segs, bevel_width=0.009, bevel_segments=1)
        parts.append(finish_part_mesh(bm_leg, f"leg_{suffix}_mesh", leg_color, {b_leg: 1.0}))
        bm_foot = make_ellipsoid(0.039, 0.047, 0.025, (side * hip_x, -0.010, 0.021), u_seg=segs, v_seg=6, flatten_bottom=0.28)
        parts.append(finish_part_mesh(bm_foot, f"foot_{suffix}_mesh", leg_color, {b_leg: 1.0}))

    for side, suffix in ((-1, "r"), (1, "l")):
        b_arm = f"arm_{suffix}"
        tilt = (0.0, -side * 0.38, 0.0)
        arm_cx = side * (shoulder_x + 0.020)
        arm_cz = shoulder_z - 0.046
        bm_arm = make_ellipsoid(0.029, 0.027, 0.068, (arm_cx, 0.0, arm_cz), u_seg=segs, v_seg=8, taper_top=-0.12, tilt_euler=tilt)
        parts.append(finish_part_mesh(bm_arm, f"arm_{suffix}_mesh", arm_color, {b_arm: 1.0}))
        hand_cx = side * (shoulder_x + 0.042)
        hand_cz = shoulder_z - 0.095
        bm_hand = make_ellipsoid(0.026, 0.025, 0.026, (hand_cx, -0.004, hand_cz), u_seg=10, v_seg=6)
        parts.append(finish_part_mesh(bm_hand, f"hand_{suffix}_mesh", hand_color, {b_arm: 1.0}))


def build_player_parts():
    parts = []
    add_common_limbs(
        parts,
        leg_color=PALETTE["warm_body"],
        arm_color=PALETTE["cream"],
        hand_color=PALETTE["cream"],
        shoulder_x=0.078,
        shoulder_z=0.295,
        hip_x=0.048,
        segs=10,
    )
    bm_torso = make_ellipsoid(0.102, 0.092, 0.118, (0.0, 0.0, 0.215), u_seg=14, v_seg=10, taper_top=0.18, bulge_bottom=0.08)
    parts.append(finish_part_mesh(bm_torso, "torso", PALETTE["warm_body"], {"body": 1.0}))

    head_center = (0.0, 0.0, 0.432)
    bm_head = make_ellipsoid(0.122, 0.118, 0.116, head_center, u_seg=14, v_seg=10)
    parts.append(finish_part_mesh(bm_head, "head_mesh", PALETTE["cream"], {"head": 1.0}))

    bm_shell = make_eggshell_cap((0.0, 0.0, 0.462), rx=0.132, ry=0.128, rz=0.118, thickness=0.012, num_teeth=8)
    parts.append(finish_part_mesh(bm_shell, "eggshell", PALETTE["eggshell"], {"head": 1.0}))
    return parts


def build_char_a_parts():
    parts = []
    add_common_limbs(
        parts,
        leg_color=PALETTE["a"],
        arm_color=PALETTE["a"],
        hand_color=PALETTE["cream"],
        shoulder_x=0.098,
        shoulder_z=0.302,
        hip_x=0.054,
        segs=12,
    )
    bm_torso = make_ellipsoid(0.132, 0.122, 0.122, (0.0, 0.0, 0.222), u_seg=16, v_seg=12, taper_top=0.04)
    parts.append(finish_part_mesh(bm_torso, "torso", PALETTE["a"], {"body": 1.0}))

    bm_collar = make_torus(0.078, 0.015, (0.0, 0.0, 0.340), major_seg=16, minor_seg=8, scale_xyz=(1.0, 0.94, 0.85))
    parts.append(finish_part_mesh(bm_collar, "collar", PALETTE["cream"], {"body": 0.5, "head": 0.5}))

    head_center = (0.0, 0.0, 0.468)
    bm_head = make_ellipsoid(0.128, 0.122, 0.124, head_center, u_seg=16, v_seg=12)
    parts.append(finish_part_mesh(bm_head, "head_mesh", PALETTE["cream"], {"head": 1.0}))
    add_common_face(parts, head_center, 0.128, 0.122, 0.124)

    staff_center = (0.145, -0.018, 0.265)
    bm_staff = make_beveled_cylinder(0.008, 0.008, 0.195, staff_center, segs=10, bevel_width=0.002, bevel_segments=1, tilt_euler=(0.0, 0.12, 0.0))
    parts.append(finish_part_mesh(bm_staff, "flag_staff", PALETTE["wood"], {"hand_prop": 1.0}))
    bm_flag = make_pennant_flag((0.153, -0.018, 0.312))
    parts.append(finish_part_mesh(bm_flag, "flag_cloth", PALETTE["cream"], {"hand_prop": 1.0}))
    return parts


def build_char_b_parts():
    parts = []
    add_common_limbs(
        parts,
        leg_color=PALETTE["b"],
        arm_color=PALETTE["b"],
        hand_color=PALETTE["cream"],
        shoulder_x=0.082,
        shoulder_z=0.305,
        hip_x=0.054,
        segs=12,
    )
    bm_torso = make_ellipsoid(0.118, 0.108, 0.126, (0.0, 0.0, 0.222), u_seg=16, v_seg=12, taper_top=0.28, bulge_bottom=0.20)
    parts.append(finish_part_mesh(bm_torso, "torso", PALETTE["b"], {"body": 1.0}))

    bm_apron = make_ellipsoid(0.088, 0.032, 0.095, (0.0, -0.095, 0.212), u_seg=14, v_seg=10, taper_top=0.24, bulge_bottom=0.14, tilt_euler=(-0.08, 0.0, 0.0))
    parts.append(finish_part_mesh(bm_apron, "apron_front", PALETTE["cream"], {"body": 1.0}))
    for side in (-1, 1):
        bm_strap = make_beveled_box(0.018, 0.016, 0.055, (side * 0.038, -0.072, 0.312), bevel_width=0.004, bevel_segments=1, tilt_euler=(0.35, -side * 0.12, 0.0))
        parts.append(finish_part_mesh(bm_strap, f"apron_strap_{side}", PALETTE["cream"], {"body": 1.0}))

    head_center = (0.0, 0.0, 0.468)
    bm_head = make_ellipsoid(0.128, 0.122, 0.124, head_center, u_seg=16, v_seg=12)
    parts.append(finish_part_mesh(bm_head, "head_mesh", PALETTE["cream"], {"head": 1.0}))
    add_common_face(parts, head_center, 0.128, 0.122, 0.124)
    return parts


def build_char_c_parts():
    parts = []
    add_common_limbs(
        parts,
        leg_color=PALETTE["c"],
        arm_color=PALETTE["c"],
        hand_color=PALETTE["cream"],
        shoulder_x=0.088,
        shoulder_z=0.315,
        hip_x=0.048,
        segs=12,
    )
    bm_torso = make_beveled_cylinder(0.096, 0.090, 0.235, (0.0, 0.0, 0.225), segs=16, bevel_width=0.028, bevel_segments=2, scale_xy=(1.0, 0.90))
    parts.append(finish_part_mesh(bm_torso, "torso", PALETTE["c"], {"body": 1.0}))

    bm_scarf = make_torus(0.082, 0.016, (0.0, 0.0, 0.348), major_seg=16, minor_seg=8, scale_xyz=(1.0, 0.92, 0.88))
    parts.append(finish_part_mesh(bm_scarf, "scarf_ring", PALETTE["cream"], {"body": 0.5, "head": 0.5}))
    bm_tab = make_beveled_box(0.028, 0.016, 0.052, (0.030, -0.086, 0.318), bevel_width=0.005, bevel_segments=1, tilt_euler=(-0.12, 0.0, 0.05))
    parts.append(finish_part_mesh(bm_tab, "scarf_tab", PALETTE["cream"], {"body": 1.0}))

    head_center = (0.0, 0.0, 0.492)
    bm_head = make_ellipsoid(0.142, 0.136, 0.138, head_center, u_seg=16, v_seg=12)
    parts.append(finish_part_mesh(bm_head, "head_mesh", PALETTE["cream"], {"head": 1.0}))
    add_common_face(parts, head_center, 0.142, 0.136, 0.138)

    glass_y = head_center[1] - 0.136
    glass_z = head_center[2] - 0.006
    for side in (-1, 1):
        bm_rim = make_torus(0.036, 0.006, (side * 0.046, glass_y, glass_z), major_seg=16, minor_seg=6, tilt_euler=(math.radians(90), 0.0, 0.0))
        parts.append(finish_part_mesh(bm_rim, f"glass_rim_{side}", PALETTE["ink"], {"head": 1.0}))
    bm_bridge = make_beveled_box(0.024, 0.008, 0.008, (0.0, glass_y, glass_z + 0.004), bevel_width=0.002, bevel_segments=1)
    parts.append(finish_part_mesh(bm_bridge, "glass_bridge", PALETTE["ink"], {"head": 1.0}))
    return parts


def build_char_d_parts():
    parts = []
    add_common_limbs(
        parts,
        leg_color=PALETTE["cream"],
        arm_color=PALETTE["cream"],
        hand_color=PALETTE["cream"],
        shoulder_x=0.118,
        shoulder_z=0.300,
        hip_x=0.058,
        segs=12,
    )
    bm_torso = make_beveled_box(0.215, 0.155, 0.225, (0.0, 0.0, 0.222), bevel_width=0.026, bevel_segments=2)
    parts.append(finish_part_mesh(bm_torso, "torso", PALETTE["d"], {"body": 1.0}))

    for side, suffix in ((-1, "r"), (1, "l")):
        bm_pad = make_beveled_box(0.072, 0.095, 0.075, (side * 0.122, 0.0, 0.295), bevel_width=0.020, bevel_segments=2, tilt_euler=(0.0, -side * 0.12, 0.0))
        parts.append(finish_part_mesh(bm_pad, f"shoulder_pad_{suffix}", PALETTE["d"], {"body": 0.6, f"arm_{suffix}": 0.4}))

    bm_belt = make_beveled_box(0.226, 0.166, 0.028, (0.0, 0.0, 0.165), bevel_width=0.006, bevel_segments=1)
    parts.append(finish_part_mesh(bm_belt, "belt", PALETTE["wood"], {"body": 1.0}))

    head_center = (0.0, 0.0, 0.468)
    bm_head = make_ellipsoid(0.128, 0.122, 0.124, head_center, u_seg=16, v_seg=12)
    parts.append(finish_part_mesh(bm_head, "head_mesh", PALETTE["cream"], {"head": 1.0}))
    add_common_face(parts, head_center, 0.128, 0.122, 0.124)

    bm_handle = make_beveled_cylinder(0.010, 0.010, 0.135, (0.148, -0.020, 0.195), segs=10, bevel_width=0.002, bevel_segments=1, tilt_euler=(math.radians(75), 0.0, math.radians(-20)))
    parts.append(finish_part_mesh(bm_handle, "hammer_handle", PALETTE["wood"], {"hand_prop": 1.0}))
    bm_hhead = make_beveled_box(0.062, 0.095, 0.058, (0.130, -0.065, 0.175), bevel_width=0.009, bevel_segments=1, tilt_euler=(math.radians(15), math.radians(10), math.radians(-20)))
    parts.append(finish_part_mesh(bm_hhead, "hammer_head", PALETTE["stone"], {"hand_prop": 1.0}))
    return parts


def build_quest_npc_parts():
    # Budget <= 2,000 tris: Grayscale body + small dark gray brimmed cap (height 0.56m)
    parts = []
    add_common_limbs(
        parts,
        leg_color=PALETTE["gray_body"],
        arm_color=PALETTE["gray_body"],
        hand_color=PALETTE["gray_body"],
        shoulder_x=0.082,
        shoulder_z=0.285,
        hip_x=0.048,
        segs=10,
    )
    bm_torso = make_ellipsoid(0.104, 0.094, 0.115, (0.0, 0.0, 0.208), u_seg=12, v_seg=8, taper_top=0.15)
    parts.append(finish_part_mesh(bm_torso, "torso", PALETTE["gray_body"], {"body": 1.0}))

    head_center = (0.0, 0.0, 0.425)
    bm_head = make_ellipsoid(0.120, 0.116, 0.114, head_center, u_seg=12, v_seg=8)
    parts.append(finish_part_mesh(bm_head, "head_mesh", PALETTE["cream"], {"head": 1.0}))
    add_common_face(parts, head_center, 0.120, 0.116, 0.114)

    bm_crown = make_ellipsoid(0.092, 0.096, 0.052, (0.0, 0.0, 0.525), u_seg=12, v_seg=6, flatten_bottom=0.45)
    parts.append(finish_part_mesh(bm_crown, "cap_crown", PALETTE["gray_cap"], {"head": 1.0}))
    bm_brim = make_ellipsoid(0.078, 0.068, 0.012, (0.0, -0.072, 0.506), u_seg=10, v_seg=6, tilt_euler=(0.08, 0.0, 0.0))
    parts.append(finish_part_mesh(bm_brim, "cap_brim", PALETTE["gray_cap"], {"head": 1.0}))
    return parts


def join_and_fit_height(parts, char_key: str, target_height: float):
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    mesh_obj = bpy.context.active_object
    mesh_obj.name = f"{char_key}_mesh"
    mesh_obj.data.name = f"{char_key}_geom"

    verts = mesh_obj.data.vertices
    min_z = min(v.co.z for v in verts)
    max_z = max(v.co.z for v in verts)
    cur_h = max_z - min_z
    scale_f = target_height / cur_h
    for v in verts:
        v.co.z = (v.co.z - min_z) * scale_f
        v.co.x *= scale_f
        v.co.y *= scale_f
    mesh_obj.data.update()

    mesh_obj.location = (0.0, 0.0, 0.0)
    mesh_obj.rotation_euler = (0.0, 0.0, 0.0)
    mesh_obj.scale = (1.0, 1.0, 1.0)
    return mesh_obj


def bake_ao_into_vertex_color(mesh_obj, char_key: str):
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj

    mesh = mesh_obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")

    ao_img = bpy.data.images.new(name=f"{char_key}_ao", width=512, height=512, alpha=False, float_buffer=False)
    ao_img.colorspace_settings.name = "Non-Color"

    mat = bpy.data.materials.new(name=f"{char_key}_mat")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new(type="ShaderNodeOutputMaterial")
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.85

    vcol_node = nodes.new(type="ShaderNodeVertexColor")
    vcol_node.layer_name = "COLOR_0"
    links.new(vcol_node.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

    tex_node = nodes.new(type="ShaderNodeTexImage")
    tex_node.image = ao_img
    for n in nodes:
        n.select = False
    tex_node.select = True
    nodes.active = tex_node

    mesh.materials.clear()
    mesh.materials.append(mat)

    scene = bpy.context.scene
    prev_engine = scene.render.engine
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.bake_type = "AO"
    scene.render.bake.margin = 8
    scene.render.bake.use_clear = True

    bpy.ops.object.bake(type="AO")

    ao_path = f"{SOURCE_DIR}/ao_{char_key}.png"
    ao_img.filepath_raw = ao_path
    ao_img.file_format = "PNG"
    ao_img.save()

    pixels = list(ao_img.pixels)
    uv_layer = mesh.uv_layers.active.data
    col_attr = mesh.color_attributes["COLOR_0"].data

    for loop_idx in range(len(mesh.loops)):
        uv = uv_layer[loop_idx].uv
        px = min(511, max(0, int(uv.x * 511.0)))
        py = min(511, max(0, int(uv.y * 511.0)))
        ao_val = pixels[(py * 512 + px) * 4]
        v_idx = mesh.loops[loop_idx].vertex_index
        z_norm = max(0.0, min(1.0, mesh.vertices[v_idx].co.z / 0.60))
        shade = (0.80 + 0.20 * max(0.40, min(1.0, ao_val))) * (0.94 + 0.06 * z_norm)
        c = col_attr[loop_idx].color
        col_attr[loop_idx].color = (
            min(1.0, c[0] * shade),
            min(1.0, c[1] * shade),
            min(1.0, c[2] * shade),
            1.0,
        )

    nodes.remove(tex_node)
    bpy.data.images.remove(ao_img)
    while len(mesh.uv_layers) > 0:
        mesh.uv_layers.remove(mesh.uv_layers[0])

    scene.render.engine = prev_engine


def create_armature_and_bind(mesh_obj, char_key: str, shoulder_x=0.092, shoulder_z=0.30, hip_x=0.052):
    arm_data = bpy.data.armatures.new(f"{char_key}_armature_data")
    arm_obj = bpy.data.objects.new(f"{char_key}", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")

    eb = arm_data.edit_bones

    b_root = eb.new("root")
    b_root.head = (0.0, 0.0, 0.0)
    b_root.tail = (0.0, 0.0, 0.10)
    b_root.use_deform = True

    b_body = eb.new("body")
    b_body.head = (0.0, 0.0, 0.12)
    b_body.tail = (0.0, 0.0, 0.34)
    b_body.parent = b_root
    b_body.use_deform = True

    b_head = eb.new("head")
    b_head.head = (0.0, 0.0, 0.34)
    b_head.tail = (0.0, 0.0, 0.56)
    b_head.parent = b_body
    b_head.use_deform = True

    for side, suffix in ((-1, "r"), (1, "l")):
        b_arm = eb.new(f"arm_{suffix}")
        b_arm.head = (side * shoulder_x, 0.0, shoulder_z)
        b_arm.tail = (side * (shoulder_x + 0.042), 0.0, shoulder_z - 0.095)
        b_arm.parent = b_body
        b_arm.use_deform = True

        b_leg = eb.new(f"leg_{suffix}")
        b_leg.head = (side * hip_x, 0.0, 0.12)
        b_leg.tail = (side * hip_x, 0.0, 0.01)
        b_leg.parent = b_root
        b_leg.use_deform = True

    b_prop = eb.new("hand_prop")
    b_prop.head = (shoulder_x + 0.042, -0.012, shoulder_z - 0.095)
    b_prop.tail = (shoulder_x + 0.042, -0.012, shoulder_z - 0.015)
    b_prop.parent = eb["arm_l"]
    b_prop.use_deform = True

    # Align bone roll so every bone has local Z pointing forward (-Y) and local X pointing sideways (+X)
    for b in eb:
        b.align_roll(Vector((0.0, -1.0, 0.0)))

    bpy.ops.object.mode_set(mode="OBJECT")

    mesh_obj.parent = arm_obj
    mod = mesh_obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    return arm_obj


def apply_pose_at_phase(arm_obj, clip_name: str, phase: float):
    s1 = math.sin(phase)
    c1 = math.cos(phase)
    s2 = math.sin(phase * 2.0)

    for pb in arm_obj.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)

    arm_obj.pose.bones["root"].location = (0.0, 0.0, 0.0)

    if clip_name == "idle":
        # Note: along bone axis is local Y; pitch forward/back is local X; roll sideways is local Z
        arm_obj.pose.bones["body"].location = (0.0, 0.008 * s1, 0.0)
        arm_obj.pose.bones["body"].rotation_euler = (0.04 * s1, 0.0, 0.03 * c1)
        arm_obj.pose.bones["head"].rotation_euler = (-0.06 * s1, 0.04 * s1, 0.04 * c1)
        arm_obj.pose.bones["arm_l"].rotation_euler = (0.08 * s1, 0.0, 0.04 * (1.0 - c1))
        arm_obj.pose.bones["arm_r"].rotation_euler = (-0.08 * s1, 0.0, -0.04 * (1.0 - c1))
    elif clip_name == "walk":
        bounce = 0.018 * abs(s1)
        arm_obj.pose.bones["body"].location = (0.0, bounce, 0.0)
        arm_obj.pose.bones["body"].rotation_euler = (0.07, 0.09 * s1, 0.05 * s1)
        arm_obj.pose.bones["head"].rotation_euler = (-0.05 * s2, -0.06 * s1, -0.04 * s1)
        arm_obj.pose.bones["leg_l"].rotation_euler = (0.58 * s1, 0.0, 0.0)
        arm_obj.pose.bones["leg_r"].rotation_euler = (-0.58 * s1, 0.0, 0.0)
        arm_obj.pose.bones["arm_l"].rotation_euler = (-0.48 * s1, 0.0, 0.0)
        arm_obj.pose.bones["arm_r"].rotation_euler = (0.48 * s1, 0.0, 0.0)
    elif clip_name == "talk":
        nod = 0.14 * math.sin(phase * 2.0)
        tilt = 0.08 * s1
        arm_obj.pose.bones["body"].location = (0.0, 0.006 * abs(s2), 0.0)
        arm_obj.pose.bones["body"].rotation_euler = (0.04 * s2, 0.04 * s1, 0.0)
        arm_obj.pose.bones["head"].rotation_euler = (nod, 0.05 * s1, tilt)
        arm_obj.pose.bones["arm_l"].rotation_euler = (0.32 * (0.5 - 0.5 * c1), 0.0, 0.10 * s1)
        arm_obj.pose.bones["arm_r"].rotation_euler = (0.22 * (0.5 - 0.5 * math.cos(phase * 2.0)), 0.0, -0.08 * s1)


def bake_three_actions(arm_obj, char_key: str):
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj

    if not arm_obj.animation_data:
        arm_obj.animation_data_create()

    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"

    clips = [
        ("idle", 48),
        ("walk", 19),
        ("talk", 38),
    ]

    for clip_name, end_frame in clips:
        act = bpy.data.actions.new(name=f"{char_key}_{clip_name}")
        act.use_fake_user = True
        arm_obj.animation_data.action = act
        if hasattr(arm_obj.animation_data, "action_slot") and arm_obj.animation_data.action_slot is None:
            if len(act.slots) > 0:
                arm_obj.animation_data.action_slot = act.slots[0]

        for f in range(0, end_frame + 1):
            phase = (f / end_frame) * math.tau
            apply_pose_at_phase(arm_obj, clip_name, phase)
            for pb in arm_obj.pose.bones:
                pb.keyframe_insert(data_path="location", frame=f)
                pb.keyframe_insert(data_path="rotation_euler", frame=f)
                pb.keyframe_insert(data_path="scale", frame=f)

        track = arm_obj.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(name=clip_name, start=0, action=act)
        strip.name = clip_name
        track.mute = False

    arm_obj.animation_data.action = None
    # Mute NLA tracks during static preview renders so rest pose is evaluated cleanly;
    # export_character_glb unmutes them before export!
    for tr in arm_obj.animation_data.nla_tracks:
        tr.mute = True
    for pb in arm_obj.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def export_character_glb(arm_obj, mesh_obj, char_key: str) -> str:
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj

    for tr in arm_obj.animation_data.nla_tracks:
        tr.mute = False

    out_path = f"{EXPORT_DIR}/{char_key}.glb"
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_texcoords=False,
        export_normals=True,
        export_attributes=True,
        export_skins=True,
        export_all_influences=False,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=12,
        export_draco_generic_quantization=12,
    )

    for tr in arm_obj.animation_data.nla_tracks:
        tr.mute = True
    return out_path


def inspect_glb(glb_path: str, mesh_obj, max_tri: int, max_kib: int):
    file_bytes = os.path.getsize(glb_path)
    with open(glb_path, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        assert magic == b"glTF" and version == 2
        chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
        assert chunk_type == b"JSON"
        gltf_json = json.loads(f.read(chunk_len).decode("utf-8"))

    anim_names = [a.get("name") for a in gltf_json.get("animations", [])]
    skins = gltf_json.get("skins", [])
    joint_count = len(skins[0].get("joints", [])) if skins else 0
    extensions_used = gltf_json.get("extensionsUsed", [])
    meshes = gltf_json.get("meshes", [])
    prim_count = sum(len(m.get("primitives", [])) for m in meshes)
    mat_count = len(gltf_json.get("materials", []))
    has_color0 = any(
        "COLOR_0" in p.get("attributes", {})
        for m in meshes
        for p in m.get("primitives", [])
    )

    verts = mesh_obj.data.vertices
    xs = [v.co.x for v in verts]
    ys = [v.co.z for v in verts]
    zs = [-v.co.y for v in verts]
    tris = len(mesh_obj.data.polygons)
    kib = round(file_bytes / 1024.0, 2)

    assert tris <= max_tri, f"Triangle count {tris} exceeds budget {max_tri} for {glb_path}"
    assert file_bytes <= max_kib * 1024, f"File size {file_bytes} exceeds budget {max_kib} KiB for {glb_path}"
    assert set(anim_names) == {"idle", "walk", "talk"}, f"Missing expected clips in {glb_path}: {anim_names}"
    assert joint_count <= 16, f"Joint count {joint_count} exceeds 16 deform bones in {glb_path}"
    assert has_color0, f"COLOR_0 missing in {glb_path}"
    assert "KHR_draco_mesh_compression" in extensions_used, f"Draco missing in {glb_path}"

    info = {
        "bytes": file_bytes,
        "kib": kib,
        "triangles": tris,
        "primitives": prim_count,
        "materials": mat_count,
        "joints": joint_count,
        "clips": anim_names,
        "hasColor0": has_color0,
        "draco": True,
        "bounds": {
            "min": [round(min(xs), 4), round(min(ys), 4), round(min(zs), 4)],
            "max": [round(max(xs), 4), round(max(ys), 4), round(max(zs), 4)],
            "size": [
                round(max(xs) - min(xs), 4),
                round(max(ys) - min(ys), 4),
                round(max(zs) - min(zs), 4),
            ],
        },
    }
    print(f"[GLB VERIFY] {os.path.basename(glb_path)} -> {json.dumps(info)}")
    return info


def aim_camera_at(cam_obj, loc, target):
    cam_obj.location = Vector(loc)
    direction = Vector(target) - Vector(loc)
    rot_quat = direction.to_track_quat("-Z", "Y")
    cam_obj.rotation_euler = rot_quat.to_euler()


def setup_preview_helpers(scene):
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.film_transparent = False

    if not scene.world:
        scene.world = bpy.data.worlds.new("PreviewWorld")
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs[0].default_value = hex_to_linear_rgba("#F5EDE0", 1.0)
        bg_node.inputs[1].default_value = 0.72

    helper_col = bpy.data.collections.new("PreviewHelpers")
    scene.collection.children.link(helper_col)

    def link_helper(obj):
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        helper_col.objects.link(obj)
        return obj

    bm_guide = bmesh.new()
    b_gx = make_beveled_box(0.56, 0.008, 0.004, (0.0, 0.0, -0.002), bevel_width=0.0)
    b_gy = make_beveled_box(0.010, 0.14, 0.006, (0.0, 0.0, 0.0), bevel_width=0.0)
    b_pole = make_beveled_box(0.010, 0.010, 1.00, (-0.26, 0.0, 0.50), bevel_width=0.0)
    b_t50 = make_beveled_box(0.036, 0.010, 0.006, (-0.25, 0.0, 0.50), bevel_width=0.0)
    b_t60 = make_beveled_box(0.048, 0.010, 0.007, (-0.245, 0.0, 0.60), bevel_width=0.0)
    b_t100 = make_beveled_box(0.048, 0.010, 0.007, (-0.245, 0.0, 1.00), bevel_width=0.0)

    mesh_guide = bpy.data.meshes.new("guide_mesh")
    for sub_bm in (b_gx, b_gy, b_pole, b_t50, b_t60, b_t100):
        for v in sub_bm.verts:
            bm_guide.verts.new(v.co)
        bm_guide.verts.ensure_lookup_table()
        offset = len(bm_guide.verts) - len(sub_bm.verts)
        for f in sub_bm.faces:
            bm_guide.faces.new([bm_guide.verts[offset + v.index] for v in f.verts])
        sub_bm.free()

    bm_guide.to_mesh(mesh_guide)
    bm_guide.free()

    guide_obj = bpy.data.objects.new("GuideRuler", mesh_guide)
    link_helper(guide_obj)
    guide_mat = bpy.data.materials.new("GuideMat")
    guide_bsdf = guide_mat.node_tree.nodes.get("Principled BSDF")
    if guide_bsdf:
        guide_bsdf.inputs["Base Color"].default_value = hex_to_linear_rgba("#3B2A22", 1.0)
        guide_bsdf.inputs["Roughness"].default_value = 0.9
    guide_obj.data.materials.append(guide_mat)

    sun_data = bpy.data.lights.new("KeySun", type="SUN")
    sun_data.energy = 1.35
    sun_obj = bpy.data.objects.new("KeySun", sun_data)
    sun_obj.rotation_euler = (math.radians(52), math.radians(-18), math.radians(32))
    link_helper(sun_obj)

    fill_data = bpy.data.lights.new("FillSun", type="SUN")
    fill_data.energy = 0.45
    fill_obj = bpy.data.objects.new("FillSun", fill_data)
    fill_obj.rotation_euler = (math.radians(65), math.radians(25), math.radians(-140))
    link_helper(fill_obj)

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 0.78
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    link_helper(cam_obj)
    scene.camera = cam_obj

    return helper_col, cam_obj, cam_data, bg_node


def cleanup_preview_helpers(helper_col):
    for obj in list(helper_col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(helper_col)


def render_character_preview(arm_obj, mesh_obj, char_key: str):
    scene = bpy.context.scene
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    helper_col, cam_obj, cam_data, bg_node = setup_preview_helpers(scene)

    views = [
        ("front", (0.0, -2.0, 0.34), (0.0, 0.0, 0.34), 0.78),
        ("side", (2.0, 0.0, 0.34), (0.0, 0.0, 0.34), 0.78),
        ("quarter", (1.35, -1.35, 1.15), (0.0, 0.0, 0.31), 0.80),
    ]

    temp_paths = {}
    for vname, loc, target, oscale in views:
        aim_camera_at(cam_obj, loc, target)
        cam_data.ortho_scale = oscale
        tpath = f"{SOURCE_DIR}/_tmp_{char_key}_{vname}.png"
        scene.render.filepath = tpath
        bpy.ops.render.render(write_still=True)
        temp_paths[vname] = tpath

    orig_mat = mesh_obj.data.materials[0]
    sil_mat = bpy.data.materials.new("SilMat")
    snodes = sil_mat.node_tree.nodes
    slinks = sil_mat.node_tree.links
    snodes.clear()
    sout = snodes.new("ShaderNodeOutputMaterial")
    semit = snodes.new("ShaderNodeEmission")
    semit.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    semit.inputs["Strength"].default_value = 1.0
    slinks.new(semit.outputs["Emission"], sout.inputs["Surface"])
    mesh_obj.data.materials[0] = sil_mat

    if bg_node:
        bg_node.inputs[0].default_value = (0.04, 0.04, 0.05, 1.0)
        bg_node.inputs[1].default_value = 1.0
    aim_camera_at(cam_obj, (0.0, -2.0, 0.34), (0.0, 0.0, 0.34))
    cam_data.ortho_scale = 0.78
    tpath_sil = f"{SOURCE_DIR}/_tmp_{char_key}_sil.png"
    scene.render.filepath = tpath_sil
    bpy.ops.render.render(write_still=True)
    temp_paths["sil"] = tpath_sil

    mesh_obj.data.materials[0] = orig_mat

    comp_img = bpy.data.images.new(f"{char_key}_preview", width=1024, height=1024, alpha=True)
    comp_pixels = [0.0] * (1024 * 1024 * 4)

    quadrants = [
        ("front", 0, 512),
        ("side", 512, 512),
        ("quarter", 0, 0),
        ("sil", 512, 0),
    ]
    for qname, ox, oy in quadrants:
        qimg = bpy.data.images.load(temp_paths[qname])
        qpixels = list(qimg.pixels)
        for y in range(512):
            src_row = (y * 512) * 4
            dst_row = ((oy + y) * 1024 + ox) * 4
            comp_pixels[dst_row : dst_row + 512 * 4] = qpixels[src_row : src_row + 512 * 4]
        bpy.data.images.remove(qimg)

    comp_img.pixels = comp_pixels
    out_preview = f"{PREVIEW_DIR}/{char_key}.png"
    comp_img.filepath_raw = out_preview
    comp_img.file_format = "PNG"
    comp_img.save()
    bpy.data.images.remove(comp_img)

    cleanup_preview_helpers(helper_col)
    print(f"[PREVIEW] Saved {out_preview}")
    return temp_paths


def render_action_strips(arm_obj, char_key: str):
    scene = bpy.context.scene
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    helper_col, cam_obj, cam_data, bg_node = setup_preview_helpers(scene)
    aim_camera_at(cam_obj, (1.25, -1.45, 1.05), (0.0, 0.0, 0.30))
    cam_data.ortho_scale = 0.72

    clip_frames = [
        ("idle", [0, 12, 24, 36]),
        ("walk", [0, 5, 10, 14]),
        ("talk", [0, 9, 19, 28]),
    ]

    sheet = bpy.data.images.new("action_strips", width=1024, height=768, alpha=True)
    sheet_pixels = [0.0] * (1024 * 768 * 4)

    for row_idx, (cname, frames) in enumerate(clip_frames):
        oy = (2 - row_idx) * 256
        for tr in arm_obj.animation_data.nla_tracks:
            tr.mute = (tr.name != cname)
        for col_idx, f_num in enumerate(frames):
            ox = col_idx * 256
            scene.frame_set(f_num)
            bpy.context.view_layer.update()
            tpath = f"{SOURCE_DIR}/_tmp_act_{cname}_{col_idx}.png"
            scene.render.filepath = tpath
            bpy.ops.render.render(write_still=True)
            timg = bpy.data.images.load(tpath)
            tpix = list(timg.pixels)
            for y in range(256):
                srow = (y * 256) * 4
                drow = ((oy + y) * 1024 + ox) * 4
                sheet_pixels[drow : drow + 256 * 4] = tpix[srow : srow + 256 * 4]
            bpy.data.images.remove(timg)
            os.remove(tpath)

    for tr in arm_obj.animation_data.nla_tracks:
        tr.mute = True
    scene.frame_set(0)
    for pb in arm_obj.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)

    out_path = f"{PREVIEW_DIR}/action-strips.png"
    sheet.pixels = sheet_pixels
    sheet.filepath_raw = out_path
    sheet.file_format = "PNG"
    sheet.save()
    bpy.data.images.remove(sheet)
    cleanup_preview_helpers(helper_col)
    print(f"[PREVIEW] Saved {out_path}")


def stitch_lineup_sheets(all_temp_paths: dict):
    sil_sheet = bpy.data.images.new("silhouette_lineup", width=1024, height=512, alpha=True)
    sil_pixels = [0.04, 0.04, 0.05, 1.0] * (1024 * 512)

    main_four = ["char-a", "char-b", "char-c", "char-d"]
    for idx, key in enumerate(main_four):
        img = bpy.data.images.load(all_temp_paths[key]["sil"])
        img.scale(256, 256)
        pix = list(img.pixels)
        ox = idx * 256
        oy = 256
        for y in range(256):
            srow = (y * 256) * 4
            drow = ((oy + y) * 1024 + ox) * 4
            sil_pixels[drow : drow + 256 * 4] = pix[srow : srow + 256 * 4]
        bpy.data.images.remove(img)

    all_six = ["player", "char-a", "char-b", "char-c", "char-d", "quest-npc"]
    for idx, key in enumerate(all_six):
        img = bpy.data.images.load(all_temp_paths[key]["sil"])
        img.scale(170, 170)
        pix = list(img.pixels)
        ox = idx * 170 + 2
        oy = 43
        for y in range(170):
            srow = (y * 170) * 4
            drow = ((oy + y) * 1024 + ox) * 4
            sil_pixels[drow : drow + 170 * 4] = pix[srow : srow + 170 * 4]
        bpy.data.images.remove(img)

    sil_path = f"{PREVIEW_DIR}/silhouette-lineup.png"
    sil_sheet.pixels = sil_pixels
    sil_sheet.filepath_raw = sil_path
    sil_sheet.file_format = "PNG"
    sil_sheet.save()
    bpy.data.images.remove(sil_sheet)
    print(f"[PREVIEW] Saved {sil_path}")

    turn_sheet = bpy.data.images.new("turnaround_lineup", width=1024, height=512, alpha=True)
    bg_rgba = list(hex_to_linear_rgba("#F5EDE0", 0.72))
    bg_rgba[3] = 1.0
    turn_pixels = bg_rgba * (1024 * 512)

    for r_idx, vname in enumerate(["front", "side", "quarter"]):
        oy = (2 - r_idx) * 170 + 1
        for c_idx, key in enumerate(all_six):
            img = bpy.data.images.load(all_temp_paths[key][vname])
            img.scale(170, 170)
            pix = list(img.pixels)
            ox = c_idx * 170 + 2
            for y in range(170):
                srow = (y * 170) * 4
                drow = ((oy + y) * 1024 + ox) * 4
                turn_pixels[drow : drow + 170 * 4] = pix[srow : srow + 170 * 4]
            bpy.data.images.remove(img)

    turn_path = f"{PREVIEW_DIR}/turnaround-lineup.png"
    turn_sheet.pixels = turn_pixels
    turn_sheet.filepath_raw = turn_path
    turn_sheet.file_format = "PNG"
    turn_sheet.save()
    bpy.data.images.remove(turn_sheet)
    print(f"[PREVIEW] Saved {turn_path}")

    for key, vmap in all_temp_paths.items():
        for vname, tpath in vmap.items():
            if os.path.exists(tpath):
                os.remove(tpath)


def save_combined_blend_file(specs):
    reset_scene()
    for idx, (key, height, builder_fn, sx, sz, hx, _, _, _) in enumerate(specs):
        col = bpy.data.collections.new(key)
        bpy.context.scene.collection.children.link(col)
        parts = builder_fn()
        mesh_obj = join_and_fit_height(parts, key, height)
        arm_obj = create_armature_and_bind(mesh_obj, key, shoulder_x=sx, shoulder_z=sz, hip_x=hx)
        bake_three_actions(arm_obj, key)
        for tr in arm_obj.animation_data.nla_tracks:
            tr.mute = False
        arm_obj.location = (idx * 0.65, 0.0, 0.0)
        for obj in (arm_obj, mesh_obj):
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            col.objects.link(obj)

    blend_path = f"{SOURCE_DIR}/characters.blend"
    bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)
    print(f"[BLEND] Saved {blend_path}")


def main():
    blender_ver = bpy.app.version_string
    print(f"[BLENDER] Running Blender {blender_ver}")
    copy_concepts_to_png()

    specs = [
        ("player", 0.58, build_player_parts, 0.078, 0.295, 0.048, 0.18, 2000, 120),
        ("char-a", 0.60, build_char_a_parts, 0.098, 0.302, 0.054, 0.18, 3000, 180),
        ("char-b", 0.60, build_char_b_parts, 0.082, 0.305, 0.054, 0.18, 3000, 180),
        ("char-c", 0.65, build_char_c_parts, 0.088, 0.315, 0.048, 0.18, 3500, 180),
        ("char-d", 0.60, build_char_d_parts, 0.118, 0.300, 0.058, 0.20, 3000, 180),
        ("quest-npc", 0.56, build_quest_npc_parts, 0.082, 0.285, 0.048, 0.18, 2000, 120),
    ]

    metadata = {
        "version": 1,
        "generator": f"Blender {blender_ver}",
        "assets": {},
    }
    all_temp_paths = {}

    for key, height, builder_fn, sx, sz, hx, col_r, max_tri, max_kib in specs:
        reset_scene()
        parts = builder_fn()
        mesh_obj = join_and_fit_height(parts, key, height)
        bake_ao_into_vertex_color(mesh_obj, key)
        arm_obj = create_armature_and_bind(mesh_obj, key, shoulder_x=sx, shoulder_z=sz, hip_x=hx)
        bake_three_actions(arm_obj, key)
        glb_path = export_character_glb(arm_obj, mesh_obj, key)
        info = inspect_glb(glb_path, mesh_obj, max_tri=max_tri, max_kib=max_kib)
        tpaths = render_character_preview(arm_obj, mesh_obj, key)
        all_temp_paths[key] = tpaths

        if key == "char-a":
            render_action_strips(arm_obj, key)

        entry = {
            "path": f"assets/abraxas/characters/{key}.glb",
            "scale": 1,
            "collision": [{"type": "circle", "x": 0, "z": 0, "radius": col_r}],
            "clips": ["idle", "walk", "talk"],
            "budget": {
                "maxTriangles": max_tri,
                "maxKiB": max_kib,
            },
            "measured": info,
        }
        if key == "quest-npc":
            entry["sharedBy"] = ["s1j2", "s2j2", "s3j2", "s4j2"]
        metadata["assets"][key] = entry

    stitch_lineup_sheets(all_temp_paths)
    save_combined_blend_file(specs)

    meta_path = f"{SOURCE_DIR}/asset-metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"[METADATA] Saved {meta_path}")


if __name__ == "__main__":
    main()
