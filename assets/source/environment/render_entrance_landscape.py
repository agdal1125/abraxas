"""Render the same 16:9 entrance view from the actual map and exported assets."""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
with open(os.environ.get("ABRAXAS_PREVIEW_MAP", os.path.join(root, "content/world/village.json")), encoding="utf-8") as f:
    village = json.load(f)
with open(os.path.join(root, "content/assets/manifest.json"), encoding="utf-8") as f:
    manifest = json.load(f)["assets"]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
cache = {}
for placement in [village["terrain"], *village["props"]]:
    asset = placement["asset"]
    if asset != "terrain" and math.hypot(placement["x"] - 6, placement["z"] - 10.4) > 7:
        continue
    if asset not in cache:
        before = set(bpy.data.objects)
        path = os.path.join(root, "client/public", manifest[asset]["path"])
        if asset == "terrain":
            path = os.environ.get("ABRAXAS_PREVIEW_TERRAIN", path)
        bpy.ops.import_scene.gltf(filepath=path)
        imported = set(bpy.data.objects) - before
        cache[asset] = [o for o in imported if o.type == 'MESH']
        for obj in imported:
            obj.hide_render = True
    for source in cache[asset]:
        obj = source.copy()
        obj.data = source.data
        bpy.context.collection.objects.link(obj)
        obj.hide_render = False
        obj.location = (placement["x"], -placement["z"], 0)
        obj.rotation_euler = (0, 0, placement.get("rot", 0))
        obj.scale = (manifest[asset]["scale"] * placement.get("scale", 1),) * 3

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'
scene.world.color = (0.35, 0.35, 0.35)
camera_data = bpy.data.cameras.new("LandscapeCamera")
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 3.4 * 16 / 9
camera = bpy.data.objects.new("LandscapeCamera", camera_data)
bpy.context.collection.objects.link(camera)
target = Vector((6, -10.4, 0.15))
camera.location = target + Vector((10, -10, 10 * math.tan(math.radians(35)) * math.sqrt(2)))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
sun_data = bpy.data.lights.new("Sun", 'SUN')
sun_data.energy = 2.5
sun = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(35), math.radians(-25), math.radians(-30))
suffix = sys.argv[sys.argv.index('--') + 1]
assert suffix in ('before', 'after')
scene.render.filepath = os.path.join(root, 'assets/source/previews/environment', f'entrance-plaza-landscape-{suffix}.png')
bpy.ops.render.render(write_still=True)
