"""Build RS1-A props with the existing environment geometry and export pipeline."""
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

ROOT = Path(__file__).resolve().parents[4]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('environment', ROOT / 'assets/source/environment/build_environment.py')
env = importlib.util.module_from_spec(spec)
spec.loader.exec_module(env)
env.PUBLIC_ENV_DIR = str(ROOT / 'client/public/assets/abraxas/environment')
P = {**env.PALETTE, 'wood': '#986449', 'wood_light': '#B47A58', 'wood_dark': '#714632'}


def box(p, size, center, color, **kw):
    p.add_box(size, center, P[color], bevel=0, **kw)


def disk(p, radius, depth, center, color, vertices=12):
    p.add_cylinder(radius, radius, depth, center, P[color], vertices=vertices, bevel=0)


def mark(p, shape, x, y, z, color='ink', scale=1):
    if shape == 'circle':
        disk(p, .045 * scale, .008, (x, y, z), color)
    elif shape == 'triangle':
        disk(p, .052 * scale, .008, (x, y, z), color, 3)
    else:
        box(p, (.08 * scale, .08 * scale, .008), (x, y, z), color)


def board(p, kind):
    box(p, (.68, .40, .055), (0, 0, .028), 'wood_dark')
    box(p, (.62, .34, .018), (0, 0, .065), 'cream_warm')
    shapes = ('circle', 'triangle', 'square')
    for row in ((0,) if kind == 'or' else (-1, 1)):
        for i, shape in enumerate(shapes):
            x, y = (i - 1) * .19, row * .085
            mark(p, shape, x, y, .078, 'violet_slate' if kind == 'echo' else 'wood_dark', .7)
            if kind == 'echo':
                if i == 0:
                    box(p, (.012, .08, .009), (x, y, .085), 'grass_dark')
                    box(p, (.07, .012, .009), (x, y, .087), 'grass_dark', rot_euler=(0, 0, .55))
                elif i == 1:
                    box(p, (.07, .018, .009), (x, y, .086), 'gold')
                else:
                    box(p, (.018, .07, .009), (x, y, .086), 'gold')
                    box(p, (.07, .018, .009), (x, y, .088), 'gold')


def piece(p, shape, gear=False):
    if gear:
        disk(p, .10, .035, (0, 0, .02), 'gold', 12)
        for i in range(8):
            a = i * math.tau / 8
            box(p, (.075, .035, .035), (.10 * math.cos(a), .10 * math.sin(a), .02), 'gold', rot_euler=(0, 0, a))
    else:
        mark(p, shape, 0, 0, .018, 'coral', 1.7)
    mark(p, shape, 0, 0, .042 if gear else .025, 'wood_dark' if gear else 'cream', .75)


def notice(p):
    box(p, (.25, .18, .055), (0, 0, .03), 'cream')
    box(p, (.04, .18, .06), (0, 0, .035), 'coral')


def horn(p):
    p.add_cylinder(.035, .12, .28, (0, 0, .10), P['gold'], vertices=12, rot_euler=(0, math.pi / 2, 0), bevel=0)
    p.add_cylinder(.085, .085, .006, (.143, 0, .10), P['wood_dark'], vertices=12, rot_euler=(0, math.pi / 2, 0), bevel=0)
    box(p, (.035, .035, .10), (-.055, 0, .05), 'wood_dark')
    disk(p, .025, .025, (-.155, 0, .10), 'wood_dark')


def material(p):
    box(p, (.26, .16, .12), (0, 0, .07), 'grass')
    box(p, (.045, .17, .13), (0, 0, .075), 'coral')
    box(p, (.27, .025, .13), (0, 0, .075), 'coral')


def score(p):
    box(p, (.27, .19, .025), (0, 0, .015), 'cream')
    box(p, (.018, .19, .028), (-.11, 0, .02), 'violet_slate')
    for y in (-.045, 0, .045):
        box(p, (.14, .008, .005), (.025, y, .032), 'wood_dark')


def book(p):
    box(p, (.27, .20, .055), (0, 0, .03), 'violet_slate')
    box(p, (.235, .185, .033), (.012, 0, .035), 'cream')
    box(p, (.035, .20, .06), (-.12, 0, .033), 'violet')
    box(p, (.27, .20, .012), (0, 0, .065), 'violet_slate')


def bucket(p, filled):
    p.add_cylinder(.115, .145, .19, (0, 0, .10), P['wood'], vertices=12, bevel=0)
    disk(p, .145, .018, (0, 0, .20), 'wood_dark')
    disk(p, .115, .012, (0, 0, .211), 'path' if filled else 'ink')
    for x in (-.135, .135):
        box(p, (.02, .02, .15), (x, 0, .265), 'wood_dark')
    box(p, (.29, .02, .02), (0, 0, .34), 'wood_dark')


def sand(p):
    p.add_sphere(.18, (0, 0, .045), P['path'], subdivisions=1, scale=(1, .75, .25))


def bell(p):
    p.add_cylinder(.15, .09, .19, (0, 0, .11), P['gold'], vertices=12, bevel=0)
    disk(p, .15, .025, (0, 0, .025), 'wood_dark')
    disk(p, .035, .04, (0, 0, .225), 'wood_dark')
    box(p, (.10, .025, .025), (0, 0, .255), 'wood_dark')


def diagram(p):
    box(p, (.54, .36, .045), (0, 0, .025), 'wood_dark')
    box(p, (.49, .31, .014), (0, 0, .055), 'cream')
    box(p, (.03, .23, .012), (-.12, 0, .07), 'teal_dark')
    box(p, (.25, .025, .012), (0, .09, .07), 'teal_dark')
    box(p, (.025, .18, .012), (.11, .01, .07), 'teal_dark')
    disk(p, .06, .018, (.11, -.08, .075), 'gold')


ASSETS = {
    'lumi': {
        'notice': (notice, (.25, .18, .065)), 'horn': (horn, (.31, .24, .22)),
        'material': (material, (.27, .17, .14)), 'score': (score, (.27, .19, .04)),
        'decoration-board': (lambda p: board(p, 'lumi'), (.68, .40, .085)),
        **{f'decoration-{s}': (lambda p, s=s: piece(p, s), (.15, .15, .035)) for s in ('circle', 'triangle', 'square')},
    },
    'echo': {'book': (book, (.27, .20, .075)), 'books-board': (lambda p: board(p, 'echo'), (.68, .40, .095))},
    'or': {
        'bucket-empty': (lambda p: bucket(p, False), (.30, .30, .35)),
        'bucket-sand': (lambda p: bucket(p, True), (.30, .30, .35)), 'sand': (sand, (.36, .27, .10)),
        'gear-board': (lambda p: board(p, 'or'), (.68, .40, .085)),
        **{f'gear-{s}': (lambda p, s=s: piece(p, s, True), (.27, .27, .05)) for s in ('circle', 'triangle', 'square')},
        'bell': (bell, (.30, .30, .27)), 'lantern-diagram': (diagram, (.54, .36, .09)),
    },
}

MAPPING = {
    'lumi': {'lumi-horn': 'prop-lumi-horn', 'lumi-notices': 'prop-lumi-notice',
        'lumi-ribbon-source': 'prop-lumi-material', 'lumi-field-source': 'prop-lumi-material',
        'lumi-score-new': 'prop-lumi-score', 'lumi-score-old': 'prop-lumi-score',
        'lumi-decoration-board': 'prop-lumi-decoration-board',
        'circle-1/circle-2': 'prop-lumi-decoration-circle', 'triangle-1/triangle-2': 'prop-lumi-decoration-triangle',
        'square-1/square-2': 'prop-lumi-decoration-square',
        'lumi-rest/lumi-stage-workbench': 'prop-moka-dropoff',
        'lumi-table-alone/lumi-table-together': 'bench; role display',
        'lumi-card-new/lumi-card-traditional/lumi-welcome-postcard': 'prop-lumi-notice; role display'},
    'echo': {'echo-picture-book/echo-history-record/echo-attic-record/echo-notebook/echo-legend': 'prop-echo-book',
        'echo-bookshelf': 'prop-echo-books-board', 'plant-1/plant-2/cooking-1/cooking-2/stars-1/stars-2': 'prop-echo-book; subject mark in UI',
        'echo-rest/echo-reading-desk/echo-story-table/echo-open-display': 'prop-moka-dropoff',
        'echo-history-shelf/echo-cooking-shelf': 'book-stack; role display',
        'echo-attic-door/echo-glass-case/echo-story/bookmarks/notes': 'existing environment plus role display; W to choose'},
    'or': {'or-bucket empty': 'prop-or-bucket-empty', 'or-bucket filled': 'prop-or-bucket-sand',
        'or-sand': 'prop-or-sand', 'or-clock-board': 'prop-or-gear-board',
        'gear-circle': 'prop-or-gear-circle', 'gear-triangle': 'prop-or-gear-triangle', 'gear-square': 'prop-or-gear-square',
        'or-bell': 'prop-or-bell', 'or-lantern-link': 'prop-or-lantern-diagram',
        'or-rest/or-grinding-bench/or-plaza-stand': 'prop-moka-dropoff',
        'or-tools': 'tool-rack', 'or-fire/or-weight/or-hook/or-map': 'existing environment plus role display; W to choose'},
}


def read_glb(path):
    with path.open('rb') as f:
        magic, version, length, size, kind = struct.unpack('<IIIII', f.read(20))
        assert (magic, version, length, kind) == (0x46546c67, 2, path.stat().st_size, 0x4e4f534a)
        return json.loads(f.read(size))


def main():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    camera, sun, fill, marker = env.setup_preview_studio()
    sun.data.energy, fill.data.energy, marker.hide_render = 1.5, .5, True
    scene = bpy.context.scene
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.image_settings.file_format = 'PNG'
    for resident, assets in ASSETS.items():
        source = ROOT / 'assets/source/residents-errands' / resident
        previews = source / 'previews'
        source.mkdir(parents=True, exist_ok=True)
        previews.mkdir(parents=True, exist_ok=True)
        metadata = {'paletteVersion': 'dream-v2', 'blenderVersion': bpy.app.version_string,
                    'colorSpace': 'FLOAT_COLOR COLOR_0: sRGB to linear once, one linear AO multiplication',
                    'origin': 'ground center; glTF Y-up', 'targetAssetReuse': MAPPING[resident], 'assets': {}}
        for name, (builder, dims) in assets.items():
            key = f'prop-{resident}-{name}'
            p = env.PartBuilder()
            p.add_sphere = functools.partial(p.add_sphere, smooth=False)
            builder(p)
            obj = p.build_combined_object(key, dims)
            glb = Path(env.export_asset_glb(obj, key))
            gltf = read_glb(glb)
            primitives = [v for mesh in gltf['meshes'] for v in mesh['primitives']]
            assert primitives and all('KHR_draco_mesh_compression' in v.get('extensions', {}) and 'COLOR_0' in v['attributes'] for v in primitives)
            triangles = sum(gltf['accessors'][v['indices']]['count'] // 3 for v in primitives)
            assert 0 < triangles <= 700 and glb.stat().st_size <= 40960, (key, triangles, glb.stat().st_size)
            positions = [gltf['accessors'][v['attributes']['POSITION']] for v in primitives]
            lo = [min(a['min'][i] for a in positions) for i in range(3)]
            hi = [max(a['max'][i] for a in positions) for i in range(3)]
            assert all(abs(hi[i] - lo[i] - (dims[0], dims[2], dims[1])[i]) < .001 for i in range(3)) and abs(lo[1]) < .001
            verification = env.verify_glb_colors(str(glb), key, obj['used_palette_colors'])
            span = max(dims)
            target = Vector((0, 0, dims[2] * .48))
            camera.location = target + Vector((2.8, -2.8, 2.3)) * span
            camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
            for view, zoom in (('overview', 2.6), ('close', 1.55)):
                camera.data.ortho_scale = span * zoom
                scene.render.filepath = str(previews / f'{key}-{view}.png')
                bpy.ops.render.render(write_still=True)
            path = f'assets/abraxas/environment/{key}.glb'
            metadata['assets'][key] = {'path': path, 'triangles': triangles, 'bytes': glb.stat().st_size,
                'maxTriangles': 700, 'maxBytes': 40960,
                'bounds': {'width': round(hi[0]-lo[0], 4), 'depth': round(hi[2]-lo[2], 4), 'height': round(hi[1]-lo[1], 4), 'minY': round(lo[1], 4), 'maxY': round(hi[1], 4)},
                'collision': [], 'colorVerification': verification,
                'manifestDraft': {'path': path, 'scale': 1, 'collision': []},
                'preview': f'assets/source/residents-errands/{resident}/previews/{key}-overview.png',
                'closePreview': f'assets/source/residents-errands/{resident}/previews/{key}-close.png'}
            bpy.data.objects.remove(obj, do_unlink=True)
        metadata['totalBytes'] = sum(v['bytes'] for v in metadata['assets'].values())
        (source / 'asset-metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
