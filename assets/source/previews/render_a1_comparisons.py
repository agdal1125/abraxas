import bpy
import os
import subprocess
import tempfile
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PUBLIC = os.path.join(ROOT, 'client', 'public', 'assets', 'abraxas')
OUT = os.path.dirname(__file__)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 512
    scene.render.resolution_y = 288
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('Studio')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.65, 0.61, 0.72, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    scene.world = world
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 5))
    bpy.context.object.rotation_euler = (0.55, -0.45, -0.4)
    bpy.context.object.data.energy = 2.2
    bpy.ops.object.camera_add(location=(5, -7, 6))
    camera = bpy.context.object
    target = Vector((0, 0, 0.65))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 3.35 * 16 / 9
    scene.camera = camera
    bpy.ops.mesh.primitive_plane_add(size=200)
    mat = bpy.data.materials.new('Ground')
    mat.diffuse_color = (0.45, 0.65, 0.52, 1)
    bpy.context.object.data.materials.append(mat)
    return scene


def add(path, location):
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    objects = set(bpy.data.objects) - existing
    for obj in objects:
        if obj.parent is None:
            obj.location += Vector(location)


with tempfile.TemporaryDirectory() as temp:
    for kind, key in [('environment', 'bakery'), ('environment', 'tree-round'), ('environment', 'bush'), ('characters', 'char-a')]:
        path = f'client/public/assets/abraxas/{kind}/{key}.glb'
        with open(os.path.join(temp, key + '.glb'), 'wb') as f:
            f.write(subprocess.check_output(['git', 'show', 'main:' + path], cwd=ROOT))

    for name in ('bakery', 'tree-bush', 'char-a'):
        panels = []
        for before in (True, False):
            scene = setup()
            def asset(kind, key, pos):
                path = os.path.join(temp, key + '.glb') if before else os.path.join(PUBLIC, kind, key + '.glb')
                add(path, pos)
            if name == 'bakery':
                asset('environment', 'bakery', (0, 0.25, 0))
                asset('characters', 'char-a', (-1.1, -0.9, 0))
            elif name == 'tree-bush':
                asset('environment', 'tree-round', (-0.55, 0.2, 0))
                asset('environment', 'bush', (0.65, -0.2, 0))
                asset('characters', 'char-a', (1.25, -0.65, 0))
            else:
                asset('characters', 'char-a', (0, 0, 0))
            path = os.path.join(temp, f'{name}-{before}.png')
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            image = bpy.data.images.load(path, check_existing=False)
            panels.append(list(image.pixels))
        stitched = bpy.data.images.new(name, width=1024, height=288, alpha=True)
        pixels = []
        for y in range(288):
            for panel in panels:
                pixels.extend(panel[y * 512 * 4:(y + 1) * 512 * 4])
        stitched.pixels[:] = pixels
        category = 'characters' if name == 'char-a' else 'environment'
        stitched.filepath_raw = os.path.join(OUT, category, name + '-before-after.png')
        stitched.file_format = 'PNG'
        stitched.save()
