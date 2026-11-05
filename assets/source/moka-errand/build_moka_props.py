# -*- coding: utf-8 -*-
"""Build the original Moka errand props using the environment kit pipeline."""
import importlib.util
import functools
import json
import math
import os
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent
PUBLIC = ROOT / 'client/public/assets/abraxas/environment'
PREVIEWS = SOURCE / 'previews'
spec = importlib.util.spec_from_file_location('environment', ROOT / 'assets/source/environment/build_environment.py')
env = importlib.util.module_from_spec(spec)
sys.dont_write_bytecode = True
spec.loader.exec_module(env)
env.PUBLIC_ENV_DIR = str(PUBLIC)
P = {**env.PALETTE, 'wood': '#986449', 'wood_light': '#B47A58', 'wood_dark': '#714632'}


def basket(p):
    p.add_box((.38, .28, .045), (0, 0, .035), P['wood_dark'])
    for y in (-.125, .125):
        p.add_box((.38, .03, .16), (0, y, .12), P['wood'])
        p.add_box((.40, .035, .025), (0, y, .205), P['wood_light'])
    for x in (-.175, .175):
        p.add_box((.03, .22, .16), (x, 0, .12), P['wood'])
        p.add_box((.035, .25, .025), (x, 0, .205), P['wood_light'])
    for x in (-.13, .13):
        p.add_box((.025, .025, .19), (x, 0, .29), P['wood_dark'])
    p.add_box((.28, .025, .025), (0, 0, .38), P['wood_dark'])
    p.add_sphere(.095, (-.08, 0, .19), P['path'], scale=(1, .8, .65))
    p.add_sphere(.09, (.08, 0, .19), P['gold'], scale=(1, .8, .65))


def display(p):
    for y, color in ((-.101, P['wood_light']), (.101, P['wood'])):
        p.add_box((.76, .198, .055), (0, y, .26), color)
    for x in (-.32, .32):
        for y in (-.15, .15):
            p.add_box((.06, .06, .25), (x, y, .125), P['wood'])
    p.add_box((.76, .035, .06), (0, .185, .315), P['wood_dark'])


def bread_round(p):
    p.add_sphere(.14, (0, 0, .07), P['path'], scale=(1, 1, .5))
    p.add_box((.16, .015, .012), (0, 0, .139), P['cream_warm'], rot_euler=(0, 0, .5), bevel=.005)


def bread_long(p):
    p.add_sphere(.14, (0, 0, .065), P['gold'], scale=(1.5, .55, .45))
    for x in (-.085, 0, .085):
        p.add_box((.015, .10, .01), (x, 0, .125), P['cream_warm'], rot_euler=(0, 0, .3), bevel=.004)


def bread_flower(p):
    for i in range(5):
        a = i * math.tau / 5
        p.add_sphere(.065, (.075 * math.cos(a), .075 * math.sin(a), .04), P['path'], subdivisions=1, scale=(1, 1, .6))
    p.add_sphere(.052, (0, 0, .06), P['gold_light'], subdivisions=1, scale=(1, 1, .55))


def dropoff(p):
    for y, color in ((-.101, P['wood_light']), (.101, P['wood'])):
        p.add_box((.54, .198, .07), (0, y, .47), color)
    for x in (-.21, .21):
        for y in (-.14, .14):
            p.add_box((.07, .07, .44), (x, y, .22), P['wood_dark'])
    p.add_box((.46, .035, .08), (0, .17, .25), P['wood'])


def ledger(p):
    p.add_box((.28, .20, .035), (0, 0, .018), P['wood_dark'])
    p.add_box((.25, .18, .02), (0, 0, .045), P['cream'])
    p.add_box((.014, .18, .006), (0, 0, .058), P['wood'])


def plate(p):
    p.add_cylinder(.15, .15, .025, (0, 0, .013), P['cream'], vertices=16)
    p.add_cylinder(.10, .10, .008, (0, 0, .03), P['cream_warm'], vertices=16)


def mold(p):
    p.add_cylinder(.115, .13, .06, (0, 0, .03), P['stone'], vertices=12)
    p.add_cylinder(.095, .10, .012, (0, 0, .064), P['cream_warm'], vertices=12)


# Dimensions are Blender X, Y, Z; the exported glTF is Y-up.
ASSETS = {
    'basket': (basket, (.40, .29, .40), []),
    'display': (display, (.76, .40, .345), [{'type': 'box', 'x': 0, 'z': 0, 'halfX': .38, 'halfZ': .20}]),
    'bread-round': (bread_round, (.28, .28, .15), []),
    'bread-long': (bread_long, (.42, .16, .14), []),
    'bread-flower': (bread_flower, (.28, .28, .10), []),
    'dropoff': (dropoff, (.54, .40, .51), [{'type': 'box', 'x': 0, 'z': 0, 'halfX': .27, 'halfZ': .20}]),
    'ledger': (ledger, (.28, .20, .06), []),
    'plate': (plate, (.30, .30, .04), []),
    'mold': (mold, (.26, .26, .07), []),
}


def glb_json(path):
    with open(path, 'rb') as f:
        magic, version, length, json_length, chunk = struct.unpack('<IIIII', f.read(20))
        assert magic == 0x46546c67 and version == 2 and length == os.path.getsize(path) and chunk == 0x4e4f534a
        return json.loads(f.read(json_length))


def main():
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    camera, sun, fill, marker = env.setup_preview_studio()
    sun.data.energy = 1.5
    fill.data.energy = .5
    marker.hide_render = True
    scene = bpy.context.scene
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.image_settings.file_format = 'PNG'
    metadata = {'paletteVersion': 'dream-v2', 'blenderVersion': bpy.app.version_string,
                'colorSpace': 'FLOAT_COLOR COLOR_0: sRGB to linear once, one linear AO multiplication',
                'basketAttachment': {'coordinateSystem': 'player local, glTF Y-up',
                                     'offset': [0, .30, .30], 'scale': 1,
                                     'status': 'initial proposal; verify player forward direction, clipping and face visibility in game'},
                'displayStack': {'count': [1, 3], 'stepY': .29,
                                 'collision': 'one base footprint regardless of tier count'},
                'assets': {}}
    for name, (builder, dims, collision) in ASSETS.items():
        key = 'prop-moka-' + name
        p = env.PartBuilder()
        p.add_box = functools.partial(p.add_box, bevel=0)
        p.add_cylinder = functools.partial(p.add_cylinder, bevel=0, smooth=False)
        p.add_sphere = functools.partial(p.add_sphere, smooth=False)
        builder(p)
        obj = p.build_combined_object(key, dims)
        glb = Path(env.export_asset_glb(obj, key))
        gltf = glb_json(glb)
        primitives = [primitive for mesh in gltf['meshes'] for primitive in mesh['primitives']]
        assert primitives and all('KHR_draco_mesh_compression' in p.get('extensions', {}) and 'COLOR_0' in p['attributes'] for p in primitives)
        triangles = sum(gltf['accessors'][p['indices']]['count'] // 3 for p in primitives)
        assert 0 < triangles <= 700 and glb.stat().st_size <= 40960
        positions = [gltf['accessors'][p['attributes']['POSITION']] for p in primitives]
        minimum = [min(a['min'][i] for a in positions) for i in range(3)]
        maximum = [max(a['max'][i] for a in positions) for i in range(3)]
        assert all(abs((maximum[i] - minimum[i]) - (dims[0], dims[2], dims[1])[i]) < .001 for i in range(3))
        verification = env.verify_glb_colors(str(glb), key, obj['used_palette_colors'])
        span = max(dims)
        target = Vector((0, 0, dims[2] * .48))
        camera.location = target + Vector((2.8, -2.8, 2.3)) * span
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = span * 1.65
        scene.render.filepath = str(PREVIEWS / (key + '.png'))
        bpy.ops.render.render(write_still=True)
        path = 'assets/abraxas/environment/' + key + '.glb'
        metadata['assets'][key] = {
            'path': path, 'triangles': triangles, 'bytes': glb.stat().st_size, 'maxTriangles': 700, 'maxBytes': 40960,
            'bounds': {'width': round(maximum[0] - minimum[0], 4), 'depth': round(maximum[2] - minimum[2], 4), 'height': round(maximum[1] - minimum[1], 4), 'minY': round(minimum[1], 4), 'maxY': round(maximum[1], 4)},
            'collision': collision, 'colorVerification': verification,
            'manifestDraft': {'path': path, 'scale': 1, 'collision': collision},
            'preview': 'assets/source/moka-errand/previews/' + key + '.png'}
        bpy.data.objects.remove(obj, do_unlink=True)
    metadata['totalBytes'] = sum(a['bytes'] for a in metadata['assets'].values())
    (SOURCE / 'asset-metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
