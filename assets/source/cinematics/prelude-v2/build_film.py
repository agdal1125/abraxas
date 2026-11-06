"""Renders the Abraxas opening film with Blender Cycles.

Run through scripts/render-prelude.mjs. Everything on screen is a pure function of the
film time t, so any frame can be re-rendered alone and two runs give the same picture.
"""
import argparse
import json
import math
import os
import sys
from dataclasses import dataclass
from typing import Callable

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
ASSETS = os.path.join(ROOT, "client", "public")
DURATION = 51.42
FPS = 24

# Key story moments, measured from the existing sound mix.
LAND = 7.7
CRACK_HITS = (9.64, 10.25, 10.9, 11.16, 11.6)
BURST = 11.9
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
        buffer[np.hypot(x - lens.x, y - lens.y) < (1.15 if 28 <= t < 34.5 else 0.5), 2] = -1.0
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
                   (6.3, 4.8, 0, 2.6), (4.6, 7.5, 2, 1.8), (-6.8, 8.6, 1, 2.3), (-3.2, 10.8, 3, 1.5), (3.4, 11.6, 3, 1.5),
                   (-3.1, -3.4, 0, 2.2), (-4.8, -5.5, 1, 2.0)]
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
    make_mesh("Clouds", np.concatenate(all_verts), tris=np.concatenate(all_tris), material=material)


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


# ---------------------------------------------------------------- story timing
def hero_y(t):
    if t >= 46:
        return float(track(t, [(46, 12.7), (49, 13.45)]))
    return float(track(t, [(38.2, 0.0), (46, 3.9)]))


def hero_state(t):
    y = hero_y(t)
    walking = 38.4 <= t < 48.8
    if t < 21.8:
        heading = float(track(t, [(16.8, 0.0), (17.9, 1.15), (18.7, 1.15), (19.9, -1.2), (20.7, -1.2), (21.6, 0.0)]))
    elif t >= 38:
        heading = -math.atan(0.275 * math.cos(y * 0.25))
    else:
        heading = 0.0
    head_yaw = float(track(t, [(16.8, 0.0), (17.9, 0.4), (18.7, 0.4), (19.9, -0.4), (20.7, -0.4), (21.6, 0.0)])) if t < 22 else 0.0
    head_pitch = float(track(t, [(21.8, 0.0), (22.3, 0.08), (27.2, 0.1), (28.2, 0.42), (30.4, 0.36), (31, -0.1), (34, -0.05), (34.6, 0.0), (47, 0.0), (48.2, 0.08)]))
    head_roll = float(track(t, [(30.4, 0.0), (31, 0.26), (33.4, 0.22), (34.2, 0.0)])) + (0.05 * math.sin(t * 15) if 30.8 < t < 33.4 else 0.0)
    joy = float(track(t, [(30.6, 0.0), (31.2, 1.0), (33.5, 1.0), (34.2, 0.0)]))
    hop = max(0.0, math.sin((t - BURST - 0.1) * 6)) * 0.05 if BURST + 0.1 < t < BURST + 0.62 else 0.0
    return dict(x=float(path_x(y)), y=y, heading=heading, walking=walking, head_yaw=head_yaw, head_pitch=head_pitch, head_roll=head_roll, joy=joy, hop=hop)


def dog_state(t):
    if t < 34.5:
        y = float(track(t, [(21.8, 8.0), (27.3, 0.66), (28.2, 0.66), (30, 0.45), (30.6, 0.28), (33.5, 0.28), (34.2, 0.48)]))
        heading = math.pi
    elif t < 38.6:
        y = float(track(t, [(35.1, 0.48), (36.8, 1.65)]))
        heading = float(track(t, [(34.5, math.pi), (35.2, 0.0), (37.0, 0.0), (37.6, 2.4), (38.3, 2.4)]))
    elif t < 46:
        y = float(track(t, [(38.6, 1.65), (46, 4.9)]))
        heading = float(track(t, [(38.6, 2.4), (39.2, 0.0)]))
    else:
        y = float(track(t, [(46, 13.02), (48.9, 13.72)]))
        heading = float(track(t, [(48.9, 0.0), (49.6, -0.2)]))
    moving = 21.8 <= t < 27.3 or 35.1 <= t < 36.8 or 38.7 <= t < 48.9
    x = float(path_x(y)) + (0.3 if t >= 46 else 0.0)
    return dict(x=x, y=y, heading=heading, moving=moving, speed=15.0 if t < 27.3 else 10.0,
                rear=float(track(t, [(30, 0.0), (30.7, 1.0), (33.3, 1.0), (34, 0.0)])),
                sniff=float(track(t, [(27.4, 0.0), (28, 1.0), (30, 1.0), (30.5, 0.0)])),
                wag=1.0 if t >= 26 else 0.45,
                tongue=30.5 < t < 33.4 or t > 49, visible=t >= 21.8)


# ---------------------------------------------------------------- hero
class Hero:
    def __init__(self):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, "assets/abraxas/characters/player.glb"))
        imported = [o for o in bpy.data.objects if o not in before]
        self.rig = next(o for o in imported if o.type == "ARMATURE")
        self.meshes = [o for o in imported if o.type == "MESH" and len(o.data.color_attributes)]
        for obj in imported:
            if obj.type == "MESH" and obj not in self.meshes:
                bpy.data.objects.remove(obj)
        skin = glowing_vertex_material("HeroSkin", 0.08)
        for obj in self.meshes:
            self.whiten(obj.data)
            obj.data.color_attributes[0].name = "Color"
            obj.data.materials[0] = skin
        self.clips = {}
        for action in bpy.data.actions:
            bag = action.layers[0].strips[0].channelbag(action.slots[0])
            channels = {}
            for curve in bag.fcurves:
                channels.setdefault(curve.data_path, {})[curve.array_index] = curve
            self.clips[action.name] = channels
        self.rig.animation_data_clear()
        self.rig.rotation_mode = "XYZ"

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

    def update(self, t):
        state = hero_state(t)
        visible = t >= BURST and not 14.0 <= t < 16.4
        self.rig.hide_render = not visible
        for obj in self.meshes:
            obj.hide_render = not visible
        self.rig.location = (state["x"], state["y"], ground_at(state["x"], state["y"], t) + state["hop"])
        self.rig.rotation_euler = (0, 0, state["heading"] + math.pi)
        frame = (t * FPS) % 19 if state["walking"] else (t * FPS) % 48
        for path, values in self.sample("walk" if state["walking"] else "idle", frame).items():
            bone = self.rig.pose.bones[path.split('"')[1]]
            if path.endswith("rotation_quaternion"):
                bone.rotation_quaternion = values
            elif path.endswith("location"):
                bone.location = values
        head = self.rig.pose.bones["head"]
        head.rotation_quaternion = Quaternion(head.rotation_quaternion) @ Euler((state["head_pitch"], state["head_yaw"], state["head_roll"]), "YXZ").to_quaternion()
        if state["joy"]:
            for name, sign in (("arm_l", 1), ("arm_r", -1)):
                bone = self.rig.pose.bones[name]
                bone.rotation_quaternion = Quaternion(bone.rotation_quaternion) @ Euler((0, 0, sign * state["joy"] * (1.15 + 0.2 * math.sin(t * 13))), "XYZ").to_quaternion()


# ---------------------------------------------------------------- dog
FUR = linear("#ffffff")
FUR_SHADE = linear("#fff3e4")


SPIKE_VERTS = np.array(((0.7, 0.0, 0.0), (0.0, 0.7, 0.0), (-0.7, 0.0, 0.0), (0.0, -0.7, 0.0), (0.0, 0.0, 1.0)))
SPIKE_TRIS = np.array(((0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (2, 1, 0), (0, 3, 2)))


def add_fur(name, parent, center, radii, count, length, material, seed, flow=(0.0, -0.3, -0.8)):
    """Coats an ellipsoid in long tapered spikes that hang along the flow direction."""
    rng = np.random.default_rng(seed)
    golden = math.pi * (3 - math.sqrt(5))
    index = np.arange(count)
    z = 1 - 2 * (index + 0.5) / count
    ring = np.sqrt(1 - z * z)
    normals = np.stack((np.cos(golden * index) * ring, np.sin(golden * index) * ring, z), axis=1) + rng.normal(0, 0.1, (count, 3))
    normals /= np.linalg.norm(normals, axis=1, keepdims=True)
    roots = np.array(center) + normals * np.array(radii) * 0.86
    axes = normals * 0.62 + np.array(flow) + rng.normal(0, 0.16, (count, 3))
    axes /= np.linalg.norm(axes, axis=1, keepdims=True)
    helper = np.tile((0.31, 0.87, 0.38), (count, 1))
    side = np.cross(axes, helper)
    side /= np.linalg.norm(side, axis=1, keepdims=True)
    other = np.cross(axes, side)
    span = length * 0.72 * rng.uniform(0.7, 1.2, count)
    width = span * 0.55
    verts = np.empty((count * 5, 3))
    for k, (a, b, c) in enumerate(SPIKE_VERTS):
        verts[k::5] = roots + side * (a * width)[:, None] + other * (b * width)[:, None] + axes * (c * span)[:, None]
    tris = (SPIKE_TRIS[None, :, :] + (index * 5)[:, None, None]).reshape(-1, 3)
    tone = (FUR_SHADE + (FUR - FUR_SHADE) * rng.uniform(0.3, 1.0, count)[:, None])
    colors = np.repeat(tone, 5, axis=0)
    colors[4::5] = np.minimum(colors[4::5] * 1.05, 1.0)
    core, core_tris = ico_template(2)
    all_verts = np.vstack((verts, core * np.array(radii) * 0.97 + np.array(center)))
    all_tris = np.vstack((tris, core_tris + count * 5))
    all_colors = np.vstack((colors, np.tile(FUR_SHADE, (len(core), 1))))
    obj = make_mesh(name, all_verts, tris=all_tris, colors=all_colors, material=material)
    obj.parent = parent
    return obj


def smooth_ball(name, parent, center, radii, material):
    template, tris = ico_template(3)
    obj = make_mesh(name, template * np.array(radii) + np.array(center), tris=tris, material=material)
    obj.data.polygons.foreach_set("use_smooth", np.ones(len(tris), dtype=bool))
    obj.data.update()
    obj.parent = parent
    return obj


def pivot(name, parent, location):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.rotation_mode = "XYZ"
    return obj


class Dog:
    def __init__(self):
        fur = glowing_vertex_material("Fur", 0.16)
        black = flat_material("DogBlack", "#1d1716", 0.12, specular=0.9)
        pink = flat_material("DogPink", "#f4a7b9", 0.55)
        tongue = flat_material("Tongue", "#f27f97", 0.35)
        gold = flat_material("Tag", "#f2b84b", 0.3)
        self.root = pivot("Dog", None, (0, 0, 0))
        self.rear = pivot("DogRear", self.root, (0, -0.13, 0))
        self.body = pivot("DogBody", self.rear, (0, 0.13, 0))
        add_fur("DogTorso", self.body, (0, -0.01, 0.175), (0.088, 0.14, 0.082), 900, 0.062, fur, 1, (0.0, -0.45, -0.75))
        add_fur("DogChest", self.body, (0, 0.115, 0.185), (0.078, 0.066, 0.088), 420, 0.06, fur, 2, (0.0, -0.05, -0.9))
        self.head = pivot("DogHead", self.body, (0, 0.135, 0.255))
        add_fur("DogSkull", self.head, (0, 0.045, 0.055), (0.088, 0.082, 0.082), 900, 0.036, fur, 3, (0.0, -0.55, -0.35))
        add_fur("DogTop", self.head, (0, 0.035, 0.125), (0.056, 0.056, 0.03), 200, 0.036, fur, 4, (0.0, -0.3, 0.45))
        add_fur("DogMuzzle", self.head, (0, 0.125, 0.024), (0.04, 0.042, 0.032), 300, 0.016, fur, 5, (0.0, -0.15, -0.55))
        smooth_ball("DogNose", self.head, (0, 0.172, 0.04), (0.019, 0.014, 0.016), black)
        for sign in (-1, 1):
            smooth_ball("DogEye", self.head, (sign * 0.043, 0.113, 0.066), (0.0155, 0.011, 0.017), black)
        self.tongue = smooth_ball("DogTongue", self.head, (0, 0.15, -0.012), (0.018, 0.032, 0.006), tongue)
        self.ears = []
        for sign in (-1, 1):
            ear = pivot("DogEar", self.head, (sign * 0.085, 0.03, 0.095))
            add_fur("DogEarFur", ear, (sign * 0.022, 0, -0.07), (0.026, 0.038, 0.078), 420, 0.05, fur, 7 + sign, (0.0, 0.0, -1.0))
            self.ears.append((ear, sign))
        self.legs = []
        for index, (sign, front) in enumerate(((-1, 1), (1, 1), (-1, -1), (1, -1))):
            leg = pivot("DogLeg", self.body, (sign * 0.056, front * 0.095, 0.125))
            add_fur("DogLegFur", leg, (0, 0, -0.06), (0.027, 0.029, 0.062), 300, 0.032, fur, 10 + index, (0.0, 0.0, -1.0))
            self.legs.append((leg, sign * front, front > 0))
        self.tail = pivot("DogTail", self.body, (0, -0.15, 0.215))
        add_fur("DogTailFur", self.tail, (0, -0.02, 0.055), (0.026, 0.03, 0.06), 320, 0.052, fur, 20, (0.0, -0.75, -0.35))
        self.build_collar(pink, gold)

    def build_collar(self, pink, gold):
        rows, cols = 24, 6
        u, v = np.meshgrid(np.linspace(0, math.tau, rows, endpoint=False), np.linspace(0, math.tau, cols, endpoint=False), indexing="ij")
        ring = 0.073 + 0.011 * np.cos(v)
        verts = np.stack((ring * np.cos(u), ring * np.sin(u), 0.011 * np.sin(v)), axis=-1).reshape(-1, 3)
        index = np.arange(rows * cols).reshape(rows, cols)
        quads = np.stack((index, np.roll(index, -1, 0), np.roll(np.roll(index, -1, 0), -1, 1), np.roll(index, -1, 1)), axis=-1).reshape(-1, 4)
        collar = make_mesh("DogCollar", verts, quads=quads, material=pink)
        collar.parent = self.body
        collar.location = (0, 0.125, 0.235)
        collar.rotation_euler = (math.radians(68), 0, 0)
        smooth_ball("DogTag", self.body, (0, 0.2, 0.185), (0.016, 0.005, 0.016), gold)

    def update(self, t):
        state = dog_state(t)
        for obj in [self.root, *self.root.children_recursive]:
            obj.hide_render = not state["visible"]
        if not state["visible"]:
            return
        self.root.location = (state["x"], state["y"], ground_at(state["x"], state["y"], t))
        self.root.rotation_euler = (0, 0, state["heading"])
        wave = t * state["speed"]
        moving = state["moving"]
        bounce = abs(math.sin(wave)) * 0.016 if moving else 0.003 * math.sin(t * 3.1)
        self.body.location = (0, 0.13, bounce)
        self.rear.rotation_euler = (state["rear"] * math.radians(62) + (0.05 * math.sin(wave * 2) if moving else 0), 0, 0)
        for leg, phase, front in self.legs:
            swing = math.sin(wave + (0 if phase > 0 else math.pi)) * 0.62 if moving else 0.0
            if state["rear"] > 0:
                swing += state["rear"] * (-1.15 + 0.14 * math.sin(t * 13 + phase) if front else 0.95)
            leg.rotation_euler = (swing, 0, 0)
        sniff = state["sniff"]
        lick = state["rear"]
        idle = 0.05 * math.sin(wave * 2) if moving else 0.03 * math.sin(t * 1.7)
        self.head.rotation_euler = (-0.5 * sniff + 0.05 * math.sin(t * 9) * sniff - 1.08 * lick + 0.13 * math.sin(t * 15) * lick + idle, 0, 0)
        ear_swing = 0.1 * math.sin(wave * 2) if moving else 0.03 * math.sin(t * 2.3)
        for ear, sign in self.ears:
            ear.rotation_euler = (ear_swing, sign * (-0.12 - abs(ear_swing)), 0)
        self.tail.rotation_euler = (-0.55, math.sin(t * (17 if state["wag"] > 0.6 else 9)) * 0.7 * state["wag"], 0)
        self.tongue.hide_render = not state["tongue"]
        self.tongue.location = (0, 0, -0.004 + 0.006 * math.sin(t * 15))


# ---------------------------------------------------------------- egg
EGG_HEIGHT = 1.25
EGG_RADIUS = 0.46


def egg_shape(directions):
    points = directions * np.array((EGG_RADIUS, EGG_RADIUS, EGG_HEIGHT / 2))
    points[:, 0] *= 1 - 0.2 * directions[:, 2]
    points[:, 1] *= 1 - 0.2 * directions[:, 2]
    return points


def egg_bottom(t):
    if t < 6.6:
        return 76 - 3.6 * t
    if t < 7.35:
        return 30.0
    if t < LAND:
        return 8.0 * (1 - (t - 7.35) / (LAND - 7.35))
    return ground_at(0, 0, LAND) - 0.04


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
        stages = (4, 10, 18, 28, 38)
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
        verts = np.array([(radius * math.cos(a), radius * math.sin(a), z) for radius, z in ((0.5, 0.0), (1.8, 46.0)) for a in u])
        quads = np.array([(i, (i + 1) % rows, rows + (i + 1) % rows, rows + i) for i in range(rows)])
        material = bpy.data.materials.new("Beam")
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        nodes.clear()
        out = nodes.new("ShaderNodeOutputMaterial")
        mix = nodes.new("ShaderNodeMixShader")
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
        links.new(strength.outputs[0], mix.inputs[0])
        links.new(clear.outputs[0], mix.inputs[1])
        links.new(emit.outputs[0], mix.inputs[2])
        links.new(mix.outputs[0], out.inputs["Surface"])
        self.beam = make_mesh("Beam", verts, quads=quads, material=material)

    def update(self, t):
        bottom = egg_bottom(t)
        squash = math.sin((t - LAND) / 0.35 * math.pi) * 0.09 if LAND <= t < LAND + 0.35 else 0.0
        shake = sum(math.exp(-(t - hit) * 7) * math.sin((t - hit) * 42) * 0.018 for hit in CRACK_HITS if hit <= t < BURST)
        tremble = 0.02 * math.sin(t * 55) * float(smooth(11.2, 11.9, t)) if t < BURST else 0.0
        self.root.location = (0, 0, bottom + EGG_HEIGHT / 2 * (1 - squash))
        self.root.rotation_euler = (shake + tremble * 0.7, shake * 0.6 + tremble, 0)
        self.root.scale = (1 + squash * 0.6, 1 + squash * 0.6, 1 - squash)
        root_matrix = Matrix.Translation(self.root.location) @ self.root.rotation_euler.to_matrix().to_4x4() @ Matrix.Diagonal((*self.root.scale, 1))
        ground = ground_at(0, 0, LAND)
        for piece in self.pieces:
            obj, rest, normal = piece["obj"], piece["rest"], piece["normal"]
            if t < BURST:
                opening = 0.0
                if piece["crack"] is not None and t >= piece["crack"]:
                    opening = 0.007 + 0.016 * float(smooth(piece["crack"], BURST, t))
                obj.location = root_matrix @ Vector((rest + normal * opening).tolist())
                obj.rotation_quaternion = self.root.rotation_euler.to_quaternion()
                obj.scale = self.root.scale
                continue
            obj.scale = (1, 1, 1)
            age = t - BURST
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
        glow = (6 + 30 * pulse + 120 * float(smooth(10.8, BURST, t))) if CRACK_HITS[0] <= t < BURST else 0.0
        flash = 900 * math.exp(-(t - BURST) * 5.5) if t >= BURST else 0.0
        self.light.data.energy = glow * 0.25 + flash
        self.light.location = (0, 0, ground + 0.5)
        self.light.hide_render = self.light.data.energy < 0.05
        self.beam.location = (0, 0, bottom + EGG_HEIGHT * 0.5)
        self.beam.hide_render = t >= 6.6


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


class Fader:
    """A plane right in front of the lens for the white flash and the eye-opening shot."""

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
        if t < 14:
            amount = float(track(t, [(BURST, 0.0), (BURST + 0.1, 0.92), (BURST + 0.8, 0.0)]))
        else:
            amount = float(track(t, [(14, 1.0), (15.8, 0.0)]))
        self.mix.inputs[0].default_value = amount
        self.plane.hide_render = amount <= 0.001


# ---------------------------------------------------------------- shots
@dataclass
class Shot:
    start: float
    end: float
    eye: Callable[[float, float], Vector]
    look: Callable[[float, float], Vector]
    lens: float
    fstop: float = 0.0
    focus: Callable[[float, float], Vector] | None = None


def move(a, b):
    a, b = Vector(a), Vector(b)
    return lambda u, t: a.lerp(b, float(smooth(0, 1, u)))


def at(point):
    point = Vector(point)
    return lambda u, t: point


def hero_point(offset):
    offset = Vector(offset)

    def point(u, t):
        state = hero_state(t)
        return Vector((state["x"], state["y"], ground_at(state["x"], state["y"], t))) + offset
    return point


def dog_point(offset):
    offset = Vector(offset)

    def point(u, t):
        state = dog_state(t)
        return Vector((state["x"], state["y"], ground_at(state["x"], state["y"], t))) + offset
    return point


def egg_center(offset=(0, 0, 0)):
    offset = Vector(offset)
    return lambda u, t: Vector((0, 0, egg_bottom(t) + EGG_HEIGHT / 2)) + offset


def blend(a, b, start, end):
    return lambda u, t: a(u, t).lerp(b(u, t), float(smooth(start, end, t)))


def waking_focus(u, t):
    far = 0.15 + 12 * float(smooth(0.2, 0.8, u)) ** 2
    return Vector((0, far, 0.46 + far))


SHOTS = [
    Shot(0, 3.4, egg_center((2.4, -3.4, -2.2)), egg_center((0, 0, 0.75)), 40),
    Shot(3.4, 6.6, lambda u, t: egg_center((2.0, -3.2, 5.5 + 7 * u))(u, t), egg_center(), 36),
    Shot(6.6, 8.6, move((-1.2, -4.6, 0.5), (-1.05, -4.3, 0.52)), move((0, 0, 0.72), (0, 0, 0.62)), 40),
    Shot(8.6, 10.7, move((-1.6, -3.0, 0.5), (-1.15, -2.3, 0.54)), move((0, 0, 0.62), (0, 0, 0.64)), 45, 7.0, at((0, -0.3, 0.6))),
    Shot(10.7, 11.9, move((-0.56, -1.5, 0.62), (-0.46, -1.24, 0.66)), move((-0.05, 0, 0.66), (-0.05, 0, 0.7)), 50, 7.0, at((-0.08, -0.4, 0.65))),
    Shot(11.9, 14, move((-1.3, -3.1, 0.62), (-1.55, -3.75, 0.78)), move((0, 0, 0.5), (0, 0, 0.42)), 38),
    Shot(14, 16.4, at((0, 0, 0.46)), move((0.5, 2, 2.3), (-0.3, 2, 2.8)), 28, 0.35, waking_focus),
    Shot(16.4, 21.8, move((-1.0, -1.85, 0.56), (-0.8, -1.5, 0.48)), at((0, 0.05, 0.3)), 50, 7.0, at((0, 0, 0.3))),
    Shot(21.8, 24, move((0.32, -1.0, 0.3), (0.3, -0.9, 0.31)), dog_point((0, 0, 0.14)), 70, 8.0, dog_point((0, 0, 0.15))),
    Shot(24, 28, move((0.58, -1.15, 0.52), (0.5, -1.05, 0.44)), lambda u, t: dog_point((0, 0, 0.2))(u, t).lerp(Vector((0, 0, 0.28)), 0.42), 50, 8.0, dog_point((0, 0, 0.18))),
    Shot(28, 34.5, move((-1.42, 0.2, 0.36), (-1.25, 0.26, 0.38)), move((0, 0.27, 0.27), (0, 0.27, 0.3)), 45, 8.0, at((0, 0.26, 0.28))),
    Shot(34.5, 40, move((0.62, -1.32, 0.42), (0.58, -1.1, 0.4)), move((0, 0.5, 0.26), (0, 1.1, 0.3)), 45, 8.0, hero_point((0, 0, 0.3))),
    Shot(40, 46, hero_point((-1.2, -1.15, 0.42)), hero_point((0.12, 0.42, 0.3)), 40, 8.0, hero_point((0, 0, 0.3))),
    Shot(46, 51.42,
         blend(hero_point((0.3, -1.05, 0.28)), hero_point((0.7, -6.0, 2.0)), 46.4, 50.0),
         blend(hero_point((0, 1.0, 0.55)), at((-1.0, 34, 1.4)), 46.4, 49.6),
         30),
]


def build_camera():
    camera = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera.rotation_mode = "QUATERNION"
    camera.data.clip_start = 0.02
    camera.data.clip_end = 1500
    camera.data.sensor_width = 36

    def update(t):
        shot = next((s for s in SHOTS if s.start <= t < s.end), SHOTS[-1])
        u = (t - shot.start) / (shot.end - shot.start)
        eye = shot.eye(u, t).copy()
        eye.z = max(eye.z, ground_at(eye.x, eye.y, t) + 0.12)
        eye += Vector((math.sin(t * 1.3) * 0.004, math.sin(t * 0.9 + 1) * 0.003, math.sin(t * 1.7 + 2) * 0.004))
        camera.location = eye
        camera.rotation_quaternion = (shot.look(u, t) - eye).to_track_quat("-Z", "Y")
        camera.data.lens = shot.lens
        camera.data.dof.use_dof = shot.fstop > 0
        if shot.fstop > 0:
            camera.data.dof.aperture_fstop = shot.fstop
            target = shot.focus(u, t) if shot.focus else shot.look(u, t)
            camera.data.dof.focus_distance = max((target - eye).length, 0.05)
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
    camera, update_camera = build_camera()
    update_grass = build_grass(lambda: camera.location)
    fader = Fader(camera)

    def update_visibility(t):
        village.hide_render = t < 46
        for child in village.objects:
            child.hide_render = t < 46

    updaters = [update_camera, update_ground, update_grass, update_visibility, hero.update, dog.update, egg.update, dust.update, fader.update]
    render_frames(args, updaters)


if __name__ == "__main__":
    main()
