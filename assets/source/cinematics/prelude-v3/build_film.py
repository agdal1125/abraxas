"""Renders the Abraxas opening film with Blender Cycles.

Run through scripts/render-prelude.mjs. Everything on screen is a pure function of the
film time t, so any frame can be re-rendered alone and two runs give the same picture.
"""
import argparse
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
ASSETS = os.path.join(ROOT, "client", "public")
DURATION = 51.42
FPS = 24

# Key story moments, the cues of the v1 film and its sound mix.
LAND = 7.2
CRACK_HITS = (9.6, 10.9, 11.9)
BURST = 12.6
REVEAL = 21.8 + 4 * 13 * 60 / 132.05
HERO_HEIGHT = 0.58

SEA_LEVEL = -0.2
VILLAGE_ORIGIN = np.array((-6.0, 44.0))
ERRAND_PREFIXES = ("moka-", "or-", "lumi-", "echo-")
SUN_DIRECTION = Vector((0.62, -0.58, 0.56)).normalized()


# ---------------------------------------------------------------- math helpers
def linear(hex_color):
    def channel(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    value = hex_color.lstrip("#")
    return np.array([channel(int(value[i:i + 2], 16) / 255) for i in (0, 2, 4)])


def smooth(edge0, edge1, x):
    u = np.clip((np.asarray(x, dtype=float) - edge0) / (edge1 - edge0), 0, 1)
    return u * u * (3 - 2 * u)


def track(t, keys):
    """Smoothly interpolates scalars or tuples through (time, value) keys."""
    if t <= keys[0][0]:
        return np.asarray(keys[0][1], dtype=float)
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return np.asarray(v0, dtype=float) + (np.asarray(v1, dtype=float) - np.asarray(v0, dtype=float)) * float(smooth(t0, t1, t))
    return np.asarray(keys[-1][1], dtype=float)


def rolling(x, y):
    return (0.16 * np.sin(x * 0.31 + y * 0.17) + 0.11 * np.sin(x * 0.67 - y * 0.41 + 1.3)
            + 0.05 * np.sin(x * 1.9 + y * 1.3 + 2.1) + 0.03 * np.sin(x * 3.7 - y * 2.9))


def patches(x, y):
    return 0.5 + 0.5 * np.sin(x * 0.53 + np.sin(y * 0.41) * 1.7) * np.sin(y * 0.47 + np.sin(x * 0.37) * 1.3)


def path_x(y):
    return np.sin(np.asarray(y, dtype=float) * 0.25) * 1.1


def path_distance(x, y):
    return np.abs(x - path_x(y)) / np.sqrt(1 + (0.275 * np.cos(y * 0.25)) ** 2)


def path_width(y):
    return 0.52 + 0.08 * np.sin(y * 1.7) + 0.05 * np.sin(y * 4.1 + 1)


def hill(x, y):
    shore = y + 2.4 * np.sin(x * 0.23 + 1.1) + 1.1 * np.sin(x * 0.61)
    climb = 4.2 * smooth(1, 14, y) * (1 - smooth(15.5, 24, shore))
    behind = 1.4 * smooth(-7, -26, y)
    sides = 1.5 * smooth(5, 26, np.abs(x)) * (1 - 0.6 * smooth(13, 24, y))
    land = climb + behind + sides
    radius = np.sqrt((x / 40) ** 2 + ((y + 3) / 31) ** 2) + 0.05 * np.sin(np.arctan2(y + 3, x) * 7)
    edge = smooth(0.82, 1.0, radius)
    return land * (1 - edge) - 0.9 * np.maximum(edge, smooth(15.5, 24, shore))


def ground_height(x, y, landed=False):
    near_path = np.exp(-(path_distance(x, y) / 1.5) ** 2)
    height = hill(x, y) + rolling(x, y) * (1 - near_path) * (1 - smooth(16, 22, y))
    height -= 0.025 * smooth(0.9, 0.3, path_distance(x, y))
    if landed:
        distance = np.hypot(x, y)
        height += -0.075 * smooth(0.6, 0.05, distance) + 0.045 * np.exp(-((distance - 0.68) / 0.13) ** 2)
    return height


def ground_at(x, y, t=DURATION):
    return float(ground_height(np.float64(x), np.float64(y), t >= LAND))


# ---------------------------------------------------------------- blender helpers
def make_mesh(name, verts, quads=None, tris=None, colors=None, material=None, collection=None):
    quads = np.zeros((0, 4), dtype=np.int32) if quads is None else np.asarray(quads, dtype=np.int32)
    tris = np.zeros((0, 3), dtype=np.int32) if tris is None else np.asarray(tris, dtype=np.int32)
    mesh = bpy.data.meshes.new(name)
    mesh.vertices.add(len(verts))
    mesh.vertices.foreach_set("co", np.asarray(verts, dtype=np.float32).ravel())
    loops = np.concatenate((quads.ravel(), tris.ravel()))
    mesh.loops.add(len(loops))
    mesh.loops.foreach_set("vertex_index", loops)
    mesh.polygons.add(len(quads) + len(tris))
    starts = np.concatenate((np.arange(len(quads)) * 4, len(quads) * 4 + np.arange(len(tris)) * 3))
    mesh.polygons.foreach_set("loop_start", starts.astype(np.int32))
    mesh.update(calc_edges=True)
    mesh.polygons.foreach_set("use_smooth", np.zeros(len(mesh.polygons), dtype=bool))
    if colors is not None:
        layer = mesh.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
        rgba = np.ones((len(verts), 4), dtype=np.float32)
        rgba[:, :3] = colors
        layer.data.foreach_set("color", rgba.ravel())
    if material:
        mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def vertex_material(name, roughness=0.9, translucent=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    color = nodes.new("ShaderNodeVertexColor")
    color.layer_name = "Color"
    links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
    if translucent:
        through = nodes.new("ShaderNodeBsdfTranslucent")
        links.new(color.outputs["Color"], through.inputs["Color"])
        mix = nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = translucent
        links.new(bsdf.outputs[0], mix.inputs[1])
        links.new(through.outputs[0], mix.inputs[2])
        links.new(mix.outputs[0], nodes["Material Output"].inputs["Surface"])
    return material


def glowing_vertex_material(name, glow):
    """Vertex colours with a little self light so white fur and skin stay white in shadow."""
    material = vertex_material(name, 0.85, 0.0)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes["Principled BSDF"]
    links.new(nodes["Color Attribute"].outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = glow
    return material


def flat_material(name, hex_color, roughness=0.9, emission=None, strength=0.0, specular=0.5):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*linear(hex_color), 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*linear(emission), 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return material


def clear_scene():
    for block in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            block.remove(item)


def ico_template(subdivisions):
    data = bmesh.new()
    bmesh.ops.create_icosphere(data, subdivisions=subdivisions, radius=1.0)
    verts = np.array([v.co[:] for v in data.verts])
    tris = np.array([[v.index for v in f.verts] for f in data.faces])
    data.free()
    return verts, tris


# ---------------------------------------------------------------- game assets
class Kit:
    """Loads each game GLB once; every placement shares its mesh data."""

    def __init__(self):
        with open(os.path.join(ROOT, "content", "assets", "manifest.json"), encoding="utf-8") as handle:
            self.manifest = json.load(handle)["assets"]
        self.loaded = {}

    def parts(self, key):
        if key not in self.loaded:
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, self.manifest[key]["path"]))
            imported = [o for o in bpy.data.objects if o not in before]
            bpy.context.view_layer.update()
            parts = [(o.data, o.matrix_world.copy()) for o in imported if o.type == "MESH"]
            for obj in imported:
                bpy.data.objects.remove(obj)
            self.loaded[key] = parts
        return self.loaded[key]

    def place(self, key, x, y, z, yaw=0.0, scale=1.0, collection=None, tilt=(0.0, 0.0)):
        placed = []
        base = Matrix.Translation((x, y, z)) @ Euler((tilt[0], tilt[1], yaw)).to_matrix().to_4x4() @ Matrix.Scale(scale, 4)
        for mesh, matrix in self.parts(key):
            obj = bpy.data.objects.new(key, mesh)
            obj.matrix_world = base @ matrix
            (collection or bpy.context.scene.collection).objects.link(obj)
            placed.append(obj)
        return placed


# ---------------------------------------------------------------- world
def build_world():
    world = bpy.data.worlds.new("Sky")
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    coords = nodes.new("ShaderNodeTexCoord")
    split = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")
    links.new(coords.outputs["Generated"], split.inputs[0])
    links.new(split.outputs["Z"], ramp.inputs["Fac"])
    stops = ((0.0, "#f6e2ce"), (0.035, "#e9e2da"), (0.13, "#99c6e2"), (0.45, "#4f92d0"), (1.0, "#3573bd"))
    elements = ramp.color_ramp.elements
    while len(elements) < len(stops):
        elements.new(0.5)
    for element, (position, color) in zip(elements, stops):
        element.position = position
        element.color = (*linear(color), 1)
    background = nodes["Background"]
    links.new(ramp.outputs["Color"], background.inputs["Color"])
    background.inputs["Strength"].default_value = 1.6

    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 4.6
    sun.data.color = linear("#ffe6c4")
    sun.data.angle = math.radians(3.5)
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = SUN_DIRECTION.to_track_quat("Z", "Y")
    bpy.context.scene.collection.objects.link(sun)


GRASS_DARK = linear("#3f8f3c")
GRASS_MID = linear("#66b245")
GRASS_LIGHT = linear("#9ad15a")
DIRT_LIGHT = linear("#d2a56c")
DIRT_DARK = linear("#a97743")
SHORE = linear("#d8c48c")


def build_ground():
    xs = np.arange(-42, 42.01, 0.22)
    ys = np.arange(-34, 28.01, 0.22)
    grid_x, grid_y = np.meshgrid(xs, ys)
    x, y = grid_x.ravel(), grid_y.ravel()
    jitter = np.random.default_rng(7)
    x = x + jitter.uniform(-0.07, 0.07, x.shape)
    y = y + jitter.uniform(-0.07, 0.07, y.shape)
    nx = len(xs)
    index = np.arange(grid_x.size).reshape(grid_x.shape)
    quads = np.stack((index[:-1, :-1], index[:-1, 1:], index[1:, 1:], index[1:, :-1]), axis=-1).reshape(-1, 4)

    def colors(landed):
        tint = patches(x, y)[:, None]
        grass = GRASS_DARK * (1 - tint) + GRASS_MID * tint
        ground = grass * 0.82
        distance = path_distance(x, y)
        dirt_noise = 0.5 + 0.5 * np.sin(x * 7.1 + y * 3.3) * np.sin(y * 6.3 - x * 2.1)
        dirt = DIRT_DARK + (DIRT_LIGHT - DIRT_DARK) * dirt_noise[:, None]
        mask = smooth(path_width(y) + 0.1, path_width(y) - 0.1, distance + 0.05 * np.sin(x * 9 + y * 11))
        if landed:
            mask = np.maximum(mask, smooth(0.82, 0.62, np.hypot(x, y)))
        result = ground * (1 - mask[:, None]) + dirt * mask[:, None]
        height = ground_height(x, y)
        sand = smooth(SEA_LEVEL + 0.28, SEA_LEVEL + 0.06, height)[:, None]
        return result * (1 - sand) + SHORE * sand

    def positions(landed):
        return np.stack((x, y, ground_height(x, y, landed)), axis=1)

    obj = make_mesh("Ground", positions(False), quads=quads, colors=colors(False), material=vertex_material("Ground", 0.95))
    states = {landed: (positions(landed).astype(np.float32).ravel(), np.hstack((colors(landed), np.ones((x.size, 1)))).astype(np.float32).ravel()) for landed in (False, True)}
    current = {"landed": None}

    def update(t):
        landed = t >= LAND
        if current["landed"] == landed:
            return
        current["landed"] = landed
        obj.data.vertices.foreach_set("co", states[landed][0])
        obj.data.color_attributes["Color"].data.foreach_set("color", states[landed][1])
        obj.data.update()
    return update


def scatter_grass(name, rng, count, region, height, width, translucent=0.35, hole=None):
    x = rng.uniform(region[0], region[1], count)
    y = rng.uniform(region[2], region[3], count)
    keep = (path_distance(x, y) > path_width(y) + rng.uniform(-0.1, 0.12, count)) & (ground_height(x, y) > SEA_LEVEL + 0.18)
    if hole:
        keep &= ~((x > hole[0]) & (x < hole[1]) & (y > hole[2]) & (y < hole[3]))
    x, y = x[keep], y[keep]
    n = x.size
    z = ground_height(x, y)
    yaw = rng.uniform(0, math.tau, n)
    side = np.stack((np.cos(yaw), np.sin(yaw), np.zeros(n)), axis=1)
    lean_yaw = rng.uniform(0, math.tau, n)
    lean = np.stack((np.cos(lean_yaw), np.sin(lean_yaw), np.zeros(n)), axis=1)
    scale = rng.uniform(0.6, 1.0, n) * (0.75 + 0.5 * patches(x * 2.3, y * 2.3))
    blade = (height * scale)[:, None]
    half = (width * rng.uniform(0.7, 1.2, n))[:, None]
    bend = blade * rng.uniform(0.2, 0.6, n)[:, None]
    root = np.stack((x, y, z - 0.01), axis=1)
    up = np.array((0.0, 0.0, 1.0))
    v0 = root - side * half
    v1 = root + side * half
    v2 = root - side * half * 0.72 + up * blade * 0.55 + lean * bend * 0.35
    v3 = root + side * half * 0.72 + up * blade * 0.55 + lean * bend * 0.35
    v4 = root + up * blade + lean * bend
    verts = np.stack((v0, v1, v3, v2, v4), axis=1).reshape(-1, 3)
    base = np.arange(n) * 5
    quads = np.stack((base, base + 1, base + 2, base + 3), axis=1)
    tris = np.stack((base + 3, base + 2, base + 4), axis=1)

    tint = np.clip(patches(x, y) + rng.normal(0, 0.18, n), 0, 1)[:, None]
    mid = GRASS_DARK * (1 - tint) + GRASS_MID * tint
    tip = GRASS_MID * (1 - tint) + GRASS_LIGHT * tint
    colors = np.stack((mid * 0.5, mid * 0.5, tip * 0.85, tip * 0.85, tip * 1.08), axis=1).reshape(-1, 3)
    obj = make_mesh(name, verts, quads=quads, tris=tris, colors=colors, material=vertex_material(name, 0.75, translucent))
    return obj, verts.astype(np.float32), np.repeat(x, 5), np.repeat(y, 5)


def build_grass(eye):
    rng = np.random.default_rng(21)
    near, rest, x, y = scatter_grass("GrassNear", rng, 260000, (-8.5, 8.5, -7, 18), 0.16, 0.01)
    scatter_grass("GrassFar", rng, 170000, (-42, 42, -34, 28), 0.34, 0.04, translucent=0.2, hole=(-8.3, 8.3, -6.8, 17.8))
    weights = np.tile(np.array((0.0, 0.0, 0.35, 0.35, 1.0), dtype=np.float32), rest.shape[0] // 5)
    phase = (x * 1.3 + y * 0.9 + np.sin(x * 3.1) * 0.8).astype(np.float32)
    crater = np.hypot(x, y) < 0.74
    buffer = rest.copy().reshape(-1, 3)

    def update(t):
        gust = 0.65 + 0.35 * math.sin(t * 0.37)
        sway = np.sin(t * 2.3 + phase) * 0.022 + np.sin(t * 4.1 + phase * 2.1) * 0.008
        offset = sway * weights * gust
        buffer[:] = rest.reshape(-1, 3)
        buffer[:, 0] += offset
        buffer[:, 1] += offset * 0.5
        if t >= LAND:
            buffer[crater, 2] = -1.0
        lens = eye()
        buffer[np.hypot(x - lens.x, y - lens.y) < 0.55, 2] = -1.0
        near.data.vertices.foreach_set("co", buffer.ravel())
        near.data.update()
    return update


def build_flowers(rng):
    palette = [linear(c) for c in ("#ffffff", "#ffd84d", "#ff8fb1", "#b48cff", "#ff6f61")]
    angles = np.linspace(0, math.tau, 5, endpoint=False)
    verts, tris, colors = [], [], []
    offset = 0
    for _ in range(5200):
        x, y = rng.uniform(-9, 9), rng.uniform(-6.5, 17.5)
        if path_distance(x, y) < 0.68 or patches(x * 1.7 + 3, y * 1.7) < 0.58:
            continue
        z = ground_at(x, y)
        height = rng.uniform(0.11, 0.22)
        size = rng.uniform(0.018, 0.034)
        petal = palette[rng.integers(0, 5)] * rng.uniform(0.9, 1.0)
        spin = rng.uniform(0, math.tau)
        lean = rng.uniform(-0.03, 0.03, 2)
        top = np.array((x + lean[0], y + lean[1], z + height))
        ring = np.stack((np.cos(angles + spin), np.sin(angles + spin), rng.uniform(0.01, 0.35, 5)), axis=1) * size
        mid = np.stack((np.cos(angles + spin + 0.63), np.sin(angles + spin + 0.63), np.zeros(5)), axis=1) * size * 0.45
        flower = np.vstack(((top + (0, 0, size * 0.25))[None], top + mid, top + ring))
        stem = np.array(((x - 0.004, y, z), (x + 0.004, y, z), top + (0.003, 0, 0)))
        verts.extend((flower, stem))
        colors.extend((np.vstack((linear("#ffcf3f")[None], np.tile(petal, (10, 1)))), np.tile(linear("#4f9a45"), (3, 1))))
        for k in range(5):
            tris.append((offset + 1 + k, offset + 6 + k, offset + 1 + (k + 1) % 5))
            tris.append((offset, offset + 1 + k, offset + 1 + (k + 1) % 5))
        tris.append((offset + 11, offset + 12, offset + 13))
        offset += 14
    make_mesh("Flowers", np.concatenate(verts), tris=np.array(tris), colors=np.concatenate(colors), material=vertex_material("Flowers", 0.7, 0.2))


def build_scenery(kit):
    rng = np.random.default_rng(33)
    trees = ("tree-layered", "tree-round", "tree-slender", "tree-young")
    hand_placed = [(-3.4, 2.2, 1, 1.9), (-5.2, 4.4, 0, 2.4), (-4.2, 5.4, 2, 2.0), (3.9, -1.2, 0, 2.2), (5.2, 2.4, 1, 2.1),
                   (6.3, 4.8, 0, 2.6), (4.6, 7.5, 2, 1.8), (-6.8, 8.6, 1, 2.3), (-3.2, 10.8, 3, 1.5), (3.4, 11.6, 3, 1.5)]
    for x, y, kind, scale in hand_placed:
        kit.place(trees[kind], x, y, ground_at(x, y) - 0.02, rng.uniform(0, math.tau), scale)
    placed = 0
    while placed < 150:
        x, y = rng.uniform(-38, 38), rng.uniform(-30, 20)
        if abs(x) < 8 or ground_at(x, y) < 0.1:
            continue
        kit.place(trees[rng.integers(0, 4)], x, y, ground_at(x, y) - 0.03, rng.uniform(0, math.tau), rng.uniform(2.0, 3.6))
        placed += 1
    for _ in range(90):
        x, y = rng.uniform(-11, 11), rng.uniform(-8, 16)
        if path_distance(x, y) < 1.1 or np.hypot(x, y) < 2.4:
            continue
        kit.place("bush" if rng.random() < 0.5 else ("rock-large" if rng.random() < 0.35 and y < 9 else "rock-small"), x, y, ground_at(x, y) - 0.02, rng.uniform(0, math.tau), rng.uniform(0.6, 1.3))
    build_flowers(rng)
    for y in np.arange(-7.0, 16.0, 0.98):
        if -3.2 < y < 1.6:
            continue
        x = float(path_x(y)) + 1.34
        slope = 0.275 * math.cos(y * 0.25)
        kit.place("fence", x, float(y), ground_at(x, y) - 0.02, math.pi / 2 - math.atan(slope), 1.25)
    for _ in range(46):
        y = rng.uniform(-6, 15)
        side = rng.choice((-1.0, 1.0))
        x = float(path_x(y)) + side * (float(path_width(y)) + rng.uniform(-0.04, 0.12))
        kit.place("rock-small" if rng.random() < 0.4 else "pebbles", x, y, ground_at(x, y) - 0.01, rng.uniform(0, math.tau), rng.uniform(0.35, 0.8))


def build_clouds():
    rng = np.random.default_rng(55)
    template, tris = ico_template(2)
    material = flat_material("Cloud", "#ffffff", 1.0, "#fff4ea", 0.35, specular=0.0)
    all_verts, all_tris = [], []
    offset = 0
    spots = [(rng.uniform(-70, 70), rng.uniform(-40, 70), rng.uniform(30, 44), rng.uniform(3.5, 7)) for _ in range(20)]
    spots += [(rng.uniform(-150, 150), rng.uniform(90, 170), rng.uniform(14, 44), rng.uniform(9, 20)) for _ in range(20)]
    spots += [(rng.uniform(-22, 22), rng.uniform(-10, 26), rng.uniform(40, 48), rng.uniform(2.0, 3.6)) for _ in range(9)]
    spots += [(rng.uniform(-90, 90), rng.uniform(60, 130), rng.uniform(95, 135), rng.uniform(5, 10)) for _ in range(24)]
    spots = [spot for spot in spots if spot[2] < 60 and math.hypot(spot[0], spot[1]) > 9 or spot[2] >= 60 and abs(spot[0]) > 16]
    # Far enough from the lens that none can sweep across it.
    for height in np.arange(40, 208, 5.0):
        angle, reach = rng.uniform(0, math.tau), rng.uniform(16, 42)
        drift = -6 * (54.4 - math.sqrt(54.4 ** 2 - 14 * height)) / 7
        spots.append((math.cos(angle) * reach, drift + math.sin(angle) * reach, height, rng.uniform(3, 5.5)))
    for cx, cy, cz, size in spots:
        for _ in range(int(rng.integers(6, 11))):
            direction = rng.normal(0, 1, 3) * np.array((1.0, 0.6, 0.22))
            scale = size * rng.uniform(0.4, 0.8)
            stretched = template * np.array((scale, scale * rng.uniform(0.7, 1.0), scale * rng.uniform(0.55, 0.75)))
            stretched[:, 2] = np.maximum(stretched[:, 2], -0.22 * scale)
            stretched = stretched + rng.normal(0, 0.05 * scale, stretched.shape)
            all_verts.append(stretched + np.array((cx, cy, cz)) + direction * size * 0.75)
            all_tris.append(tris + offset)
            offset += len(template)
    clouds = make_mesh("Clouds", np.concatenate(all_verts), tris=np.concatenate(all_tris), material=material)
    clouds.visible_shadow = False


def build_sea():
    x, y = np.meshgrid(np.linspace(-320, 320, 161), np.linspace(-320, 320, 161))
    rng = np.random.default_rng(3)
    z = SEA_LEVEL + rng.uniform(-0.05, 0.05, x.shape)
    verts = np.stack((x.ravel(), y.ravel(), z.ravel()), axis=1)
    index = np.arange(x.size).reshape(x.shape)
    quads = np.stack((index[:-1, :-1], index[:-1, 1:], index[1:, 1:], index[1:, :-1]), axis=-1).reshape(-1, 4)
    make_mesh("Sea", verts, quads=quads, material=flat_material("Sea", "#5cc4c9", 0.32))


def build_village(kit):
    collection = bpy.data.collections.new("Village")
    bpy.context.scene.collection.children.link(collection)
    with open(os.path.join(ROOT, "content", "world", "village.json"), encoding="utf-8") as handle:
        world = json.load(handle)
    placements = [world["terrain"]] + [p for p in world["props"] if not p["id"].startswith(ERRAND_PREFIXES)]
    for item in placements:
        scale = kit.manifest[item["asset"]]["scale"] * item.get("scale", 1)
        kit.place(item["asset"], VILLAGE_ORIGIN[0] + item["x"], VILLAGE_ORIGIN[1] - item["z"], 0.0, item.get("rot", 0.0), scale, collection)
    return collection


def pivot(name, parent, location):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.rotation_mode = "XYZ"
    return obj


# ---------------------------------------------------------------- story timing (the v1 film's flow)
def to_world(f, r):
    """v1's meadow frame: f runs from the crash site up the path, r is sideways off the path."""
    return r + float(path_x(f)), f


def on_ground(f, r, up, t=DURATION):
    x, y = to_world(f, r)
    return Vector((x, y, ground_at(x, y, t) + up))


def mix(a, b, k):
    return a + (b - a) * k


def clamp(x, a=0.0, b=1.0):
    return min(b, max(a, x))


def ease(a, b, x):
    return float(smooth(a, b, x))


BEAT0, BPM = 21.8, 132.05


def bar(n):
    return BEAT0 + 4 * n * 60 / BPM


FIRST_STEP, FLOP, LEAD, SNIFF_START = 38.8, 34.52, 36.34, 25.43
CAP_LAND, STAND, TURN_BACK, DOG_CREST, DOG_RUN = 17.6, 20.5, 23.2, 21.8, 23.8
SKY, HIT, SETTLE, CRACK, POV, SIT, RISE = 4.2, 6.6, 8.0, 10.7, 14.4, 16.4, 19.9
SNIFF_CUT, CIRCLE, WALK = bar(2), bar(5), bar(10)
# Walking on past the cut to the reveal happens further up the path, on the crest above the village.
CREST_SHIFT = 8.0

HERO_PATH = [
    (0, 0, 0, -3, 0.2), (TURN_BACK, 0, 0, -3, 0.2), (24.1, 0, 0, 2, 0.6), (26.6, 0, 0, 1, 0.6), (28.4, 0, 0, 0.1, 1.2), (29.8, 0, 0, -1, 0.4),
    (31.6, 0, 0, -0.3, -1), (33.4, 0, 0, 1, 0), (38.8, 0, 0, 1.9, 0.1), (47.8, 5.45, 0.02, 8, 0.1), (48.3, 5.5, 0.02, 12, 0.1), (51.5, 5.5, 0.02, 14, 0.2)]
DOG_PATH = [
    (0, 6.3, 0.55, 3, 0.5), (DOG_CREST, 6.3, 0.55, 3, 0.5), (22.9, 5.25, 0.5, 3, 0.4), (DOG_RUN, 5.2, 0.5, 0, 0), (SNIFF_START, 0.95, 0.42, 0, 0),
    (27.2, 0.58, 0.72, 0.5, 1.1), (28.3, 0.13, 1.08, 0.08, 1.45), (29.6, 0.13, 1.08, 0.06, 1.45), (30.6, -0.55, 0.45, 0, 0), (31.6, -0.7, -0.3, 0, 0),
    (32.8, 0.1, -0.68, 0, 0), (33.5, 0.86, -0.04, 0, 0), (LEAD, 0.86, 0, 0, 0), (37.5, 1.9, 0.08, 3, 0.1), (37.9, 1.9, 0.08, 0, 0),
    (FIRST_STEP + 0.9, 1.9, 0.08, 0, 0), (41.2, 2.2, 0.3, 6, 0.3), (47.8, 5.95, 0.32, 8, 0.32), (48.5, 5.95, 0.32, 5.5, 0), (49.3, 5.95, 0.32, 5.5, 0), (50, 5.95, 0.32, 12, 0.3), (51.5, 5.95, 0.32, 12, 0.3)]


def row_at(rows, t):
    if t <= rows[0][0]:
        return rows[0][1:]
    for a, b in zip(rows, rows[1:]):
        if t < b[0]:
            k = ease(a[0], b[0], t)
            straight = a[0] >= 41 or (a[0] >= FIRST_STEP and rows is HERO_PATH)
            u = clamp((t - a[0]) / (b[0] - a[0])) if straight else k
            return mix(a[1], b[1], u), mix(a[2], b[2], u), mix(a[3], b[3], k), mix(a[4], b[4], k)
    return rows[-1][1:]


def actor_place(rows, t):
    """World position and the heading that faces the aim point, for the rows of one actor."""
    f, r, aim_f, aim_r = row_at(rows, t)
    shift = CREST_SHIFT if t >= REVEAL else 0.0
    x, y = to_world(f + shift, r)
    ax, ay = to_world(aim_f + shift, aim_r)
    return x, y, ax - x, ay - y


def distance_table(rows, dt=1 / 48, end=52.0):
    steps = int(end / dt) + 1
    table = np.zeros(steps)
    pf, pr = row_at(rows, 0)[:2]
    for i in range(1, steps):
        f, r = row_at(rows, i * dt)[:2]
        table[i] = table[i - 1] + math.hypot(f - pf, r - pr)
        pf, pr = f, r
    return lambda t: float(np.interp(t, np.arange(steps) * dt, table))


DOG_DISTANCE = distance_table(DOG_PATH)


# A plain free fall: constant acceleration, so the egg is at its fastest as it lands.
FALL_START_SPEED, GRAVITY = 4.0, 7.0


def fall_speed(t):
    return FALL_START_SPEED + GRAVITY * t


def egg_fall(t):
    left = max(0.0, LAND - t)
    return fall_speed(LAND) * left - GRAVITY * left * left / 2, 6 * left


def egg_bottom(t):
    height, _ = egg_fall(t)
    since = t - LAND
    sink = 0.13 * ease(0, 0.25, since) if since >= 0 else 0.0
    return ground_at(0, 0, LAND) + height - sink


# ---------------------------------------------------------------- hero
def game_axis(ax, ay, az):
    """A direction in the game model's frame, in Blender armature space."""
    return Vector((ax, -az, ay))


class Hero:
    def __init__(self):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, "assets/abraxas/characters/player.glb"))
        imported = [o for o in bpy.data.objects if o.type and o not in before]
        self.rig = next(o for o in imported if o.type == "ARMATURE")
        self.meshes = [o for o in imported if o.type == "MESH" and len(o.data.color_attributes)]
        for obj in imported:
            if obj.type == "MESH" and obj not in self.meshes:
                bpy.data.objects.remove(obj)
        skin = glowing_vertex_material("HeroSkin", 0.08)
        self.caps = []
        for obj in list(self.meshes):
            cap = self.split_cap(obj)
            for part in (obj, cap):
                self.whiten(part.data)
                part.data.color_attributes[0].name = "Color"
                part.data.materials[0] = skin
            self.caps.append(cap)
        self.body_meshes = self.meshes
        self.build_flying_cap()
        self.clips = {}
        for action in bpy.data.actions:
            bag = action.layers[0].strips[0].channelbag(action.slots[0])
            channels = {}
            for curve in bag.fcurves:
                channels.setdefault(curve.data_path, {})[curve.array_index] = curve
            self.clips[action.name] = channels
        self.rig.animation_data_clear()
        self.rig.rotation_mode = "XYZ"
        for bone in self.rig.pose.bones:
            bone.rotation_mode = "QUATERNION"

    @staticmethod
    def split_cap(obj):
        """The eggshell cap is the part of the model painted in the colour of its topmost vertex."""
        mesh = obj.data
        layer = mesh.color_attributes[0]
        raw = np.zeros(len(layer.data) * 4, dtype=np.float32)
        layer.data.foreach_get("color", raw)
        rgba = raw.reshape(-1, 4)
        count = len(mesh.vertices)
        if layer.domain == "CORNER":
            per_vertex = np.zeros((count, 4), dtype=np.float32)
            indices = np.zeros(len(mesh.loops), dtype=np.int32)
            mesh.loops.foreach_get("vertex_index", indices)
            per_vertex[indices] = rgba
            rgba = per_vertex
        heights = np.zeros(count * 3, dtype=np.float32)
        mesh.vertices.foreach_get("co", heights)
        # Model space here is Blender's after import: z is up.
        z = heights.reshape(-1, 3)[:, 2]
        top = int(np.argmax(z))
        # The belly shares the cap's colour, so only the head counts.
        is_cap = (np.abs(rgba[:, :3] - rgba[top, :3]).sum(axis=1) < 0.09) & (z > z.min() + 0.6 * (z.max() - z.min()))

        cap = obj.copy()
        cap.data = mesh.copy()
        cap.name = "HeroCap"
        for collection in obj.users_collection:
            collection.objects.link(cap)
        for target, keep_cap in ((mesh, False), (cap.data, True)):
            data = bmesh.new()
            data.from_mesh(target)
            data.verts.ensure_lookup_table()
            drop = [face for face in data.faces if all(is_cap[v.index] for v in face.verts) != keep_cap]
            bmesh.ops.delete(data, geom=drop, context="FACES_ONLY")
            data.to_mesh(target)
            data.free()
        return cap

    def build_flying_cap(self):
        """A rigid copy of the cap in its bind pose: the last piece of shell, falling onto the head."""
        all_verts, all_tris = [], []
        offset = 0
        for cap in self.caps:
            mesh = cap.data
            mesh.calc_loop_triangles()
            count = len(mesh.vertices)
            co = np.zeros(count * 3, dtype=np.float32)
            mesh.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)
            matrix = np.array(cap.matrix_local)
            co = co @ matrix[:3, :3].T + matrix[:3, 3]
            tris = np.array([tri.vertices[:] for tri in mesh.loop_triangles], dtype=np.int32)
            all_verts.append(co)
            all_tris.append(tris + offset)
            offset += count
        verts = np.concatenate(all_verts)
        used = np.unique(np.concatenate(all_tris))
        self.cap_center = Vector(verts[used].mean(axis=0).tolist())
        self.flying = make_mesh("HeroCapFlying", verts - np.array(self.cap_center), tris=np.concatenate(all_tris), material=flat_material("CapFlying", "#fbf6ec", 0.8))
        self.flying.rotation_mode = "XYZ"

    @staticmethod
    def whiten(mesh):
        layer = mesh.color_attributes[0]
        raw = np.zeros(len(layer.data) * 4, dtype=np.float32)
        layer.data.foreach_get("color", raw)
        rgba = raw.reshape(-1, 4)
        # Same formula as whitenPlayer in client/src/scenes/demi.ts, keeps the model's shading.
        shade = 0.72 + 0.27 * (rgba[:, 0] * 0.2126 + rgba[:, 1] * 0.7152 + rgba[:, 2] * 0.0722)
        rgba[:, 0], rgba[:, 1], rgba[:, 2] = shade, shade * 0.985, shade * 0.99
        layer.data.foreach_set("color", rgba.ravel())

    def sample(self, clip, frame):
        return {path: [curves[i].evaluate(frame) for i in sorted(curves)] for path, curves in self.clips[clip].items()}

    def base_pose(self, t, walking):
        idle = self.sample("idle", (t * FPS) % 48)
        walk = self.sample("walk", (t * FPS) % 19)
        for path in set(idle) | set(walk):
            a = idle.get(path)
            b = walk.get(path, a)
            a = a if a is not None else b
            bone = self.rig.pose.bones[path.split('"')[1]]
            if path.endswith("rotation_quaternion"):
                bone.rotation_quaternion = Quaternion(a).slerp(Quaternion(b), walking)
            elif path.endswith("location"):
                bone.location = [mix(x, y, walking) for x, y in zip(a, b)]

    def turn(self, name, axis, angle):
        """Rotates a bone about a direction given in the model's own frame, as the v1 film did."""
        if not angle:
            return
        bone = self.rig.pose.bones[name]
        rest = bone.bone.matrix_local.to_quaternion()
        spin = Quaternion(game_axis(*axis), angle)
        bone.rotation_quaternion = (rest.inverted() @ spin @ rest) @ bone.rotation_quaternion

    def update(self, t):
        x, y, dx, dy = actor_place(HERO_PATH, t)
        heading = math.atan2(dx, -dy)
        visible = t >= BURST and not POV <= t < SIT and not FLOP <= t < LEAD
        self.rig.hide_render = not visible
        for obj in self.body_meshes:
            obj.hide_render = not visible
        for cap in self.caps:
            cap.hide_render = not visible or t < CAP_LAND

        sit = 1 - ease(STAND, STAND + 0.85, t)
        drop = -0.135 * sit + (math.sin(sit * math.pi) * 0.015 if 0 < sit < 1 else 0.0)
        ground = ground_at(x, y, t)
        self.rig.location = (x, y, ground + drop)
        self.rig.rotation_euler = (0, 0, heading)

        flying = 15.5 <= t < CAP_LAND
        self.flying.hide_render = not flying
        if flying:
            k = clamp((t - 15.5) / (CAP_LAND - 15.5))
            center = Matrix.Rotation(heading, 4, "Z") @ self.cap_center
            self.flying.location = (x + center.x + (1 - k) * 0.4, y + center.y - (1 - k) * 0.25, ground + drop + center.z + 2.6 * (1 - k * k))
            self.flying.rotation_euler = ((1 - k) * 8, (1 - k) * 5, heading)

        if not visible:
            return
        walking = ease(FIRST_STEP - 0.1, FIRST_STEP + 0.25, t) * (1 - ease(47.8, 48.3, t))
        self.base_pose(t, walking)

        for leg, side in (("leg_l", 1), ("leg_r", -1)):
            self.turn(leg, (1, 0, 0), -1.35 * sit)
            self.turn(leg, (0, 0, 1), side * 0.2 * sit)
        land = clamp(t - CAP_LAND)
        bump = math.exp(-land * 7) * math.sin(land * 18) * 0.24 if t >= CAP_LAND else 0.0
        wake = float(track(t, [(BURST, 0.95), (15.8, 0.95), (16.9, 0.1), (CAP_LAND, 0.08), (CAP_LAND + 0.12, 0.22), (18.1, 0), (19.9, 0), (20.4, 0.5), (STAND + 0.5, 0.18), (STAND + 1.1, 0)]))
        self.turn("body", (1, 0, 0), 0.22 * wake + 0.05 * sit)
        look = float(track(t, [(17.9, 0), (18.25, 0.44), (18.95, 0.44), (19.3, -0.44), (19.85, -0.44), (20.15, 0), (DOG_RUN, 0), (24.5, 0.22), (26.5, 0.22), (28.6, -0.24), (31, 0.24), (33.4, 0), (38.9, 0), (39.4, 0)]))
        pitch = float(track(t, [(BURST, 0.5), (15.8, 0.5), (16.9, 0.05), (19.9, 0.05), (20.3, 0.55), (STAND, 0.5), (STAND + 0.8, 0), (24.6, 0), (26.5, 0.35), (33.4, 0.38), (36.4, 0.5), (37.6, -0.04), (38.7, 0.05), (40, 0)]))
        yaw = float(track(t, [(19.9, 0), (20.2, 0), (STAND + 1, 0), (21.7, 0.55), (22.3, -0.55), (22.9, 0), (23.2, 0), (TURN_BACK + 0.25, -0.6), (TURN_BACK + 0.8, 0)]))
        self.turn("head", (0, 0, 1), look + math.sin(t * 2.1) * 0.012)
        self.turn("head", (1, 0, 0), pitch + bump)
        self.turn("head", (0, 1, 0), yaw)
        hands = float(track(t, [(19.9, 0), (20.3, 1), (STAND, 1), (STAND + 0.4, 0), (31.8, 0), (32.4, 0.65), (33.3, 0.65), (33.7, 0)]))
        shrug = float(track(t, [(18.1, 0), (18.4, 0.34), (19.7, 0.34), (19.95, 0)])) * (1 - hands)
        for arm, side in (("arm_l", 1), ("arm_r", -1)):
            self.turn(arm, (1, 0, 0), -1.25 * hands + 0.12 * sit)
            self.turn(arm, (0, 0, 1), side * (0.25 * hands + shrug))


# ---------------------------------------------------------------- dog
# The model is authored with +x forward, +y up. model_to_blender maps that onto +y forward, +z up.
def model_to_blender(points):
    return np.asarray(points, dtype=float)[..., [2, 0, 1]]


def dog_hash(a, b, seed):
    value = math.sin(a * 127.1 + b * 311.7 + seed * 53.3) * 43758.5453
    return value - math.floor(value)


def loft(rings, n=6, side=(0.0, 0.0, 1.0), jitter=0.05, seed=1):
    """Skins n-sided rings into big flat facets. Rings twist half a step so quads fold like paper."""
    centers = [np.array(r[:3], dtype=float) for r in rings]
    side = np.array(side, dtype=float)
    grid = []
    for i, ring in enumerate(rings):
        tangent = centers[min(i + 1, len(rings) - 1)] - centers[max(i - 1, 0)]
        tangent /= np.linalg.norm(tangent)
        u = side - tangent * side.dot(tangent)
        u /= np.linalg.norm(u)
        v = np.cross(tangent, u)
        row = []
        for k in range(n):
            angle = (k + (i % 2) * 0.5) / n * math.tau
            grow = 1 + (dog_hash(i, k, seed) - 0.5) * 2 * jitter
            row.append(centers[i] + u * math.cos(angle) * ring[3] * grow + v * math.sin(angle) * ring[4] * grow)
        grid.append(row)
    triangles = []

    def tri(a, b, c):
        triangles.append((a, c, b))

    for i in range(len(grid) - 1):
        for k in range(n):
            a, b = grid[i][k], grid[i][(k + 1) % n]
            c, d = grid[i + 1][k], grid[i + 1][(k + 1) % n]
            if i % 2 == 0:
                tri(a, c, b)
                tri(b, c, d)
            else:
                tri(a, c, d)
                tri(a, d, b)
    for k in range(n):
        tri(centers[0], grid[0][k], grid[0][(k + 1) % n])
        tri(centers[-1], grid[-1][(k + 1) % n], grid[-1][k])
    return np.array(triangles)


def triangle_mesh(name, triangles, material, parent):
    verts = model_to_blender(triangles).reshape(-1, 3)
    obj = make_mesh(name, verts, tris=np.arange(len(verts)).reshape(-1, 3), material=material)
    obj.parent = parent
    return obj


DOG_SCALE = 0.43


class Dog:
    def __init__(self):
        white = flat_material("DogWhite", "#f6f3ec", 0.82, "#ffffff", 0.06, specular=0.25)
        black = flat_material("DogBlack", "#141216", 0.5, specular=0.2)
        pink = flat_material("DogPink", "#f08aa2", 0.7)
        dark = flat_material("DogMouth", "#5a2a36", 0.9)
        self.seed = 1

        def part(name, parent, rings, material=white, **options):
            triangles = loft(rings, seed=self.seed, **options)
            self.seed += 1
            return triangle_mesh(name, triangles, material, parent)

        self.root = pivot("Dog", None, (0, 0, 0))
        self.rig = pivot("DogRig", self.root, (0, 0, 0))
        self.rig.scale = (DOG_SCALE, DOG_SCALE, DOG_SCALE)
        self.body = pivot("DogBody", self.rig, model_to_blender((0, 0.335, 0)).tolist())
        part("DogTrunk", self.body, [(-0.36, 0.03, 0, 0.06, 0.07), (-0.29, 0.02, 0, 0.18, 0.19), (-0.1, 0.02, 0, 0.205, 0.205),
                                     (0.09, 0.035, 0, 0.21, 0.225), (0.235, 0.05, 0, 0.165, 0.2), (0.3, 0.06, 0, 0.05, 0.08)], n=6)
        part("DogNeck", self.body, [(0.12, 0.08, 0, 0.11, 0.11), (0.2, 0.2, 0, 0.145, 0.125), (0.26, 0.29, 0, 0.1, 0.09)], n=6, jitter=0.03)

        def leg(x, z, hind):
            hip = pivot("DogLeg", self.body, model_to_blender((x, -0.03, z)).tolist())
            top = 0.135 if hind else 0.1
            part("DogLegPart", hip, [(0, 0.09, 0, top * 0.7, top * 0.8), (0, 0.0, 0, top, top * 1.15), (0, -0.14, 0, 0.082, 0.085),
                                     (0, -0.25, 0, 0.074, 0.078), (0, -0.3, 0, 0.03, 0.03)], n=5, side=(1.0, 0.0, 0.0))
            part("DogPaw", hip, [(-0.06, -0.272, 0, 0.055, 0.03), (0.0, -0.272, 0, 0.09, 0.04), (0.08, -0.282, 0, 0.074, 0.028), (0.12, -0.288, 0, 0.022, 0.012)], n=5, jitter=0.03)
            return hip

        self.legs = {"fl": leg(0.18, 0.1, False), "fr": leg(0.18, -0.1, False), "bl": leg(-0.24, 0.115, True), "br": leg(-0.24, -0.115, True)}

        self.tail = pivot("DogTail", self.body, model_to_blender((-0.32, 0.12, 0)).tolist())
        part("DogTailPlume", self.tail, [(0.02, -0.03, 0, 0.04, 0.04), (-0.05, 0.08, 0, 0.075, 0.08), (-0.04, 0.22, 0, 0.1, 0.1), (0.06, 0.28, 0, 0.075, 0.08), (0.14, 0.22, 0, 0.03, 0.03)], n=5)

        self.head = pivot("DogHead", self.body, model_to_blender((0.27, 0.235, 0)).tolist())
        self.head.rotation_mode = "YXZ"
        skull_triangles = loft([(-0.2, 0.13, 0, 0.09, 0.09), (-0.14, 0.13, 0, 0.19, 0.185), (0.0, 0.14, 0, 0.245, 0.225), (0.13, 0.12, 0, 0.225, 0.2),
                                (0.2, 0.065, 0, 0.125, 0.105), (0.28, 0.05, 0, 0.09, 0.07), (0.325, 0.05, 0, 0.04, 0.034)], n=8, jitter=0.035, seed=self.seed)
        self.seed += 1
        triangle_mesh("DogSkull", skull_triangles, white, self.head)
        tree = BVHTree.FromPolygons([tuple(v) for v in skull_triangles.reshape(-1, 3)], [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(len(skull_triangles))], all_triangles=True)

        self.eyes = []
        for sign in (1, -1):
            direction = Vector((0.86, 0.17, 0.4 * sign)).normalized()
            point, normal, _, _ = tree.ray_cast(Vector((0, 0.1, 0)) + direction * 2, -direction)
            self.eyes.append(self.eye(point, normal, sign * 0.28, black))

        nose_verts = []
        for radius, height in ((0.04, 0.018), (0.024, -0.018)):
            for k in range(5):
                angle = k / 5 * math.tau
                nose_verts.append((radius * math.sin(angle), height, radius * math.cos(angle) * 0.95))
        spin = np.array(Matrix.Rotation(-1.25, 3, "Z"))
        nose_verts = np.array(nose_verts) @ spin.T
        nose_tris = [(5 + k, 5 + (k + 1) % 5, k) for k in range(5)] + [(k, 5 + (k + 1) % 5, (k + 1) % 5) for k in range(5)] + [(0, k, k + 1) for k in range(1, 4)] + [(5, 5 + k + 1, 5 + k) for k in range(1, 4)]
        self.nose = make_mesh("DogNose", model_to_blender(nose_verts), tris=np.array(nose_tris), material=black)
        self.nose.parent = self.head
        self.nose.location = model_to_blender((0.312, 0.074, 0)).tolist()

        self.jaw = pivot("DogJaw", self.head, model_to_blender((0.2, 0, 0)).tolist())
        part("DogChin", self.jaw, [(-0.03, 0, 0, 0.09, 0.03), (0.05, -0.005, 0, 0.082, 0.035), (0.11, -0.005, 0, 0.05, 0.02)], n=5, jitter=0.02)
        part("DogMouth", self.jaw, [(0.02, 0.022, 0, 0.066, 0.016), (0.095, 0.018, 0, 0.042, 0.012)], material=dark, n=5, jitter=0.0)
        part("DogTongue", self.jaw, [(0.05, 0.03, 0, 0.042, 0.014), (0.1, 0.024, 0, 0.05, 0.016), (0.135, 0.0, 0, 0.034, 0.012)], material=pink, n=5, jitter=0.0)

        self.ears = []
        for sign in (1, -1):
            ear = pivot("DogEar", self.head, model_to_blender((-0.01, 0.275, 0.165 * sign)).tolist())
            part("DogEarFlap", ear, [(0, 0.015, 0.01 * sign, 0.05, 0.03), (0, -0.05, 0.055 * sign, 0.115, 0.055), (0.005, -0.17, 0.075 * sign, 0.12, 0.055), (0.015, -0.27, 0.07 * sign, 0.065, 0.03)],
                 n=5, side=(1.0, 0.0, 0.0), jitter=0.06)
            self.ears.append((ear, sign))

    def eye(self, point, normal, turn, material):
        ring = []
        for k in range(6):
            angle = k / 6 * math.tau
            ring.append(Vector((0.03 * 0.92 * math.cos(angle), 0.03 * 1.12 * math.sin(angle), 0.0)))
        align = normal.to_track_quat("Z", "Y") @ Quaternion((0, 0, 1), turn)
        points = [align @ p for p in ring]
        verts = np.array([p.to_tuple() for p in points])
        obj = make_mesh("DogEye", model_to_blender(verts), tris=np.array([(0, k + 1, k) for k in range(1, 5)]), material=material)
        # The polygon must face outward after the axis change, which keeps handedness.
        obj.parent = self.head
        obj.location = model_to_blender(np.array((point + normal * 0.004).to_tuple())).tolist()
        return obj

    def update(self, t):
        visible = t >= DOG_CREST - 0.1
        for obj in [self.root, *self.root.children_recursive]:
            obj.hide_render = not visible
        if not visible:
            return
        x, y, dx, dy = actor_place(DOG_PATH, t)
        self.root.location = (x, y, ground_at(x, y, t))
        self.root.rotation_euler = (0, 0, math.atan2(-dx, dy))

        distance = DOG_DISTANCE(t)
        speed = (DOG_DISTANCE(t + 0.08) - DOG_DISTANCE(t - 0.08)) / 0.16
        phase = distance / 0.17 * math.tau
        amp = clamp(speed * 1.05)
        flop = ease(FLOP + 0.05, FLOP + 0.55, t) * (1 - ease(LEAD - 0.12, LEAD + 0.2, t))
        sniffing = float(track(t, [(SNIFF_START - 0.3, 0), (SNIFF_START, 1), (FLOP - 0.8, 1), (FLOP - 0.5, 0)]))
        pulse = max(0.0, math.sin(t * 15.5)) ** 2
        shard = float(track(t, [(28.05, 0), (28.35, 1), (29.5, 1), (29.8, 0)]))
        stop_tilt = float(track(t, [(22.95, 0), (23.25, 1), (23.8, 1), (24, 0)]))
        look_back = float(track(t, [(37.45, 0), (37.8, 1), (FIRST_STEP + 0.1, 1), (FIRST_STEP + 0.55, 0)]))
        bark = math.sin((t - 38.05) / 0.4 * math.pi) if 38.05 < t < 38.45 else 0.0
        reach = float(track(t, [(33.3, 0), (33.55, 1), (FLOP, 1), (FLOP + 0.3, 0)]))

        bob = abs(math.sin(phase)) * 0.016 * amp
        self.rig.location = (0, 0, bob + bark * 0.075 - 0.083 * flop)
        self.rig.rotation_euler = (-(math.sin(phase * 2) * 0.012 * amp - reach * 0.05 - 0.015 * flop), 0, 0)

        swing = math.sin(phase) * 0.72 * amp
        for name, sign, out in (("fl", 1, 1.36), ("br", 1, -1.05), ("fr", -1, 1.28), ("bl", -1, -1.05)):
            self.legs[name].rotation_euler = (mix(sign * swing, out, flop), 0, 0)

        breath = math.sin(t * 2.7) * 0.01
        pitch = 0.08 + 0.38 * sniffing + 0.14 * shard + 0.12 * pulse * sniffing - 0.55 * reach + breath - 0.17 * flop + 0.05 * amp * math.sin(phase * 2)
        tilt = stop_tilt * 0.46 + flop * 0.05 + reach * 0.18 + look_back * math.sin(t * 1.4) * 0.12
        turn = math.sin(t * 2.9) * 0.3 * sniffing + look_back * 0.08 + flop * 0.02
        rest = model_to_blender((0.27 + 0.012 * sniffing / DOG_SCALE, 0.235 + (0.022 * reach - 0.012 * sniffing) / DOG_SCALE, 0))
        self.head.location = rest.tolist()
        self.head.rotation_euler = (-pitch, tilt, turn)
        grow = 1 + 0.09 * pulse * sniffing
        self.nose.scale = (grow, grow, grow)

        pant = (0.06 + 0.05 * math.sin(t * 9)) * clamp(amp + flop)
        self.jaw.rotation_euler = (-0.62 * bark - pant, 0, 0)
        for ear, sign in self.ears:
            lag = math.sin(phase - 0.6) * 0.15 * amp + math.sin(t * 3 + sign) * 0.018 - pitch * 0.34
            ear.rotation_euler = (-lag, -sign * (0.06 + bark * 0.32 + stop_tilt * 0.08), 0)
        happy = float(track(t, [(21.5, 0.4), (DOG_RUN, 0.45), (25.5, 1), (30, 0.72), (33, 1), (LEAD, 1), (37.8, 0.75), (38.8, 1)]))
        self.tail.rotation_euler = (-0.5 * flop, math.sin(t * mix(8, 17, happy)) * 0.42 * happy, 0)
        inhale = 1 + math.sin(t * (9 if sniffing > 0.5 else 3)) * 0.012
        self.body.scale = (inhale, 1, inhale)
        blink = 0.2 if math.sin(t * 0.86 + 1.3) > 0.992 or math.sin(t * 1.33) > 0.996 else 1.0
        for eye in self.eyes:
            eye.scale = (1, 1, blink)


# ---------------------------------------------------------------- egg
EGG_HEIGHT = 1.25
EGG_RADIUS = 0.46


def egg_shape(directions):
    points = directions * np.array((EGG_RADIUS, EGG_RADIUS, EGG_HEIGHT / 2))
    points[:, 0] *= 1 - 0.2 * directions[:, 2]
    points[:, 1] *= 1 - 0.2 * directions[:, 2]
    return points


def slow_clock(x):
    """The shards hang in the light, then fall at full speed."""
    return x * 0.28 if x < 1.1 else 0.308 + (x - 1.1) * mix(0.28, 1.0, ease(1.1, 2.4, x))


class Egg:
    def __init__(self):
        rng = np.random.default_rng(101)
        directions, tris = ico_template(3)
        directions = directions + rng.normal(0, 0.012, directions.shape)
        directions /= np.linalg.norm(directions, axis=1, keepdims=True)
        points = egg_shape(directions)
        count = 52
        golden = math.pi * (3 - math.sqrt(5))
        seeds = []
        for i in range(count):
            z = 1 - 2 * (i + 0.5) / count
            ring = math.sqrt(1 - z * z)
            seeds.append((math.cos(golden * i) * ring, math.sin(golden * i) * ring, z))
        seeds = np.array(seeds) + rng.normal(0, 0.09, (count, 3))
        centers = directions[tris].mean(axis=1)
        owner = np.argmin(((centers[:, None, :] - seeds[None, :, :]) ** 2).sum(axis=2), axis=1)

        material = vertex_material("Eggshell", 0.82)
        material.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.2
        self.root = pivot("Egg", None, (0, 0, 0))
        self.pieces = []
        cream, speck, inner = linear("#f8eedf"), linear("#f0dcc6"), linear("#f6e2bd")
        front = np.array((-0.25, -1.0, 0.05))
        front /= np.linalg.norm(front)
        for index in range(count):
            faces = tris[owner == index]
            if not len(faces):
                continue
            middle = points[np.unique(faces)].mean(axis=0)
            outer = points[faces] - middle
            inward = outer - points[faces] * 0.032
            verts, quads, triangles, colors = [], [], [], []
            edges = {}
            for face in faces:
                for a, b in ((0, 1), (1, 2), (2, 0)):
                    key = tuple(sorted((face[a], face[b])))
                    edges[key] = edges.get(key, 0) + 1
            for number, face in enumerate(faces):
                base = len(verts)
                tone = speck if rng.random() < 0.14 else cream * rng.uniform(0.95, 1.0)
                verts.extend(outer[number])
                colors.extend([tone] * 3)
                triangles.append((base, base + 1, base + 2))
                verts.extend(inward[number])
                colors.extend([inner] * 3)
                triangles.append((base + 5, base + 4, base + 3))
                for a, b in ((0, 1), (1, 2), (2, 0)):
                    if edges[tuple(sorted((face[a], face[b])))] == 1:
                        quads.append((base + a, base + 3 + a, base + 3 + b, base + b))
            obj = make_mesh(f"Shard{index}", np.array(verts), quads=np.array(quads, dtype=np.int32).reshape(-1, 4), tris=np.array(triangles), colors=np.array(colors), material=material)
            obj.rotation_mode = "QUATERNION"
            normal = middle / max(np.linalg.norm(middle), 1e-6)
            angle = rng.uniform(0, math.tau)
            high = middle[2] > -0.15
            distance = rng.uniform(0.8, 1.6) if high else rng.uniform(0.42, 0.72)
            away = normal[:2] / max(np.linalg.norm(normal[:2]), 1e-3)
            away = away * 0.75 + np.array((math.cos(angle), math.sin(angle))) * 0.35
            away /= np.linalg.norm(away)
            target = away * distance
            if target[1] > 0 and abs(target[0]) < 0.42:
                target[0] = math.copysign(0.42 + rng.uniform(0, 0.1), target[0])
            if target[0] < -0.72 and -0.3 < target[1] < 0.8:
                target[1] -= 1.0
            landed_up = 1.0 if rng.random() < 0.65 else -1.0
            align = Vector(normal.tolist()).rotation_difference(Vector((0, 0, landed_up)))
            finish = Euler((rng.uniform(-0.28, 0.28), rng.uniform(-0.28, 0.28), rng.uniform(0, math.tau))).to_quaternion() @ align
            self.pieces.append(dict(obj=obj, rest=middle, normal=normal, target=target, finish=finish,
                                    duration=rng.uniform(0.65, 1.15) if high else rng.uniform(0.32, 0.55),
                                    height=rng.uniform(0.75, 1.55) if high else rng.uniform(0.12, 0.3),
                                    spin=Vector(rng.normal(0, 1, 3).tolist()).normalized(), spins=rng.uniform(1.5, 3.5) * (1 if rng.random() < 0.5 else -1),
                                    order=float(np.dot(normal, front))))
        ranked = sorted(self.pieces, key=lambda p: -p["order"])
        stages = (10, 22, 38)
        for rank, piece in enumerate(ranked):
            stage = next((i for i, limit in enumerate(stages) if rank < limit), None)
            piece["crack"] = CRACK_HITS[stage] if stage is not None else None

        glow = flat_material("EggGlow", "#fff0b8", 0.5, "#ffe9a6", 9.0)
        self.core = make_mesh("EggCore", egg_shape(directions) * 0.9, tris=tris, material=glow)
        self.core.parent = self.root
        self.light = bpy.data.objects.new("EggLight", bpy.data.lights.new("EggLight", "POINT"))
        self.light.data.color = linear("#ffe2a0")
        self.light.data.shadow_soft_size = 0.12
        bpy.context.scene.collection.objects.link(self.light)
        self.build_beam()

    def build_beam(self):
        rows = 18
        u = np.linspace(0, math.tau, rows, endpoint=False)
        verts = np.array([(radius * math.cos(a), radius * math.sin(a), z) for radius, z in ((0.3, 0.0), (1.3, 46.0)) for a in u])
        quads = np.array([(i, (i + 1) % rows, rows + (i + 1) % rows, rows + i) for i in range(rows)])
        material = bpy.data.materials.new("Beam")
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        nodes.clear()
        out = nodes.new("ShaderNodeOutputMaterial")
        blend_node = nodes.new("ShaderNodeMixShader")
        emit = nodes.new("ShaderNodeEmission")
        emit.inputs["Color"].default_value = (*linear("#fff4cf"), 1)
        emit.inputs["Strength"].default_value = 2.2
        clear = nodes.new("ShaderNodeBsdfTransparent")
        coords = nodes.new("ShaderNodeTexCoord")
        split = nodes.new("ShaderNodeSeparateXYZ")
        ramp = nodes.new("ShaderNodeValToRGB")
        links.new(coords.outputs["Generated"], split.inputs[0])
        links.new(split.outputs["Z"], ramp.inputs["Fac"])
        ramp.color_ramp.elements[0].color = (0.5, 0.5, 0.5, 1)
        ramp.color_ramp.elements[1].position = 0.8
        ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
        facing = nodes.new("ShaderNodeLayerWeight")
        facing.inputs["Blend"].default_value = 0.5
        soft = nodes.new("ShaderNodeMath")
        soft.operation = "POWER"
        soft.inputs[1].default_value = 3.0
        invert = nodes.new("ShaderNodeMath")
        invert.operation = "SUBTRACT"
        invert.inputs[0].default_value = 1.0
        links.new(facing.outputs["Facing"], invert.inputs[1])
        links.new(invert.outputs[0], soft.inputs[0])
        strength = nodes.new("ShaderNodeMath")
        strength.operation = "MULTIPLY"
        links.new(soft.outputs[0], strength.inputs[0])
        links.new(ramp.outputs["Color"], strength.inputs[1])
        links.new(strength.outputs[0], blend_node.inputs[0])
        links.new(clear.outputs[0], blend_node.inputs[1])
        links.new(emit.outputs[0], blend_node.inputs[2])
        links.new(blend_node.outputs[0], out.inputs["Surface"])
        self.beam = make_mesh("Beam", verts, quads=quads, material=material)
        self.beam.rotation_mode = "QUATERNION"

    def update(self, t):
        since = t - LAND
        bottom = egg_bottom(t)
        _, drift = egg_fall(t)
        squash = math.exp(-since * 5) * math.cos(since * 14) * 0.34 if since >= 0 else 0.0

        def wobble(when, size):
            return math.exp(-(t - when) * 3.2) * math.sin((t - when) * 15) * size if t >= when else 0.0

        rock = wobble(CRACK_HITS[0], 0.09) + wobble(CRACK_HITS[1], 0.12) + wobble(CRACK_HITS[2], 0.17)
        lean = 0.24 * ease(0, 0.5, since) + math.exp(-since * 3) * math.sin(since * 9) * 0.08 if since >= 0 else 0.0
        self.root.location = (0, -drift, bottom + EGG_HEIGHT / 2 * (1 - squash))
        if since < 0:
            self.root.rotation_euler = (0.5 + t * 0.26, -0.3 + t * 0.14, t * 0.33)
        else:
            self.root.rotation_euler = (lean * 0.5, -lean + rock, 0)
        self.root.scale = (1 + squash * 0.7, 1 + squash * 0.7, 1 - squash)
        root_matrix = Matrix.Translation(self.root.location) @ self.root.rotation_euler.to_matrix().to_4x4() @ Matrix.Diagonal((*self.root.scale, 1))
        ground = ground_at(0, 0, LAND)
        for piece in self.pieces:
            obj, rest, normal = piece["obj"], piece["rest"], piece["normal"]
            if t < BURST:
                opening = 0.0
                if piece["crack"] is not None and t >= piece["crack"]:
                    opening = 0.007 + 0.016 * ease(piece["crack"], BURST, t)
                obj.location = root_matrix @ Vector((rest + normal * opening).tolist())
                obj.rotation_quaternion = self.root.rotation_euler.to_quaternion()
                obj.scale = self.root.scale
                continue
            obj.scale = (1, 1, 1)
            age = slow_clock(t - BURST)
            start = np.array((rest[0], rest[1], rest[2] + ground + EGG_HEIGHT / 2))
            target = piece["target"]
            final_z = ground_at(target[0], target[1], t) + 0.03
            if age < piece["duration"]:
                u = age / piece["duration"]
                xy = start[:2] + (target - start[:2]) * u
                z = start[2] + (final_z - start[2]) * u + 4 * piece["height"] * u * (1 - u)
                rotation = Quaternion(piece["spin"], piece["spins"] * math.tau * u).slerp(piece["finish"], u ** 2)
            else:
                settle = age - piece["duration"]
                xy = target
                z = final_z + 0.05 * max(0.0, math.sin(min(settle, 0.22) / 0.22 * math.pi))
                rotation = piece["finish"]
            obj.location = (float(xy[0]), float(xy[1]), float(z))
            obj.rotation_quaternion = rotation
        self.core.hide_render = t >= BURST + 0.04 or t < CRACK_HITS[0]
        pulse = sum(math.exp(-(t - hit) * 4) for hit in CRACK_HITS if hit <= t < BURST)
        glow = (6 + 30 * pulse + 120 * ease(CRACK_HITS[1], BURST, t)) if CRACK_HITS[0] <= t < BURST else 0.0
        flash = 900 * math.exp(-(t - BURST) * 5.5) if t >= BURST else 0.0
        self.light.data.energy = glow * 0.25 + flash
        self.light.location = (0, 0, ground + 0.5)
        self.light.hide_render = self.light.data.energy < 0.05
        self.beam.hide_render = since >= 0
        if since < 0:
            trail = Vector((0, -6, fall_speed(t))).normalized()
            self.beam.location = Vector(self.root.location) + trail * (EGG_HEIGHT * 0.62)
            self.beam.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(trail)


class Dust:
    """Dirt clods and low-poly dust thrown up by the landing."""

    def __init__(self):
        rng = np.random.default_rng(44)
        template, tris = ico_template(1)
        puff_mesh = make_mesh("DustPuff", template, tris=tris, material=flat_material("Dust", "#ead8ba", 1.0, specular=0.1))
        clod_mesh = make_mesh("DustClod", template, tris=tris, material=flat_material("Clod", "#a06f42", 1.0, specular=0.1))
        self.bits = []
        for i in range(36):
            is_puff = i < 14
            source = puff_mesh if is_puff else clod_mesh
            obj = bpy.data.objects.new("Dust", source.data)
            bpy.context.scene.collection.objects.link(obj)
            angle = rng.uniform(0, math.tau)
            self.bits.append(dict(obj=obj, is_puff=is_puff, dir=(math.cos(angle), math.sin(angle)),
                                  reach=rng.uniform(0.45, 1.35) if is_puff else rng.uniform(0.5, 1.9),
                                  rise=rng.uniform(0.05, 0.35) if is_puff else rng.uniform(0.35, 1.0),
                                  size=rng.uniform(0.03, 0.075) if is_puff else rng.uniform(0.012, 0.035),
                                  life=rng.uniform(0.55, 0.95) if is_puff else rng.uniform(0.45, 0.8)))
        puff_mesh.hide_render = True
        clod_mesh.hide_render = True

    def update(self, t):
        age = t - LAND
        for bit in self.bits:
            obj = bit["obj"]
            if age < 0 or age >= bit["life"]:
                obj.hide_render = True
                continue
            obj.hide_render = False
            u = age / bit["life"]
            eased = 1 - (1 - u) ** 3
            x = bit["dir"][0] * bit["reach"] * eased
            y = bit["dir"][1] * bit["reach"] * eased
            if bit["is_puff"]:
                z = 0.05 + bit["rise"] * eased
                size = bit["size"] * (0.5 + 1.3 * eased) * (1 - u ** 2)
            else:
                z = 0.03 + 4 * bit["rise"] * u * (1 - u)
                size = bit["size"]
            obj.location = (x, y, z + ground_at(x, y, t))
            obj.scale = (size, size, size * 0.85)


class Birds:
    """A small flock that breaks from the trees as the egg comes down."""

    COUNT = 26
    START, END = 5.05, 6.7

    def __init__(self):
        rng = np.random.default_rng(4)
        self.seeds = [dict(angle=rng.uniform(0, math.tau), speed=rng.uniform(3.4, 6.8), height=rng.uniform(0, 2.2), flap=rng.uniform(12, 18),
                           home=to_world(rng.uniform(-6, -3), rng.uniform(-4, -1))) for _ in range(self.COUNT)]
        tris = np.arange(self.COUNT * 6).reshape(-1, 3)
        self.obj = make_mesh("Birds", np.zeros((self.COUNT * 6, 3)), tris=tris, material=flat_material("Bird", "#fff7ee", 1.0, specular=0.1))

    def update(self, t):
        visible = self.START <= t < self.END
        self.obj.hide_render = not visible
        if not visible:
            return
        k = t - self.START
        verts = []
        for i, bird in enumerate(self.seeds):
            travel = bird["speed"] * k
            cx, sx = math.cos(bird["angle"]), math.sin(bird["angle"])
            center = np.array((bird["home"][0] + cx * travel, bird["home"][1] + sx * travel, ground_at(*bird["home"]) + 1.1 + bird["height"] + travel * 0.55))
            ahead = np.array((cx, sx, 0.0))
            wing = np.array((-sx, cx, 0.0))
            lift = math.sin(t * bird["flap"] + i) * 0.1
            nose, tail = center + ahead * 0.12, center - ahead * 0.09
            verts += [nose, tail, center + wing * 0.2 + (0, 0, lift), nose, center - wing * 0.2 + (0, 0, lift), tail]
        self.obj.data.vertices.foreach_set("co", np.array(verts, dtype=np.float32).ravel())
        self.obj.data.update()


class Fader:
    """A plane right in front of the lens for the white flashes."""

    def __init__(self, camera):
        material = bpy.data.materials.new("Fader")
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        nodes.clear()
        out = nodes.new("ShaderNodeOutputMaterial")
        self.mix = nodes.new("ShaderNodeMixShader")
        emit = nodes.new("ShaderNodeEmission")
        emit.inputs["Color"].default_value = (1, 1, 1, 1)
        emit.inputs["Strength"].default_value = 9.0
        clear = nodes.new("ShaderNodeBsdfTransparent")
        links.new(clear.outputs[0], self.mix.inputs[1])
        links.new(emit.outputs[0], self.mix.inputs[2])
        links.new(self.mix.outputs[0], out.inputs["Surface"])
        verts = np.array(((-2.0, -2.0, -0.15), (2.0, -2.0, -0.15), (2.0, 2.0, -0.15), (-2.0, 2.0, -0.15)))
        self.plane = make_mesh("Fader", verts, quads=np.array(((0, 1, 2, 3),)), material=material)
        self.plane.parent = camera
        for attr in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_shadow", "visible_volume_scatter"):
            setattr(self.plane, attr, False)

    def update(self, t):
        amount = 0.0
        if LAND <= t < LAND + 0.16:
            amount = 0.42 * (1 - (t - LAND) / 0.16)
        elif BURST <= t < POV:
            amount = max(0.8 * (1 - clamp((t - BURST) / 0.22)), clamp((t - (POV - 0.35)) / 0.35))
        elif POV <= t < POV + 0.35:
            amount = 1 - (t - POV) / 0.35
        self.mix.inputs[0].default_value = amount
        self.plane.hide_render = amount <= 0.001


class Eyelids:
    """The hero's own lids over the waking shot: warm skin light, two blinks, then the clear sky."""

    COLUMNS = 40
    DEPTH = 0.16
    HALF_HEIGHT = DEPTH * math.tan(math.radians(29))
    HALF_WIDTH = HALF_HEIGHT * 16 / 9 * 1.1

    def __init__(self, camera):
        material = bpy.data.materials.new("Lids")
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        nodes.clear()
        out = nodes.new("ShaderNodeOutputMaterial")
        blend_node = nodes.new("ShaderNodeMixShader")
        emit = nodes.new("ShaderNodeEmission")
        emit.inputs["Color"].default_value = (*linear("#f6dcc6"), 1)
        emit.inputs["Strength"].default_value = 2.6
        clear = nodes.new("ShaderNodeBsdfTransparent")
        mask = nodes.new("ShaderNodeVertexColor")
        mask.layer_name = "Color"
        links.new(mask.outputs["Color"], blend_node.inputs[0])
        links.new(clear.outputs[0], blend_node.inputs[1])
        links.new(emit.outputs[0], blend_node.inputs[2])
        links.new(blend_node.outputs[0], out.inputs["Surface"])
        columns = self.COLUMNS
        self.x = np.linspace(-1, 1, columns)
        rows = 3
        index = np.arange(columns * rows * 2).reshape(2, rows, columns)
        quads = []
        for lid in index:
            quads.append(np.stack((lid[:-1, :-1], lid[:-1, 1:], lid[1:, 1:], lid[1:, :-1]), axis=-1).reshape(-1, 4))
        alpha = np.tile(np.array((1.0, 1.0, 0.0))[:, None], (2, 1, columns)).reshape(-1, 1)
        self.obj = make_mesh("Lids", np.zeros((index.size, 3)), quads=np.concatenate(quads), colors=np.repeat(alpha, 3, axis=1), material=material)
        self.obj.parent = camera
        for attr in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_shadow", "visible_volume_scatter"):
            setattr(self.obj, attr, False)

    def update(self, t):
        visible = POV <= t < SIT
        self.obj.hide_render = not visible
        if not visible:
            return
        u = t - POV
        opening = float(smooth(0, 1, clamp((u - 0.1) / 0.7)))
        blink = math.sin((u - 1.02) / 0.24 * math.pi) * 0.55 if 1.02 < u < 1.26 else 0.0
        lid = max(0.0, opening - blink)
        lid = (1 - lid) * 0.72
        s = (self.x + 1) / 2
        drop = lid * (0.62 * ((1 - s) ** 2 + s ** 2) + 1.25 * 2 * s * (1 - s)) * 2 * self.HALF_HEIGHT
        band = 0.09 * self.HALF_HEIGHT * 2
        verts = []
        for sign in (1, -1):
            edge = self.HALF_HEIGHT - drop
            for y in (np.full_like(edge, self.HALF_HEIGHT * 1.1), edge + band, edge - band):
                verts.append(np.stack((self.x * self.HALF_WIDTH, sign * y, np.full_like(edge, -self.DEPTH)), axis=1))
        self.obj.data.vertices.foreach_set("co", np.concatenate(verts).astype(np.float32).ravel())
        self.obj.data.update()


# ---------------------------------------------------------------- shots (the v1 film's cameras)
def lens_from_fov(vertical_degrees):
    horizontal = 2 * math.atan(math.tan(math.radians(vertical_degrees) / 2) * 16 / 9)
    return 18 / math.tan(horizontal / 2)


def shake(t, when, size, life=0.75):
    k = t - when
    if k < 0 or k > life:
        return Vector((0, 0, 0))
    a = (1 - k / life) ** 2 * size
    return Vector((math.sin(k * 79) * a, math.sin(k * 63 + 1) * a * 0.75, math.sin(k * 71 + 2) * a))


def view(eye, look, fov, focus=None, fstop=0.0):
    return dict(eye=eye, look=look, fov=fov, focus=focus, fstop=fstop)


def dog_row(t):
    return row_at(DOG_PATH, t)


def hero_row(t):
    return row_at(HERO_PATH, t)


def egg_position(t):
    _, drift = egg_fall(t)
    return Vector((0, -drift, egg_bottom(t) + EGG_HEIGHT / 2))


def shot_fall(t):
    k = ease(0, SKY, t)
    distance = mix(1.22, 7.4, 1 - (1 - t / SKY) ** 2.6)
    a, up = mix(0.72, 1.55, k), mix(-0.1, -1.7, k)
    egg = egg_position(t)
    return view(egg + Vector((math.cos(a) * distance, math.sin(a) * distance, -distance * mix(0.5, 0.62, k))), egg + Vector((0, 0, mix(-0.02, 0.1, k))), mix(30, 34, k))


def shot_sky(t):
    eye, egg = on_ground(-27, 1.5, 0.5, t), egg_position(t)
    look = on_ground(0, 0, 0, t)
    look.z = max(egg.z * 0.82, eye.z + 1.6)
    return view(eye, look.lerp(egg, 0.25), 38)


def shot_hit(t):
    # The camera starts further back and follows the egg down, so it is seen all the way in.
    rest = on_ground(0, 0, 0.62, t)
    egg = egg_position(t)
    look = Vector((egg.x * 0.5, rest.y + (egg.y - rest.y) * 0.5, max(rest.z, egg.z - 0.2)))
    k = ease(HIT, LAND, t)
    eye = on_ground(mix(-9.0, -3.1, k), -1.05, mix(0.7, 0.2, k), t)
    return view(eye + shake(t, LAND, 0.1), look, 38)


def shot_settle(t):
    k = ease(SETTLE, CRACK, t)
    eye = on_ground(mix(-3.5, -2.55, k), mix(0.74, 0.5, k), mix(0.56, 0.48, k), t) + shake(t, CRACK_HITS[0], 0.012, 0.5)
    return view(eye, on_ground(0, 0, 0.53, t), 30, mix(3.5, 2.6, k), 7.0)


def shot_crack(t):
    k = ease(CRACK, BURST, t)
    eye = on_ground(mix(-1.38, -1.2, k), mix(0.42, 0.34, k), 0.76, t) + shake(t, CRACK_HITS[2], 0.02, 0.5)
    return view(eye, on_ground(-0.42, 0.12, 0.76, t), 34, 0.82, 7.0)


def shot_burst(t):
    k = ease(BURST, POV, t)
    eye = on_ground(mix(-2.7, -3.25, k), mix(0.75, 0.95, k), mix(0.6, 0.72, k), t) + shake(t, BURST, 0.05, 0.5)
    return view(eye, on_ground(0, 0, mix(0.7, 0.92, k), t), 42)


def shot_pov(t):
    k = ease(POV, SIT, t)
    u = (t - POV) / (SIT - POV)
    return view(on_ground(0, 0, 0.4, t), on_ground(mix(-1.1, -1.8, k), mix(0.2, -0.32, k), mix(4.8, 1.6, k), t), 58, 0.15 + 12 * float(smooth(0.2, 0.8, u)) ** 2, 0.18)


def shot_sit(t):
    k = ease(SIT, RISE, t)
    a, d = mix(-0.42, 0.28, k), mix(1.66, 1.4, k)
    return view(on_ground(-math.cos(a) * d, math.sin(a) * d, 0.3, t), on_ground(0, 0, 0.31, t), 30, d, 7.0)


def shot_rise(t):
    k = ease(RISE, DOG_CREST, t)
    return view(on_ground(mix(-2.1, -2.3, k), -0.62, mix(0.42, 0.38, k), t), on_ground(0, 0, mix(0.28, 0.34, k), t), 28, 2.2, 7.0)


def shot_crest(t):
    run = ease(24.2, 26, t)
    return view(on_ground(-2.5, 0.14, 0.36, t), on_ground(mix(3.2, 1.6, run), 0.28, mix(0.75, 0.28, run), t), mix(17, 25, run), mix(8, 3, run), 8.0)


def shot_nose(t):
    f, r = dog_row(t)[:2]
    k = ease(26, 30, t)
    eye, look = on_ground(f + mix(-0.5, -0.32, k), r + mix(0.58, 0.45, k), 0.15, t), on_ground(f + 0.1, r + 0.02, 0.22, t)
    return view(eye, look, 34, (look - eye).length - 0.05, 7.0)


def shot_circle(t):
    k = ease(30, 34, t)
    a, d = mix(2.7, 0.2, k), mix(1.65, 1.26, k)
    return view(on_ground(math.cos(a) * d, math.sin(a) * d, 0.33, t), on_ground(0, 0, 0.3, t), 33, d, 7.0)


def shot_photo(t):
    k = ease(34, 36.2, t)
    f, r = dog_row(t)[:2]
    eye, look = on_ground(f - mix(1.02, 0.84, k), r + 0.02, 0.2, t), on_ground(f + 0.03, r, 0.13, t)
    return view(eye, look, 30, (look - eye).length - 0.02, 7.0)


def shot_lead(t):
    k = ease(36.2, 39.8, t)
    hf = hero_row(t)[0]
    df, dr = dog_row(t)[:2]
    eye, target = on_ground(hf - 1.0, -0.42, 0.34, t), on_ground(df, dr, 0.2, t)
    return view(eye, on_ground(mix(0.9, df, 0.76), dr * 0.5, mix(0.25, 0.2, k), t), mix(33, 28, k), (target - eye).length, 8.0)


def shot_walk(t):
    hf, hr = hero_row(t)[:2]
    mid = (hf + dog_row(t)[0]) / 2
    eye, look = on_ground(mid - 0.25, hr - 2.75, 0.46, t), on_ground(mid + 0.1, hr, 0.24, t)
    return view(eye, look, 26, (look - eye).length, 8.0)


def shot_reveal(t):
    x, y, _, _ = actor_place(HERO_PATH, t)
    hero = Vector((x, y, ground_at(x, y, t)))
    k = ease(REVEAL + 0.4, REVEAL + 4.6, t)
    eye = (hero + Vector((0.3, -1.05, 0.28))).lerp(hero + Vector((0.7, -6.0, 2.0)), k)
    look = (hero + Vector((0, 1.0, 0.55))).lerp(Vector((-1.0, 34, 3.4)), ease(REVEAL + 0.4, REVEAL + 4.2, t))
    return view(eye, look, 26)


SHOTS = [(SKY, shot_fall), (HIT, shot_sky), (SETTLE, shot_hit), (CRACK, shot_settle), (BURST, shot_crack), (POV, shot_burst), (SIT, shot_pov),
         (RISE, shot_sit), (DOG_CREST, shot_rise), (SNIFF_CUT, shot_crest), (CIRCLE, shot_nose), (FLOP, shot_circle), (LEAD, shot_photo),
         (WALK, shot_lead), (REVEAL, shot_walk), (DURATION + 1, shot_reveal)]


def build_camera():
    camera = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera.rotation_mode = "QUATERNION"
    camera.data.clip_start = 0.02
    camera.data.clip_end = 1500
    camera.data.sensor_width = 36

    def update(t):
        shot = next(function for end, function in SHOTS if t < end)(t)
        eye = shot["eye"].copy()
        if t >= SKY:
            eye.z = max(eye.z, ground_at(eye.x, eye.y, t) + 0.1)
        camera.location = eye
        camera.rotation_quaternion = (shot["look"] - eye).to_track_quat("-Z", "Y")
        camera.data.lens = lens_from_fov(shot["fov"])
        camera.data.dof.use_dof = shot["fstop"] > 0
        if shot["fstop"] > 0:
            camera.data.dof.aperture_fstop = shot["fstop"]
            camera.data.dof.focus_distance = max(shot["focus"], 0.05)
    return camera, update


# ---------------------------------------------------------------- render setup
def setup_render(args):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = "OPTIX"
    preferences.get_devices()
    for device in preferences.devices:
        device.use = device.type == "OPTIX"
    scene.cycles.device = "GPU"
    scene.cycles.samples = args.samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPTIX"
    scene.cycles.seed = 11
    scene.cycles.max_bounces = 5
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 2
    scene.cycles.volume_bounces = 0
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.render.use_persistent_data = True
    scene.render.resolution_x = args.width
    scene.render.resolution_y = round(args.width * 9 / 16)
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    scene.view_settings.exposure = 0.38


def render_frames(args, updaters):
    scene = bpy.context.scene
    args.out = os.path.abspath(args.out)
    os.makedirs(args.out, exist_ok=True)
    times = [float(v) for v in args.t.split(",")] if args.t else [i / args.fps for i in range(args.start, math.ceil(DURATION * args.fps) if args.end is None else args.end)]
    for number, t in enumerate(times):
        for update in updaters:
            update(t)
        name = f"t{int(round(t * 1000)):05d}" if args.t else f"{int(round(t * args.fps)):04d}"
        scene.render.filepath = os.path.join(args.out, name + ".png")
        bpy.ops.render.render(write_still=True)
        print(f"FILM frame {number + 1}/{len(times)} t={t:.3f}", flush=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--t", default="")
    parser.add_argument("--out", required=True)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--fps", type=int, default=FPS)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=None)
    args = parser.parse_args(argv)

    clear_scene()
    kit = Kit()
    build_world()
    setup_render(args)
    update_ground = build_ground()
    build_scenery(kit)
    build_clouds()
    build_sea()
    village = build_village(kit)

    hero = Hero()
    dog = Dog()
    egg = Egg()
    dust = Dust()
    birds = Birds()
    camera, update_camera = build_camera()
    update_grass = build_grass(lambda: camera.location)
    fader = Fader(camera)
    lids = Eyelids(camera)

    def update_visibility(t):
        village.hide_render = t < REVEAL
        for child in village.objects:
            child.hide_render = t < REVEAL

    # Actors first: the cameras read where they are.
    updaters = [update_ground, update_visibility, hero.update, dog.update, egg.update, dust.update, birds.update, update_camera, update_grass, fader.update, lids.update]
    render_frames(args, updaters)


if __name__ == "__main__":
    main()
