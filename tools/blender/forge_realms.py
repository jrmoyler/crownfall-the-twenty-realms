# Generate Crownfall characters, weapons, and realm props in Blender.
# Organic lofts, worn cloth, and chipped stone — no primitive kitbash.
#
#   xvfb-run -a blender --background --python tools/blender/forge_realms.py -- --out public/models
#   add --qc to render contact stills into artifacts/ before the full export.

import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Vector

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

FAMILIES = ("observatory", "basilica", "foundry", "grove", "monolith")
ROLES = ("ruler", "soldier", "skirmisher", "brute", "mystic")
WEAPONS = ("staff", "blade", "hammer", "spear", "glaive", "orb")


def argv_after():
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1 :]
    return []


def parse_args():
    raw = argv_after()
    out = "public/models"
    qc = False
    export = True
    for i, token in enumerate(raw):
        if token == "--out" and i + 1 < len(raw):
            out = raw[i + 1]
        elif token == "--qc":
            qc = True
        elif token == "--qc-only":
            qc = True
            export = False
    return os.path.abspath(out), qc, export


SUBDIV = 0 if os.environ.get("FORGE_FAST") == "1" else 1
OUT, DO_QC, DO_EXPORT = parse_args()
TEX_DIR = os.path.join(OUT, "textures")
os.makedirs(TEX_DIR, exist_ok=True)


def clean_scene():
    MATS.clear()
    IMAGES.clear()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablock in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights, bpy.data.cameras):
        for block in list(datablock):
            if block.users == 0:
                datablock.remove(block)


def hash2(ix, iy, seed=0):
    n = (int(ix) * 374761393 + int(iy) * 668265263 + seed * 1440662689) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) / 4294967295.0


def vnoise(x, y, seed=0):
    x0 = math.floor(x)
    y0 = math.floor(y)
    fx = x - x0
    fy = y - y0
    sx = fx * fx * (3 - 2 * fx)
    sy = fy * fy * (3 - 2 * fy)
    n00 = hash2(x0, y0, seed)
    n10 = hash2(x0 + 1, y0, seed)
    n01 = hash2(x0, y0 + 1, seed)
    n11 = hash2(x0 + 1, y0 + 1, seed)
    return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy


def fbm(x, y, octaves=5, seed=0):
    amp = 1.0
    freq = 1.0
    total = 0.0
    norm = 0.0
    for i in range(octaves):
        total += amp * vnoise(x * freq, y * freq, seed + i * 17)
        norm += amp
        amp *= 0.5
        freq *= 2.02
    return total / norm


def smoothstep(edge0, edge1, x):
    if edge1 == edge0:
        return 0.0
    t = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------------------
# meshes
# ---------------------------------------------------------------------------

def new_object(name, bm):
    mesh = bpy.data.meshes.new(name)
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def uv_layer(bm):
    return bm.loops.layers.uv.verify()


def bridge(bm, ring_a, ring_b, uva, uvb, uv):
    n = len(ring_a)
    for i in range(n):
        j = (i + 1) % n
        face = bm.faces.new((ring_a[i], ring_a[j], ring_b[j], ring_b[i]))
        coords = (uva[i], uva[j], uvb[j], uvb[i])
        for loop, coord in zip(face.loops, coords):
            loop[uv].uv = coord
        face.smooth = True


def fan_cap(bm, ring, uv_ring, v_cap, uv, flip=False):
    acc = Vector((0, 0, 0))
    for vert in ring:
        acc += vert.co
    center = bm.verts.new(acc / len(ring))
    cu = sum(c[0] for c in uv_ring) / len(uv_ring)
    cv = v_cap
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        if flip:
            face = bm.faces.new((center, ring[j], ring[i]))
            coords = ((cu, cv), uv_ring[j], uv_ring[i])
        else:
            face = bm.faces.new((center, ring[i], ring[j]))
            coords = ((cu, cv), uv_ring[i], uv_ring[j])
        for loop, coord in zip(face.loops, coords):
            loop[uv].uv = coord
        face.smooth = True


def frame_vectors(tangent):
    tangent = tangent.normalized()
    up = Vector((0, 0, 1))
    if abs(tangent.dot(up)) > 0.92:
        up = Vector((0, 1, 0))
    side = tangent.cross(up).normalized()
    binorm = side.cross(tangent).normalized()
    return side, binorm, tangent


def tube(name, points, radii, sides=14, caps=True, front_bias=None):
    """Tube along points. radii are (rx, ry) in the side/binorm frame.
    front_bias, if set, is a list of extra push along -binorm (used when the
    tube's binorm points backward). Optional and usually None.
    """
    bm = bmesh.new()
    uv = uv_layer(bm)
    rings = []
    uvs = []
    count = len(points)
    for i, point in enumerate(points):
        if i == 0:
            tangent = points[1] - points[0]
        elif i == count - 1:
            tangent = points[-1] - points[-2]
        else:
            tangent = points[i + 1] - points[i - 1]
        side, binorm, _tangent = frame_vectors(tangent)
        rx, ry = radii[i]
        ring = []
        ring_uv = []
        for k in range(sides):
            ang = math.tau * k / sides
            # k=0 sits on +side. Push a little organic wobble.
            wobble = 1 + 0.035 * math.sin(ang * 3 + i * 0.7) + 0.02 * math.sin(ang * 5 - i)
            offset = side * math.cos(ang) * rx * wobble + binorm * math.sin(ang) * ry * wobble
            if front_bias and front_bias[i]:
                offset += binorm * (-front_bias[i] * max(0.0, math.sin(ang)))
            ring.append(bm.verts.new(point + offset))
            ring_uv.append((k / sides, i / max(1, count - 1)))
        rings.append(ring)
        uvs.append(ring_uv)
    for i in range(count - 1):
        bridge(bm, rings[i], rings[i + 1], uvs[i], uvs[i + 1], uv)
    if caps and rings:
        fan_cap(bm, rings[0], uvs[0], 0.0, uv, flip=True)
        fan_cap(bm, rings[-1], uvs[-1], 1.0, uv, flip=False)
    return new_object(name, bm)


def grid_surface(name, rows, cols, sampler):
    """sampler(iu, iv, u, v) -> Vector. u,v in 0..1. Quads, open boundary."""
    bm = bmesh.new()
    uv = uv_layer(bm)
    verts = []
    for iv in range(rows):
        v = iv / (rows - 1)
        row = []
        for iu in range(cols):
            u = iu / (cols - 1)
            row.append(bm.verts.new(sampler(iu, iv, u, v)))
        verts.append(row)
    for iv in range(rows - 1):
        v0 = iv / (rows - 1)
        v1 = (iv + 1) / (rows - 1)
        for iu in range(cols - 1):
            u0 = iu / (cols - 1)
            u1 = (iu + 1) / (cols - 1)
            face = bm.faces.new((verts[iv][iu], verts[iv][iu + 1], verts[iv + 1][iu + 1], verts[iv + 1][iu]))
            coords = ((u0, v0), (u1, v0), (u1, v1), (u0, v1))
            for loop, coord in zip(face.loops, coords):
                loop[uv].uv = coord
            face.smooth = True
    return new_object(name, bm)


def curve_points(start, end, bend, steps, rng, sag=0.0):
    points = []
    for i in range(steps):
        t = i / (steps - 1)
        base = start.lerp(end, t)
        arc = math.sin(t * math.pi)
        lateral = Vector((
            bend.x * arc + rng.uniform(-0.02, 0.02) * arc,
            bend.y * arc,
            bend.z * arc - sag * (t ** 1.4),
        ))
        points.append(base + lateral)
    return points


def finish(obj, mat, solid=0.0, sub=1, displace=0.0, noise=0.25, decimate=0.62):
    sub = 0 if SUBDIV == 0 else sub
    if SUBDIV == 0:
        displace = 0.0
    if solid > 0:
        mod = obj.modifiers.new("Solid", "SOLIDIFY")
        mod.thickness = solid
        mod.offset = 1.0
    if sub > 0:
        mod = obj.modifiers.new("Sub", "SUBSURF")
        mod.levels = sub
        mod.render_levels = sub
        if decimate < 0.999:
            dec = obj.modifiers.new("Dec", "DECIMATE")
            dec.ratio = decimate
    if displace > 0:
        tex = bpy.data.textures.get(f"noise_{noise:.2f}")
        if tex is None:
            tex = bpy.data.textures.new(f"noise_{noise:.2f}", "CLOUDS")
            tex.noise_scale = noise
        mod = obj.modifiers.new("Disp", "DISPLACE")
        mod.texture = tex
        mod.strength = displace
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def parent_to(child, parent):
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def shift_origin(obj, world_point):
    delta = Vector(world_point) - obj.location
    for vert in obj.data.vertices:
        vert.co -= delta
    obj.location += delta


def empty(name, location):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.05
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------------------
# materials
# ---------------------------------------------------------------------------

IMAGES = {}


def save_image(name, rgb, noncolor=False):
    height, width, _channels = rgb.shape
    image = bpy.data.images.new(name, width, height, alpha=False, float_buffer=True)
    flipped = np.flipud(rgb)
    alpha = np.ones((height, width, 1), dtype=np.float32)
    buf = np.concatenate([flipped, alpha], axis=2).astype(np.float32)
    image.pixels.foreach_set(buf.ravel())
    image.filepath_raw = os.path.join(TEX_DIR, f"{name}.png")
    image.file_format = "PNG"
    image.save()
    image.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"
    IMAGES[name] = image
    return image


def noise_grid(width, height, freq, octaves, seed):
    ys = np.linspace(0, freq, height, endpoint=False)
    xs = np.linspace(0, freq, width, endpoint=False)
    acc = np.zeros((height, width), dtype=np.float32)
    norm = 0.0
    amp = 1.0
    f = 1.0
    for octave in range(octaves):
        xf = xs * f
        yf = ys * f
        x0 = np.floor(xf).astype(np.int32)
        y0 = np.floor(yf).astype(np.int32)
        fx = xf - x0
        fy = yf - y0
        sx = (fx * fx * (3 - 2 * fx)).astype(np.float32)
        sy = (fy * fy * (3 - 2 * fy)).astype(np.float32)
        x0m = x0 % 1024
        y0m = y0 % 1024

        def at(ix, iy):
            return (hash_grid(ix, iy, seed + octave * 19)).astype(np.float32)

        n00 = at(x0m[None, :], y0m[:, None])
        n10 = at((x0m + 1)[None, :], y0m[:, None])
        n01 = at(x0m[None, :], (y0m + 1)[:, None])
        n11 = at((x0m + 1)[None, :], (y0m + 1)[:, None])
        nx0 = n00 * (1 - sx)[None, :] + n10 * sx[None, :]
        nx1 = n01 * (1 - sx)[None, :] + n11 * sx[None, :]
        acc += amp * (nx0 * (1 - sy)[:, None] + nx1 * sy[:, None])
        norm += amp
        amp *= 0.5
        f *= 2.03
    return acc / norm


def hash_grid(ix, iy, seed):
    # vectorized 32-bit hash
    n = (ix.astype(np.uint32) * np.uint32(374761393) + iy.astype(np.uint32) * np.uint32(668265263) + np.uint32(seed) * np.uint32(1440662689))
    n = (n ^ (n >> np.uint32(13))) * np.uint32(1274126177)
    n = n ^ (n >> np.uint32(16))
    return (n.astype(np.float32) / np.float32(4294967295.0))


def normals_from(height, strength):
    gy, gx = np.gradient(height.astype(np.float32))
    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(height, dtype=np.float32)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack(((nx / length) * 0.5 + 0.5, (ny / length) * 0.5 + 0.5, (nz / length) * 0.5 + 0.5), axis=-1)
    return rgb.astype(np.float32)


def build_textures():
    if np is None:
        raise RuntimeError("numpy is required")
    size = 512
    ground_w = 1024
    cloth_h = noise_grid(size, size, 6, 5, 3)
    fiber = noise_grid(size, size, 22, 3, 4)
    slub = noise_grid(size, size, 3.2, 4, 8)
    cloth = np.clip(0.38 + (cloth_h - 0.5) * 0.34 + (fiber - 0.5) * 0.08 + (slub - 0.5) * 0.12, 0, 1)
    stain = np.clip((noise_grid(size, size, 2.2, 3, 9) - 0.62) / 0.25, 0, 1)
    cloth = np.clip(cloth * (1 - stain * 0.28), 0, 1)
    cloth_rgb = np.dstack([cloth * 1.02, cloth * 0.97, cloth * 0.9]).astype(np.float32)
    save_image("cloth", cloth_rgb)
    save_image("cloth_n", normals_from(cloth_h, 4.5), True)
    rough = np.clip(0.72 + (1 - cloth_h) * 0.22, 0, 1)
    save_image("cloth_r", np.dstack([rough, rough, rough]).astype(np.float32), True)

    metal_h = noise_grid(size, size, 10, 4, 11)
    scratch = np.clip(noise_grid(size, size, 40, 2, 13) - 0.55, 0, 1) ** 2
    scratch += np.clip(noise_grid(size, size, 18, 2, 14) - 0.72, 0, 1)
    metal = np.clip(0.48 + (metal_h - 0.5) * 0.4 - scratch * 0.22, 0, 1)
    save_image("metal", np.dstack([metal, metal, metal * 0.96]).astype(np.float32))
    save_image("metal_n", normals_from(metal_h - scratch * 0.15, 6.0), True)
    mrough = np.clip(0.34 + scratch * 0.45 + (1 - metal_h) * 0.15, 0.18, 0.95)
    save_image("metal_r", np.dstack([mrough, mrough, mrough]).astype(np.float32), True)

    skin_h = noise_grid(size, size, 7, 5, 21)
    pores = noise_grid(size, size, 28, 2, 22)
    skin = np.clip(0.72 + (skin_h - 0.5) * 0.16 + (pores - 0.5) * 0.05, 0, 1)
    skin_rgb = np.dstack([
        skin * 0.93 + 0.05,
        skin * 0.66 + 0.03,
        skin * 0.5 + 0.02,
    ]).astype(np.float32)
    save_image("skin", skin_rgb)
    save_image("skin_n", normals_from(skin_h * 0.6 + pores * 0.25, 3.2), True)
    srough = np.clip(0.48 + (1 - skin_h) * 0.2, 0, 1)
    save_image("skin_r", np.dstack([srough, srough, srough]).astype(np.float32), True)

    leather_h = noise_grid(size, size, 8, 4, 31)
    leather = np.clip(0.38 + (leather_h - 0.5) * 0.3, 0, 1)
    save_image("leather", np.dstack([leather, leather * 0.9, leather * 0.75]).astype(np.float32))
    save_image("leather_n", normals_from(leather_h, 5.0), True)
    lrough = np.clip(0.55 + (1 - leather_h) * 0.3, 0, 1)
    save_image("leather_r", np.dstack([lrough, lrough, lrough]).astype(np.float32), True)

    stone_h = noise_grid(ground_w, ground_w, 5, 5, 41)
    pits = noise_grid(ground_w, ground_w, 18, 3, 42)
    stone = np.clip(0.55 + (stone_h - 0.5) * 0.35 - np.clip(pits - 0.72, 0, 1) * 0.5, 0, 1)
    save_image("stone", np.dstack([stone, stone * 0.96, stone * 0.9]).astype(np.float32))
    save_image("stone_n", normals_from(stone_h - np.clip(pits - 0.7, 0, 1), 5.5), True)
    strough = np.clip(0.78 + pits * 0.15, 0, 1)
    save_image("stone_r", np.dstack([strough, strough, strough]).astype(np.float32), True)

    # Irregular earth. Clearing is a warped blob, never a circle. No rings.
    xs = np.linspace(-1, 1, ground_w, dtype=np.float32)
    ys = np.linspace(-1, 1, ground_w, dtype=np.float32)
    xx, yy = np.meshgrid(xs, ys)
    warp = noise_grid(ground_w, ground_w, 3.5, 5, 51)
    warp2 = noise_grid(ground_w, ground_w, 3.5, 5, 67)
    earth_n = noise_grid(ground_w, ground_w, 4.2, 6, 53)
    fine = noise_grid(ground_w, ground_w, 16, 3, 59)
    peb = noise_grid(ground_w, ground_w, 26, 2, 61)
    dist = np.sqrt((xx + (warp - 0.5) * 0.55) ** 2 + (yy + (warp2 - 0.5) * 0.55) ** 2)
    clearing = np.clip((0.62 - dist) / 0.4, 0, 1) * np.clip((warp - 0.35) * 1.6, 0, 1) * 0.4
    soil_a = np.array([0.34, 0.22, 0.13], dtype=np.float32)
    soil_b = np.array([0.48, 0.34, 0.2], dtype=np.float32)
    moss_c = np.array([0.22, 0.28, 0.14], dtype=np.float32)
    packed = np.array([0.4, 0.3, 0.2], dtype=np.float32)
    earth = soil_a[None, None, :] * (1 - earth_n[..., None]) + soil_b[None, None, :] * earth_n[..., None]
    moss = np.clip((warp - 0.58) / 0.2, 0, 1) * (1 - clearing * 0.8)
    earth = earth * (1 - moss[..., None]) + moss_c * moss[..., None]
    earth = earth * (1 - clearing[..., None] * 0.35) + packed * (clearing[..., None] * 0.35)
    pebble = np.clip((peb - 0.86) / 0.08, 0, 1)
    earth = earth * (1 - pebble[..., None] * 0.22) + np.array([0.5, 0.45, 0.36]) * (pebble[..., None] * 0.22)
    # worn tracks: domain-warped sine, broken, not circular
    track = np.sin((xx * 3.2 + warp * 2.4) * math.pi) 
    track = np.clip(1 - np.abs(track) * (4.5 + fine * 3), 0, 1) * np.clip(1 - np.abs(yy) * 1.4, 0, 1)
    track2 = np.sin((yy * 2.6 + warp2 * 2.1) * math.pi)
    track2 = np.clip(1 - np.abs(track2) * 5.0, 0, 1) * np.clip(1 - np.abs(xx + 0.2) * 1.6, 0, 1)
    tracks = np.clip(track * 0.65 + track2 * 0.45, 0, 1)
    damp = np.array([0.24, 0.16, 0.1], dtype=np.float32)
    earth = earth * (1 - tracks[..., None] * 0.35) + damp * (tracks[..., None] * 0.35)
    earth = np.clip(earth + (fine[..., None] - 0.5) * 0.05, 0, 1).astype(np.float32)
    save_image("earth", earth)
    height = (earth_n * 0.55 + fine * 0.2 - tracks * 0.18 - clearing * 0.05).astype(np.float32)
    save_image("earth_n", normals_from(height, 7.5), True)
    er = np.clip(0.86 - tracks * 0.25 + pebble * 0.1, 0.35, 1)
    save_image("earth_r", np.dstack([er, er, er]).astype(np.float32), True)

    # sky: soft cloud bands, no disc moon
    sky_h = 512
    sky_w = 256
    sky_n = noise_grid(sky_w, sky_h, 3.0, 5, 71)
    grad = np.linspace(0, 1, sky_h, dtype=np.float32)[:, None]
    top = np.array([0.05, 0.06, 0.09])
    mid = np.array([0.36, 0.28, 0.24])
    low = np.array([0.16, 0.12, 0.1])
    sky = top * (1 - grad[..., None]) + mid * np.clip(1 - np.abs(grad - 0.62) * 3.2, 0, 1)[..., None]
    sky = sky + low * np.clip((grad - 0.75) / 0.25, 0, 1)[..., None]
    cloud = np.clip((sky_n - 0.52) / 0.3, 0, 1) * np.clip(1 - np.abs(grad - 0.48) * 2.4, 0, 1)
    sky = np.clip(sky + cloud[..., None] * np.array([0.55, 0.5, 0.46]), 0, 1).astype(np.float32)
    # save via PIL-less path already used; also write a copy the game samples directly
    save_image("sky", sky)
    sky_path = os.path.join(OUT, "sky.png")
    IMAGES["sky"].save()
    # image.filepath already set; copy pixels by resaving
    import shutil
    IMAGES["sky"].filepath_raw = sky_path
    IMAGES["sky"].save()
    save_image("ink", np.full((16, 16, 3), 0.015, dtype=np.float32))
    save_image("ink_n", normals_from(np.zeros((16, 16), dtype=np.float32), 1.0), True)
    save_image("ink_r", np.full((16, 16, 3), 0.35, dtype=np.float32), True)
    print("textures ready", flush=True)


def principled(name, color, metallic, roughness, emission=0.0, double=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = not double
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission > 0:
        bsdf.inputs["Emission Color"].default_value = (1, 1, 1, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


MATS = {}


def mats():
    if MATS:
        return MATS
    MATS["Skin"] = principled("Skin", (0.78, 0.58, 0.46), 0.0, 0.55)
    MATS["Cloth"] = principled("Cloth", (0.82, 0.8, 0.76), 0.0, 0.86, double=True)
    MATS["Leather"] = principled("Leather", (0.55, 0.4, 0.28), 0.04, 0.62)
    MATS["Plate"] = principled("Plate", (0.78, 0.78, 0.76), 0.72, 0.38)
    MATS["Metal"] = principled("Metal", (0.84, 0.84, 0.82), 0.92, 0.32)
    MATS["Trim"] = principled("Trim", (0.9, 0.9, 0.86), 0.8, 0.28, emission=0.65)
    MATS["Ink"] = principled("Ink", (0.02, 0.015, 0.014), 0.02, 0.4)
    MATS["Stone"] = principled("Stone", (0.62, 0.58, 0.52), 0.02, 0.86)
    MATS["Earth"] = principled("Earth", (0.72, 0.66, 0.56), 0.0, 0.92)
    MATS["Foliage"] = principled("Foliage", (0.42, 0.52, 0.24), 0.0, 0.8, double=True)
    MATS["Wood"] = principled("Wood", (0.42, 0.28, 0.16), 0.0, 0.72)
    MATS["Well"] = principled("Well", (0.15, 0.18, 0.16), 0.1, 0.25, emission=0.35)
    return MATS


# ---------------------------------------------------------------------------
# characters
# ---------------------------------------------------------------------------

def role_params(family, role):
    rng = random.Random(f"{family}:{role}")
    p = {
        "bulk": 1.0,
        "height": 1.0,
        "shoulder": 1.0,
        "cape": 0.9,
        "robe": 0.45,
        "plate": 0.65,
        "hood": 0.0,
        "hair": 0.4,
        "pauldron": 0.7,
    }
    table = {
        "ruler": dict(bulk=0.98, height=1.05, shoulder=1.06, cape=1.2, robe=0.78, plate=0.8, hood=0.05, hair=0.7, pauldron=0.85),
        "soldier": dict(bulk=1.02, height=1.0, shoulder=1.14, cape=0.62, robe=0.36, plate=0.78, hood=0.0, hair=0.15, pauldron=1.0),
        "skirmisher": dict(bulk=0.86, height=1.02, shoulder=0.9, cape=0.5, robe=0.42, plate=0.22, hood=0.92, hair=0.2, pauldron=0.25),
        "brute": dict(bulk=1.26, height=0.99, shoulder=1.34, cape=0.72, robe=0.52, plate=1.0, hood=0.0, hair=0.0, pauldron=1.05),
        "mystic": dict(bulk=0.9, height=1.04, shoulder=0.82, cape=0.22, robe=1.05, plate=0.08, hood=1.0, hair=0.1, pauldron=0.05),
    }
    p.update(table[role])
    if family == "grove":
        p["plate"] *= 0.4
        p["robe"] = max(p["robe"], 0.55)
        p["bulk"] *= 0.96
    elif family == "foundry":
        p["plate"] = min(1.15, p["plate"] + 0.15)
        p["bulk"] *= 1.06
    elif family == "observatory":
        p["bulk"] *= 0.92
        p["height"] *= 1.03
        p["cape"] *= 1.08
    elif family == "monolith":
        p["shoulder"] *= 1.08
        p["cape"] *= 1.12
        p["bulk"] *= 1.04
    elif family == "basilica":
        p["plate"] = min(1.1, p["plate"] + 0.08)
    p["rng"] = rng
    return p


def build_figure(family, role):
    p = role_params(family, role)
    rng = p["rng"]
    m = mats()
    bulk = p["bulk"]
    height = p["height"]
    shoulder = p["shoulder"]
    parts = []

    def z(value):
        return value * height

    # --- torso (athletic, not a capsule) ---
    torso_z = [0.78, 0.9, 1.02, 1.16, 1.28, 1.4, 1.5, 1.56]
    torso_r = [
        (0.09, 0.08),
        (0.155, 0.11),
        (0.125, 0.092),
        (0.15, 0.108),
        (0.168, 0.125),
        (0.2 * shoulder, 0.112),
        (0.072, 0.062),
        (0.055, 0.05),
    ]
    torso_pts = []
    torso_rad = []
    for i, (zz, rad) in enumerate(zip(torso_z, torso_r)):
        sway = 0.012 * math.sin(i)  # slight contrapposto
        torso_pts.append(Vector((sway * bulk, -0.01 * i, z(zz))))
        torso_rad.append((rad[0] * bulk, rad[1] * bulk))
    # chest front bias stored by pushing the -Y side after the fact via a second thinner plate
    body = tube("Body", torso_pts, torso_rad, sides=16, caps=True)
    parts.append(finish(body, m["Skin"], sub=1, displace=0.0035, noise=0.18))

    # legs, slightly bent, not mannequin sticks
    grip = Vector((-0.22 * bulk, -0.2, z(0.98)))
    for side, sign in (("L", 1), ("R", -1)):
        hip = Vector((sign * 0.09 * bulk, 0.0, z(0.9)))
        knee = Vector((sign * 0.105 * bulk, -0.03 if sign > 0 else 0.045, z(0.5)))
        ankle = Vector((sign * 0.11 * bulk, 0.02 if sign > 0 else -0.015, z(0.08)))
        pts = curve_points(hip, knee, Vector((sign * 0.02, -0.02, 0)), 4, rng)
        pts += curve_points(knee, ankle, Vector((sign * 0.01, 0.02, 0)), 4, rng)[1:]
        rads = []
        for i, _pt in enumerate(pts):
            t = i / (len(pts) - 1)
            rx = lerp(0.085, 0.042, t) * bulk
            ry = lerp(0.09, 0.048, t) * bulk
            if 0.35 < t < 0.55:
                ry *= 1.12  # knee
            if 0.62 < t < 0.8:
                ry *= 1.18  # calf
            rads.append((rx, ry))
        leg = tube(f"Leg{side}", pts, rads, sides=12, caps=True)
        parts.append(finish(leg, m["Skin"] if p["robe"] < 0.7 else m["Cloth"], sub=1, displace=0.002, noise=0.2))
        # boot
        heel = Vector((ankle.x, ankle.y + 0.04, z(0.045)))
        toe = Vector((ankle.x + sign * 0.01, ankle.y - 0.16, z(0.05)))
        boot_pts = curve_points(heel, toe, Vector((0, 0, 0.02), ), 5, rng)
        boot_r = [(0.055 * bulk, 0.048), (0.06 * bulk, 0.05), (0.058 * bulk, 0.055), (0.05 * bulk, 0.04), (0.038 * bulk, 0.028)]
        boot = tube(f"Boot{side}", boot_pts, boot_r, sides=10, caps=True)
        parts.append(finish(boot, m["Leather"], sub=1, displace=0.004, noise=0.22))
        # breeches so the leg isn't a bare mannequin
        b_top = Vector((hip.x, hip.y - 0.02, hip.z - 0.02))
        b_low = Vector((knee.x, knee.y, knee.z - 0.02))
        bpts = curve_points(b_top, b_low, Vector((sign * 0.01, -0.02, 0)), 4, rng)
        brads = [(0.105 * bulk, 0.1 * bulk), (0.09 * bulk, 0.085 * bulk), (0.075 * bulk, 0.07 * bulk), (0.062 * bulk, 0.058 * bulk)]
        breech = tube(f"Breech{side}", bpts, brads, sides=10, caps=False)
        parts.append(finish(breech, m["Cloth"], solid=0.008, sub=1, displace=0.003, noise=0.2))

    # arms + gauntlets / hands
    for side, sign in (("L", 1), ("R", -1)):
        sho = Vector((sign * 0.18 * shoulder * bulk, -0.02, z(1.38)))
        if sign < 0:
            elb = Vector((sign * 0.34 * bulk, -0.12, z(1.12)))
            wri = Vector((sign * 0.24 * bulk, -0.22, z(0.98)))
        else:
            elb = Vector((sign * 0.32 * bulk, -0.06, z(1.08)))
            wri = Vector((sign * 0.2 * bulk, -0.14, z(0.9)))
        pts = curve_points(sho, elb, Vector((sign * 0.04, -0.04, 0.02)), 4, rng)
        pts += curve_points(elb, wri, Vector((sign * 0.02, -0.05, -0.02)), 4, rng)[1:]
        rads = []
        for i in range(len(pts)):
            t = i / (len(pts) - 1)
            rads.append((lerp(0.07, 0.032, t) * bulk, lerp(0.065, 0.03, t) * bulk))
        arm_mat = m["Skin"] if p["plate"] < 0.5 or sign > 0 else m["Cloth"]
        arm = tube(f"Arm{side}", pts, rads, sides=12, caps=True)
        parts.append(finish(arm, arm_mat, sub=1, displace=0.002, noise=0.16))
        # hand or gauntlet
        direction = (wri - elb).normalized()
        if p["plate"] > 0.35 and role != "mystic":
            cuff = wri - direction * 0.02
            mitt = wri + direction * 0.09
            gpts = [cuff, wri + direction * 0.03, mitt]
            grads = [(0.048 * bulk, 0.04), (0.04 * bulk, 0.028), (0.034 * bulk, 0.02)]
            gaunt = tube(f"Gaunt{side}", gpts, grads, sides=10, caps=True)
            parts.append(finish(gaunt, m["Plate"], sub=1, displace=0.003, noise=0.12))
            # thumb
            thumb_end = mitt + Vector((sign * -0.03, -0.04, 0.02))
            thumb = tube(f"Thumb{side}", [mitt, thumb_end], [(0.016, 0.014), (0.012, 0.01)], sides=8, caps=True)
            parts.append(finish(thumb, m["Plate"], sub=1))
        else:
            palm = wri + direction * 0.06
            hand = tube(f"Hand{side}", [wri, palm], [(0.03, 0.016), (0.028, 0.012)], sides=8, caps=True)
            parts.append(finish(hand, m["Skin"], sub=1))
            for finger in range(3):
                spread = (finger - 1) * 0.018 * sign
                tip = palm + direction * 0.055 + Vector((spread, -0.01, 0.0))
                fin = tube(
                    f"Fin{side}{finger}",
                    [palm + Vector((spread * 0.3, 0, 0)), tip],
                    [(0.01, 0.008), (0.007, 0.006)],
                    sides=6,
                    caps=True,
                )
                parts.append(finish(fin, m["Skin"], sub=0))
        if sign < 0:
            grip = wri + direction * 0.04

    # head
    head_keys = [
        (1.545, 0.05, 0.046, 0.0),
        (1.575, 0.068, 0.058, 0.01),
        (1.61, 0.076, 0.066, 0.028),
        (1.645, 0.078, 0.07, 0.046),
        (1.675, 0.08, 0.078, 0.012),
        (1.71, 0.078, 0.08, 0.006),
        (1.75, 0.055, 0.06, 0.0),
        (1.78, 0.02, 0.022, 0.0),
    ]
    hpts = []
    hrads = []
    for zz, rx, ry, _front in head_keys:
        hpts.append(Vector((0.0, -0.01, z(zz))))
        hrads.append((rx * (0.96 + 0.04 * bulk), ry))
    head = tube("Head", hpts, hrads, sides=16, caps=True)
    # push a nose ridge and sink eye sockets on the finished mesh
    finish(head, m["Skin"], sub=1, displace=0.002, noise=0.12)
    for vert in head.data.vertices:
        local = vert.co
        # front is -Y
        if local.z > z(1.6) and local.z < z(1.68) and local.y < -0.03:
            # nose
            if abs(local.x) < 0.02:
                vert.co.y -= 0.018 * max(0.0, 1 - abs(local.z - z(1.64)) / 0.04)
        if z(1.66) < local.z < z(1.71) and 0.02 < abs(local.x) < 0.055 and local.y < -0.02:
            vert.co.y += 0.012  # socket back into the skull
    parts.append(head)
    # eyes
    for sign in (1, -1):
        eye_loc = Vector((sign * 0.032, -0.07, z(1.685)))
        eye = tube(
            f"Eye{sign}",
            [eye_loc + Vector((0, 0.004, 0)), eye_loc + Vector((0, -0.008, 0))],
            [(0.011, 0.008), (0.008, 0.006)],
            sides=8,
            caps=True,
        )
        parts.append(finish(eye, m["Ink"], sub=1))
    # ears
    for sign in (1, -1):
        root = Vector((sign * 0.07, 0.0, z(1.67)))
        tip = Vector((sign * 0.098, 0.01, z(1.66)))
        ear = tube(f"Ear{sign}", [root, tip], [(0.02, 0.012), (0.012, 0.006)], sides=7, caps=True)
        parts.append(finish(ear, m["Skin"], sub=1))

    # hair mass when the face is exposed
    if p["hair"] > 0.2 and p["hood"] < 0.5:
        def hair_sample(_iu, _iv, u, v):
            ang = math.pi * (0.15 + 0.7 * u)  # back and sides, not the face
            # ang 0 would be... use around +Y back
            a = math.pi * 0.35 + u * math.pi * 1.3
            rad = 0.09 + 0.01 * math.sin(u * 9) * (1 - v)
            zz = z(lerp(1.78, 1.5 - 0.08 * (u - 0.5) ** 2, v))
            x = math.cos(a) * rad
            y = math.sin(a) * rad * 0.85 + 0.01
            # ragged tips
            if v > 0.75:
                zz -= 0.02 * math.sin(u * 18)
            return Vector((x, y, zz))

        hair = grid_surface("Hair", 8, 14, hair_sample)
        parts.append(finish(hair, m["Ink"], solid=0.008, sub=1, displace=0.003, noise=0.2))

    # hood
    if p["hood"] > 0.4:
        def hood_sample(_iu, _iv, u, v):
            gap = 0.42 + v * 0.45
            a = -math.pi + gap + u * (math.tau - gap * 2)
            rad = lerp(0.012, 0.115 * bulk, min(1.0, v * 1.8))
            if v > 0.62:
                rad += 0.03 * (v - 0.62)
            zz = z(lerp(1.83, 1.46, v ** 0.85))
            x = math.sin(a) * rad
            y = -math.cos(a) * rad * 0.92
            if v > 0.8:
                zz -= 0.035 * abs(math.sin(u * 16))
            return Vector((x, y, zz))

        hood = grid_surface("Hood", 10, 18, hood_sample)
        parts.append(finish(hood, m["Cloth"], solid=0.008, sub=1, displace=0.003, noise=0.22))

    # family helm / crown. Irregular on purpose. Grove keeps antlers even under a hood.
    if family == "grove":
        for sign, phase in ((1, 0.2), (-1, 1.4)):
            root_pt = Vector((sign * 0.04, 0.02, z(1.76)))
            direction = Vector((sign * 0.18, 0.05, 0.24))
            grow_antler(parts, m, root_pt, direction, 0.02, 2, rng, f"{sign}")
    if p["hood"] < 0.7 and family != "grove":
        if family == "basilica" and role in ("ruler", "soldier", "brute"):
            band_pts = []
            steps = 18
            for i in range(steps):
                a = math.tau * i / steps
                band_pts.append(Vector((math.cos(a) * 0.09, math.sin(a) * 0.1 - 0.01, z(1.74))))
            # open ring via a tube along the loop (duplicate first at end)
            band_pts.append(band_pts[0])
            rad = [(0.012 + 0.004 * math.sin(i), 0.01) for i in range(len(band_pts))]
            band = tube("CrownBand", band_pts, rad, sides=7, caps=False)
            parts.append(finish(band, m["Trim"], sub=1))
            tines = 5 if role == "ruler" else 3
            for i in range(tines):
                a = -0.9 + i * (1.8 / max(1, tines - 1))
                base = Vector((math.sin(a) * 0.08, -math.cos(a) * 0.07 - 0.02, z(1.75)))
                tilt = rng.uniform(-0.04, 0.05)
                top = base + Vector((tilt, -0.02, z(0.16 + rng.uniform(0, 0.1) if role == "ruler" else 0.08)))
                tine = tube(f"Tine{i}", curve_points(base, top, Vector((tilt, 0.02, 0)), 4, rng), [(0.014, 0.01), (0.012, 0.008), (0.008, 0.006), (0.003, 0.003)], sides=6, caps=True)
                parts.append(finish(tine, m["Trim"], sub=1))
        elif family == "foundry" and role != "mystic":
            # half-mask, asymmetrical, beaten plate
            def mask_sample(_iu, _iv, u, v):
                a = -0.7 + u * 1.4
                rad = 0.085
                zz = z(lerp(1.74, 1.58, v))
                x = math.sin(a) * rad
                y = -0.06 - math.cos(a) * 0.02
                if v > 0.45 and abs(u - 0.5) < 0.18:
                    y -= 0.02  # nose ridge
                return Vector((x, y, zz))

            mask = grid_surface("Mask", 6, 10, mask_sample)
            parts.append(finish(mask, m["Plate"], solid=0.008, sub=1, displace=0.004, noise=0.15))
        elif family == "monolith" and role in ("ruler", "soldier", "brute"):
            def brow_sample(_iu, _iv, u, v):
                a = -1.1 + u * 2.2
                zz = z(1.74 - v * 0.06)
                x = math.sin(a) * 0.09
                y = -0.04 - 0.03 * math.cos(a) + v * 0.01
                return Vector((x * bulk, y, zz))

            brow = grid_surface("Brow", 4, 12, brow_sample)
            parts.append(finish(brow, m["Stone"], solid=0.016, sub=1, displace=0.006, noise=0.3))
        elif family == "observatory" and role == "ruler":
            band_pts = []
            for i in range(20):
                a = math.tau * i / 20
                band_pts.append(Vector((math.cos(a) * 0.086, math.sin(a) * 0.095 - 0.01, z(1.76 + 0.01 * math.sin(a * 3)))))
            band_pts.append(band_pts[0])
            band = tube("Circlet", band_pts, [(0.008, 0.006)] * len(band_pts), sides=6, caps=False)
            parts.append(finish(band, m["Trim"], sub=1))

    # robe / tunic shell with folds
    if p["robe"] > 0.12:
        hem = lerp(1.15, 0.42, min(1.0, p["robe"]))

        def robe_sample(_iu, iv, u, v):
            a = -math.pi + u * math.tau
            # open a little at the front for tunics
            openness = 0.18 if p["robe"] < 0.7 else 0.05
            a = -math.pi + openness + u * (math.tau - openness * 2)
            body_r = lerp(0.18 * bulk, 0.16 * bulk, v) * (1 + 0.08 * math.sin(a * 2))
            fold = math.sin(u * math.tau * (5 if p["robe"] > 0.6 else 4) + v * 2.0)
            fold_amp = 0.012 + 0.02 * v * p["robe"]
            rad = body_r + 0.03 + fold * fold_amp
            zz = z(lerp(1.42, hem, v))
            # heavier hem, slightly behind
            zz -= 0.02 * (v ** 2)
            x = math.sin(a) * rad
            y = -math.cos(a) * rad * 0.82 + 0.02 * v
            if iv % 5 == 0:
                rad *= 0.97
                x = math.sin(a) * rad
            return Vector((x, y, zz))

        robe = grid_surface("Robe", 14, 22, robe_sample)
        parts.append(finish(robe, m["Cloth"], solid=0.01, sub=1, displace=0.004, noise=0.28))

    # chest plate
    if p["plate"] > 0.25:
        def plate_sample(_iu, _iv, u, v):
            a = -0.85 + u * 1.7
            zz = z(lerp(1.42, 1.05, v))
            rad = (0.175 + 0.02 * math.sin(v * math.pi)) * bulk * (0.85 + 0.15 * p["plate"])
            x = math.sin(a) * rad
            y = -0.02 - math.cos(a) * 0.11 * bulk - 0.02 * math.sin(v * math.pi)
            # center ridge
            if abs(u - 0.5) < 0.06:
                y -= 0.012
            return Vector((x, y, zz))

        plate = grid_surface("Plate", 8, 12, plate_sample)
        parts.append(finish(plate, m["Plate"], solid=0.01, sub=1, displace=0.0035, noise=0.16))
        # belt, slightly uneven
        belt_pts = []
        for i in range(16):
            a = math.tau * i / 16
            radx = 0.15 * bulk * (1 + 0.04 * math.sin(a * 3))
            rady = 0.115 * bulk
            belt_pts.append(Vector((math.sin(a) * radx, -math.cos(a) * rady, z(1.02 + 0.01 * math.sin(a * 2)))))
        belt_pts.append(belt_pts[0])
        belt = tube("Belt", belt_pts, [(0.016, 0.012)] * len(belt_pts), sides=6, caps=False)
        parts.append(finish(belt, m["Leather"], sub=0, displace=0.002, noise=0.1))

    # pauldrons, the weapon-side one larger and higher
    if p["pauldron"] > 0.2:
        for sign in (1, -1):
            scale = p["pauldron"] * (1.25 if sign < 0 else 0.8)

            def paul_sample(_iu, _iv, u, v, sign=sign, scale=scale):
                a = -0.4 + u * 1.5
                b = -0.2 + v * 1.1
                rx = 0.09 * scale
                ry = 0.07 * scale
                x = sign * (0.2 * shoulder * bulk) + math.sin(a) * rx
                zpos = z(1.42) + math.cos(b) * ry * 0.5
                y = -0.02 + math.sin(b) * 0.04 - abs(math.sin(a)) * 0.02
                return Vector((x, y, zpos))

            paul = grid_surface(f"Paul{sign}", 6, 8, paul_sample)
            parts.append(finish(paul, m["Plate"] if p["plate"] > 0.3 else m["Leather"], solid=0.01, sub=1, displace=0.004, noise=0.2))

    # cape
    cape_len = 0.35 + 0.85 * min(1.2, p["cape"])

    def cape_sample(_iu, _iv, u, v):
        width = lerp(0.16, 0.34, min(1, v * 1.1)) * (0.85 + 0.2 * p["cape"])
        x = (u - 0.5) * 2 * width * bulk
        fold = math.sin(u * math.pi * 6) * (0.01 + 0.025 * v)
        y = 0.08 + v * 0.16 + fold
        zz = z(1.45) - v * z(cape_len)
        # tattered hem
        if v > 0.9:
            zz += 0.04 * math.sin(u * 23)
            x *= 1 + 0.04 * math.sin(u * 17)
        return Vector((x, y, zz))

    cape = grid_surface("Cape", 16, 14, cape_sample)
    finish(cape, m["Cloth"], solid=0.008, sub=1, displace=0.004, noise=0.3)
    shoulder_pt = Vector((0.0, 0.1, z(1.46)))
    shift_origin(cape, shoulder_pt)
    parts.append(cape)

    # observatory veil, extra long cloth down the back
    if family == "observatory" and role in ("ruler", "mystic"):
        def veil_sample(_iu, _iv, u, v):
            x = (u - 0.5) * lerp(0.12, 0.2, v)
            y = 0.1 + v * 0.12 + math.sin(u * 12) * 0.008 * v
            zz = z(1.7) - v * z(1.15)
            return Vector((x, y, zz))

        veil = grid_surface("Veil", 12, 8, veil_sample)
        finish(veil, m["Cloth"], solid=0.006, sub=1, displace=0.003, noise=0.2)
        shift_origin(veil, Vector((0, 0.08, z(1.72))))
        parts.append(veil)

    bpy.ops.object.mode_set(mode="OBJECT")
    root = empty("Figure", (0, 0, 0))
    for part in parts:
        parent_to(part, root)
    grip_empty = empty("Grip", grip)
    grip_empty["is_grip"] = 1
    parent_to(grip_empty, root)
    bpy.context.view_layer.update()
    # ground the figure so the lowest vertex sits on z=0
    low = min((child.matrix_world @ vert.co).z for child in root.children if child.type == "MESH" for vert in child.data.vertices)
    root.location.z -= low
    cape = next((child for child in root.children if child.name.startswith("Cape")), None)
    veil = next((child for child in root.children if child.name.startswith("Veil")), None)
    if cape is not None and veil is not None:
        parent_to(veil, cape)
    bpy.context.view_layer.update()
    zs = [(child.matrix_world @ vert.co).z for child in root.children if child.type == "MESH" for vert in child.data.vertices]
    if veil is not None:
        zs += [(veil.matrix_world @ vert.co).z for vert in veil.data.vertices]
    print("FIGURE", family, role, "span", round(max(zs) - min(zs), 3), "low", round(min(zs), 3), flush=True)
    return root


def grow_antler(parts, m, start, direction, radius, depth, rng, tag):
    if depth < 0 or radius < 0.004:
        return
    end = start + direction
    bend = Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.02, 0.04), rng.uniform(-0.02, 0.06)))
    pts = curve_points(start, end, bend, 4, rng)
    rads = [(radius * (1 - 0.22 * i), radius * 0.8 * (1 - 0.22 * i)) for i in range(len(pts))]
    ant = tube(f"Antler{tag}{depth}{rng.randrange(99)}", pts, rads, sides=7, caps=True)
    parts.append(finish(ant, m["Wood"], sub=1, displace=0.002, noise=0.1))
    if depth == 0:
        return
    for i, sign in enumerate((1, -1)):
        child_dir = (direction * 0.62) + Vector((sign * radius * 6, 0.02, 0.05))
        child_dir.z += 0.04
        grow_antler(parts, m, pts[2], child_dir, radius * 0.62, depth - 1, rng, f"{tag}{i}")


def export_hierarchy(root, path):
    bpy.ops.object.select_all(action="DESELECT")

    def walk(obj):
        obj.select_set(True)
        for child in obj.children:
            walk(child)

    walk(root)
    bpy.context.view_layer.objects.active = root
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    print("exported", path, flush=True)


def delete_hierarchy(root):
    bpy.ops.object.select_all(action="DESELECT")

    def walk(obj):
        obj.select_set(True)
        for child in list(obj.children):
            walk(child)

    walk(root)
    bpy.ops.object.delete(use_global=False)


# ---------------------------------------------------------------------------
# weapons
# ---------------------------------------------------------------------------

def build_weapon(kind):
    m = mats()
    rng = random.Random(kind)
    parts = []
    if kind == "blade":
        shaft = tube("GripWrap", [Vector((0, 0, 0)), Vector((0, 0, 0.22))], [(0.018, 0.016), (0.02, 0.016)], sides=8, caps=True)
        parts.append(finish(shaft, m["Leather"], sub=1))
        blade = tube(
            "Edge",
            [Vector((0, 0, 0.18)), Vector((0, -0.01, 0.55)), Vector((0.0, -0.004, 0.92))],
            [(0.04, 0.008), (0.055, 0.006), (0.004, 0.003)],
            sides=8,
            caps=True,
        )
        parts.append(finish(blade, m["Trim"], sub=1, displace=0.002, noise=0.05))
        guard = tube("Guard", [Vector((-0.07, 0, 0.2)), Vector((0.07, 0, 0.2))], [(0.012, 0.016), (0.012, 0.016)], sides=7, caps=True)
        parts.append(finish(guard, m["Metal"], sub=1))
    elif kind == "glaive":
        shaft = tube("Shaft", [Vector((0, 0, -0.15)), Vector((0, 0, 0.7))], [(0.016, 0.016), (0.018, 0.016)], sides=8, caps=True)
        parts.append(finish(shaft, m["Wood"], sub=1, displace=0.002, noise=0.2))
        blade = tube(
            "Edge",
            [Vector((0, 0, 0.62)), Vector((0.01, -0.02, 0.95)), Vector((0.03, -0.01, 1.25))],
            [(0.03, 0.008), (0.07, 0.007), (0.008, 0.004)],
            sides=8,
            caps=True,
        )
        parts.append(finish(blade, m["Trim"], sub=1))
    elif kind == "spear":
        shaft = tube("Shaft", [Vector((0, 0, -0.2)), Vector((0, 0.01, 1.15))], [(0.015, 0.015), (0.016, 0.015)], sides=8, caps=True)
        parts.append(finish(shaft, m["Wood"], sub=1, displace=0.0025, noise=0.25))
        tip = tube(
            "Tip",
            [Vector((0, 0, 1.08)), Vector((0, -0.012, 1.28)), Vector((0, 0, 1.48))],
            [(0.02, 0.012), (0.045, 0.01), (0.004, 0.003)],
            sides=8,
            caps=True,
        )
        parts.append(finish(tip, m["Trim"], sub=1))
    elif kind == "staff":
        pts = curve_points(Vector((0, 0, -0.15)), Vector((0.02, 0.02, 1.25)), Vector((0.04, -0.03, 0)), 8, rng)
        rads = [(0.02 + 0.004 * math.sin(i * 1.7), 0.018) for i in range(len(pts))]
        shaft = tube("Shaft", pts, rads, sides=9, caps=True)
        parts.append(finish(shaft, m["Wood"], sub=1, displace=0.003, noise=0.18))
        head = pts[-1]
        crystal = tube(
            "Head",
            [head + Vector((0, 0, -0.02)), head + Vector((0.01, -0.02, 0.1)), head + Vector((-0.01, 0.01, 0.2))],
            [(0.03, 0.02), (0.045, 0.028), (0.01, 0.008)],
            sides=7,
            caps=True,
        )
        parts.append(finish(crystal, m["Trim"], sub=1, displace=0.004, noise=0.1))
    elif kind == "hammer":
        shaft = tube("Shaft", [Vector((0, 0, -0.1)), Vector((0, 0, 0.72))], [(0.02, 0.018), (0.022, 0.02)], sides=8, caps=True)
        parts.append(finish(shaft, m["Wood"], sub=1, displace=0.003, noise=0.2))
        # worn head: short fat tube, then we'll rely on displace
        head = tube(
            "Head",
            [Vector((-0.12, 0, 0.7)), Vector((0, 0, 0.72)), Vector((0.14, 0.01, 0.69))],
            [(0.05, 0.06), (0.07, 0.08), (0.045, 0.055)],
            sides=10,
            caps=True,
        )
        parts.append(finish(head, m["Plate"], sub=1, displace=0.012, noise=0.2))
    else:  # orb — clustered rough crystal, not a sphere
        shaft = tube("Shaft", [Vector((0, 0, 0)), Vector((0, 0, 0.55))], [(0.016, 0.016), (0.018, 0.016)], sides=8, caps=True)
        parts.append(finish(shaft, m["Metal"], sub=1))
        core = tube(
            "Core",
            [Vector((0, 0, 0.58)), Vector((0.02, -0.02, 0.7)), Vector((-0.01, 0.01, 0.82))],
            [(0.05, 0.04), (0.07, 0.055), (0.03, 0.025)],
            sides=8,
            caps=True,
        )
        parts.append(finish(core, m["Trim"], sub=1, displace=0.01, noise=0.12))
        for i in range(4):
            ang = i * 1.7
            base = Vector((math.sin(ang) * 0.04, math.cos(ang) * 0.03, 0.68))
            tip = base + Vector((math.sin(ang) * 0.06, math.cos(ang) * 0.04, 0.08 + 0.03 * (i % 2)))
            shard = tube(f"Shard{i}", [base, tip], [(0.02, 0.014), (0.004, 0.004)], sides=6, caps=True)
            parts.append(finish(shard, m["Trim"], sub=1))
    root = empty("Weapon", (0, 0, 0))
    for part in parts:
        parent_to(part, root)
    return root


# ---------------------------------------------------------------------------
# realm props + terrain
# ---------------------------------------------------------------------------

def displaced_rock(name, radius, seed, stretch):
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=radius, location=(0, 0, radius * 0.7))
    obj = bpy.context.active_object
    obj.name = name
    for vert in obj.data.vertices:
        n = fbm(vert.co.x * 1.7 + seed, vert.co.y * 1.7, 4, seed) - 0.5
        n += 0.35 * (fbm(vert.co.x * 4.5, vert.co.z * 4.5, 3, seed + 2) - 0.5)
        vert.co += vert.normal * n * radius * 0.85
    obj.scale = stretch
    bpy.ops.object.transform_apply(scale=True)
    # sink so bottom ~ 0
    low = min(v.co.z for v in obj.data.vertices)
    for vert in obj.data.vertices:
        vert.co.z -= low
    return finish(obj, mats()["Stone"], sub=0, displace=0.0)


def build_tree(name, seed):
    rng = random.Random(seed)
    m = mats()
    parts = []
    trunk_h = rng.uniform(1.6, 2.4)
    start = Vector((0, 0, 0))
    end = Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.2, 0.25), trunk_h))
    pts = curve_points(start, end, Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.2, 0.2), 0)), 6, rng)
    rads = [(lerp(0.16, 0.05, i / 5) * rng.uniform(0.85, 1.15), lerp(0.14, 0.045, i / 5)) for i in range(6)]
    trunk = tube("Trunk", pts, rads, sides=10, caps=True)
    parts.append(finish(trunk, m["Wood"], sub=1, displace=0.01, noise=0.35))
    forks = []
    for i in range(6):
        origin = pts[2 + (i % 3)]
        direction = Vector((rng.uniform(-0.9, 0.9), rng.uniform(-0.8, 0.8), rng.uniform(0.45, 1.1)))
        tip = origin + direction
        bpts = curve_points(origin, tip, Vector((rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0.1)), 4, rng)
        rad = 0.04 * rng.uniform(0.7, 1.2)
        br = tube(f"Branch{i}", bpts, [(rad, rad * 0.8), (rad * 0.7, rad * 0.6), (rad * 0.4, rad * 0.35), (0.012, 0.01)], sides=7, caps=True)
        parts.append(finish(br, m["Wood"], sub=0, displace=0.004, noise=0.2))
        forks.append(tip)
    # leaf clumps as torn shells, not cones
    for i, tip in enumerate(forks):
        def leaf_sample(_iu, _iv, u, v, tip=tip, i=i):
            ang = u * math.tau
            rad = 0.15 + 0.22 * (1 - v) * (0.7 + 0.5 * math.sin(ang * 3 + i))
            x = tip.x + math.cos(ang) * rad
            y = tip.y + math.sin(ang) * rad * 0.8
            zz = tip.z + 0.05 - v * 0.28 + 0.05 * math.sin(ang * 4)
            return Vector((x, y, zz))

        clump = grid_surface(f"Leaf{i}", 5, 9, leaf_sample)
        parts.append(finish(clump, m["Foliage"], solid=0.02, sub=1, displace=0.03, noise=0.4))
    root = empty(name, (0, 0, 0))
    for part in parts:
        parent_to(part, root)
    low = min((child.matrix_world @ vert.co).z for child in root.children if child.type == "MESH" for vert in child.data.vertices)
    root.location.z -= min(0.0, low)
    return root


def build_arch():
    parts = []
    for index, x in enumerate((-0.85, 0.92)):
        jamb = displaced_rock(f"Jamb{index}", 0.36, 30 + index, Vector((0.72, 0.88, 2.35)))
        jamb.location.x += x
        parts.append(jamb)
    lintel = displaced_rock("Lintel", 0.26, 33, Vector((2.5, 0.72, 0.48)))
    lintel.location = Vector((0.04, 0.02, 1.95))
    parts.append(lintel)
    rubble = displaced_rock("Rubble", 0.22, 9, Vector((1.3, 1.0, 0.55)))
    rubble.location = Vector((0.15, 0.25, 0.0))
    parts.append(rubble)
    root = empty("Arch", (0, 0, 0))
    for part in parts:
        parent_to(part, root)
    return root


def build_banner():
    rng = random.Random(5)
    m = mats()
    pts = curve_points(Vector((0, 0, 0)), Vector((0.05, 0.02, 2.1)), Vector((0.08, -0.04, 0)), 5, rng)
    pole = tube("Pole", pts, [(0.035, 0.03)] * 3 + [(0.03, 0.025), (0.02, 0.018)], sides=7, caps=True)
    pole = finish(pole, m["Wood"], sub=1, displace=0.003, noise=0.2)

    def cloth_sample(_iu, _iv, u, v):
        x = 0.05 + u * 0.55
        y = 0.02 + math.sin(v * 8 + u * 3) * 0.03 * v
        zz = 1.7 - v * 1.15 + math.sin(u * 9) * 0.03 * v
        if v > 0.85:
            zz += 0.08 * math.sin(u * 20)
        return Vector((x, y, zz))

    cloth = grid_surface("BannerCloth", 12, 7, cloth_sample)
    cloth = finish(cloth, m["Cloth"], solid=0.006, sub=1, displace=0.004, noise=0.2)
    root = empty("Banner", (0, 0, 0))
    parent_to(pole, root)
    parent_to(cloth, root)
    return root


def build_stack():
    rng = random.Random(8)
    m = mats()
    pts = curve_points(Vector((0, 0, 0)), Vector((0.25, -0.1, 2.6)), Vector((0.15, 0.1, 0)), 6, rng)
    rads = [(lerp(0.42, 0.22, i / 5) * (1 + 0.08 * math.sin(i * 2.2)), lerp(0.38, 0.2, i / 5)) for i in range(6)]
    stack = tube("Stack", pts, rads, sides=12, caps=False)
    stack = finish(stack, m["Stone"], sub=1, displace=0.03, noise=0.4)
    # uneven lip
    lip_z = pts[-1].z
    lip = tube(
        "Lip",
        [pts[-1] + Vector((0, 0, -0.05)), pts[-1] + Vector((0.05, 0.02, 0.12))],
        [(0.28, 0.24), (0.2, 0.18)],
        sides=11,
        caps=False,
    )
    lip = finish(lip, m["Stone"], sub=1, displace=0.02, noise=0.3)
    slag = displaced_rock("Slag", 0.45, 4, Vector((1.6, 1.2, 0.55)))
    root = empty("Stack", (0, 0, 0))
    for part in (stack, lip, slag):
        parent_to(part, root)
    return root


def build_spire():
    rng = random.Random(2)
    m = mats()
    pts = curve_points(Vector((0, 0, 0)), Vector((0.1, 0.05, 3.1)), Vector((0.2, -0.15, 0)), 7, rng)
    rads = [(lerp(0.34, 0.05, i / 6) * (1 + 0.1 * math.sin(i)), lerp(0.28, 0.04, i / 6)) for i in range(7)]
    spire = tube("Spire", pts, rads, sides=9, caps=True)
    spire = finish(spire, m["Stone"], sub=1, displace=0.025, noise=0.35)
    # fallen broken arc at the foot
    arc = []
    for i in range(10):
        a = math.pi * 0.15 + i / 9 * math.pi * 0.9
        arc.append(Vector((math.cos(a) * 0.7, math.sin(a) * 0.35, 0.12 + 0.04 * math.sin(i))))
    fallen = tube("Fallen", arc, [(0.08, 0.06)] * len(arc), sides=7, caps=True)
    fallen = finish(fallen, m["Stone"], sub=1, displace=0.015, noise=0.25)
    root = empty("Spire", (0, 0, 0))
    parent_to(spire, root)
    parent_to(fallen, root)
    return root


def build_monolith():
    slab = displaced_rock("Slab", 0.58, 6, Vector((0.55, 0.4, 2.7)))
    root = empty("Monolith", (0, 0, 0))
    parent_to(slab, root)
    return root


def build_shrine():
    rng = random.Random(11)
    m = mats()
    parts = []
    for i in range(6):
        rock = displaced_rock(f"Stone{i}", rng.uniform(0.22, 0.48), 20 + i, Vector((
            rng.uniform(0.8, 1.5),
            rng.uniform(0.7, 1.3),
            rng.uniform(0.45, 0.9),
        )))
        rock.location = Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.2, 0.2), i * 0.18))
        parts.append(rock)
    # hollow bowl
    bowl = tube(
        "Bowl",
        [Vector((0, 0, 1.15)), Vector((0, 0, 1.28)), Vector((0, 0, 1.4))],
        [(0.28, 0.26), (0.36, 0.32), (0.22, 0.2)],
        sides=12,
        caps=False,
    )
    bowl = finish(bowl, m["Stone"], sub=1, displace=0.012, noise=0.2)
    parts.append(bowl)
    inner = tube(
        "Ember",
        [Vector((0, 0, 1.22)), Vector((0, 0, 1.34))],
        [(0.16, 0.14), (0.1, 0.09)],
        sides=10,
        caps=True,
    )
    inner = finish(inner, m["Trim"], sub=1)
    parts.append(inner)
    root = empty("Shrine", (0, 0, 0))
    for part in parts:
        parent_to(part, root)
    low = min((child.matrix_world @ vert.co).z for child in root.children if child.type == "MESH" for vert in child.data.vertices)
    root.location.z -= low
    return root


def build_well():
    rng = random.Random(13)
    m = mats()
    parts = []
    for i in range(11):
        ang = math.tau * i / 11 + rng.uniform(-0.08, 0.08)
        rad = 0.78 + rng.uniform(-0.08, 0.1)
        rock = displaced_rock(f"Ring{i}", rng.uniform(0.18, 0.28), 40 + i, Vector((1.1, 0.9, rng.uniform(0.7, 1.3))))
        rock.location = Vector((math.cos(ang) * rad, math.sin(ang) * rad, rng.uniform(-0.02, 0.08)))
        parts.append(rock)
    water = tube("Water", [Vector((0, 0, 0.02)), Vector((0, 0, 0.08))], [(0.55, 0.52), (0.5, 0.48)], sides=14, caps=True)
    water = finish(water, m["Well"], sub=1)
    parts.append(water)
    root = empty("Well", (0, 0, 0))
    for part in parts:
        parent_to(part, root)
    return root


def build_cairn():
    rng = random.Random(15)
    parts = []
    z = 0.0
    for i in range(4):
        rock = displaced_rock(f"Cairn{i}", 0.34 - i * 0.05, 60 + i, Vector((1.5, 1.2, 0.35)))
        rock.location = Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), z))
        rock.rotation_euler.z = rng.uniform(0, math.tau)
        z += 0.12
        parts.append(rock)
    root = empty("Cairn", (0, 0, 0))
    for part in parts:
        parent_to(part, root)
    return root


def build_roots():
    rng = random.Random(17)
    m = mats()
    parts = []
    for i in range(5):
        start = Vector((rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0.05))
        end = start + Vector((rng.uniform(-0.8, 0.8), rng.uniform(-0.8, 0.8), rng.uniform(0.05, 0.3)))
        pts = curve_points(start, end, Vector((0, 0, 0.15)), 5, rng, sag=-0.05)
        rad = rng.uniform(0.04, 0.08)
        root = tube(f"Root{i}", pts, [(rad, rad * 0.7)] * 2 + [(rad * 0.6, rad * 0.4), (rad * 0.3, rad * 0.25), (0.015, 0.01)], sides=7, caps=True)
        parts.append(finish(root, m["Wood"], sub=1, displace=0.006, noise=0.2))
    holder = empty("Roots", (0, 0, 0))
    for part in parts:
        parent_to(part, holder)
    return holder


def build_undergrowth():
    rng = random.Random(19)
    m = mats()
    parts = []
    for i in range(10):
        base = Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), 0))
        tip = base + Vector((rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08), rng.uniform(0.25, 0.55)))
        pts = curve_points(base, tip, Vector((rng.uniform(-0.1, 0.1), 0, 0)), 4, rng)
        blade = tube(f"Blade{i}", pts, [(0.012, 0.004), (0.014, 0.004), (0.01, 0.003), (0.002, 0.001)], sides=5, caps=True)
        parts.append(finish(blade, m["Foliage"], sub=0))
    root = empty("Tuft", (0, 0, 0))
    for part in parts:
        parent_to(part, root)
    return root


def build_terrain():
    m = mats()
    size = 46.0
    n = 90
    bm = bmesh.new()
    uv = uv_layer(bm)
    grid = []
    for iy in range(n + 1):
        row = []
        v = iy / n
        y = (v - 0.5) * size
        for ix in range(n + 1):
            u = ix / n
            x = (u - 0.5) * size
            d = math.hypot(x, y)
            ang = math.atan2(y, x)
            coast = 11.5 + 3.2 * math.sin(ang * 3.0) + 1.8 * math.sin(ang * 5.0 + 1.4) + 1.6 * (fbm(x * 0.15, y * 0.15, 4, 80) - 0.5) * 2
            rise = smoothstep(coast, coast + 7.0, d)
            detail = (fbm(x * 0.33, y * 0.33, 4, 81) - 0.5) * 0.22
            broad = (fbm(x * 0.07, y * 0.07, 4, 82) - 0.48) * 1.4
            arena = 1 - smoothstep(coast - 3.0, coast + 0.5, d)
            height = broad * 0.35 * rise + detail * (0.45 + rise) + rise * (0.4 + 0.9 * fbm(x * 0.05 + 2, y * 0.05, 3, 83))
            height = height * (1 - arena) + detail * 0.25 * arena
            row.append(bm.verts.new((x, y, height)))
        grid.append(row)
    for iy in range(n):
        for ix in range(n):
            face = bm.faces.new((grid[iy][ix], grid[iy][ix + 1], grid[iy + 1][ix + 1], grid[iy + 1][ix]))
            u0 = ix / n
            u1 = (ix + 1) / n
            v0 = iy / n
            v1 = (iy + 1) / n
            coords = ((u0, v0), (u1, v0), (u1, v1), (u0, v1))
            for loop, coord in zip(face.loops, coords):
                loop[uv].uv = coord
            face.smooth = True
    obj = new_object("Terrain", bm)
    finish(obj, m["Earth"], sub=0)
    root = empty("Terrain", (0, 0, 0))
    parent_to(obj, root)
    return root


# ---------------------------------------------------------------------------
# render / main
# ---------------------------------------------------------------------------

def add_lookdev():
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 4.2
    sun_data.angle = 0.4
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.rotation_euler = (0.85, 0.15, -0.7)
    bpy.context.scene.collection.objects.link(sun)
    fill_data = bpy.data.lights.new("Fill", "AREA")
    fill_data.energy = 250
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.location = (-2.5, -1.5, 2.2)
    bpy.context.scene.collection.objects.link(fill)
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.16, 0.17, 0.19, 1)
    bg.inputs[1].default_value = 0.35
    ground = bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    plane = bpy.context.active_object
    plane.name = "LookdevGround"
    if plane.data.materials:
        plane.data.materials[0] = mats()["Earth"]
    else:
        plane.data.materials.append(mats()["Earth"])


def render_to(path, location, target):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 48
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = location
    bpy.context.scene.collection.objects.link(cam)
    tgt = empty("CamTarget", target)
    constraint = cam.constraints.new("TRACK_TO")
    constraint.target = tgt
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.filepath = path
    scene.eevee.taa_render_samples = 12
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print("rendered", path, flush=True)


def qc_stills():
    clean_scene()
    build_textures()
    add_lookdev()
    # three figures across the frame
    specs = [("basilica", "ruler", -1.7), ("grove", "mystic", 0.0), ("foundry", "brute", 1.7)]
    roots = []
    for family, role, x in specs:
        root = build_figure(family, role)
        root.location.x += x
        # weapon in the grip for the still
        weapon = build_weapon({"basilica": "blade", "grove": "staff", "foundry": "hammer"}[family])
        grip = next(child for child in root.children if child.get("is_grip"))
        # parenting a separate weapon under grip: move weapon to grip world pos
        weapon.location = grip.matrix_world.translation
        parent_to(weapon, grip)
        roots.append(root)
    render_to("/workspace/artifacts/qc_close.png", Vector((2.4, -4.6, 1.7)), Vector((0, 0, 1.15)))
    render_to("/workspace/artifacts/qc_gamecam.png", Vector((0.2, -16.0, 15.0)), Vector((0, 0, 1.0)))
    for root in roots:
        delete_hierarchy(root)
    # map still
    props = [
        build_terrain(),
        place(build_tree("Tree", 1), (-6, 4, 0)),
        place(build_arch(), (7, -2, 0)),
        place(build_shrine(), (0, 0, 0)),
        place(build_monolith(), (-8, -5, 0)),
        place(displaced_rock("Boulder", 0.7, 3, Vector((1.4, 1.1, 0.8))), (3.5, 5, 0)),
    ]
    render_to("/workspace/artifacts/qc_map.png", Vector((0, -28, 22)), Vector((0, 0, 0)))
    for prop in props:
        delete_hierarchy(prop)


def place(obj, loc):
    obj.location = Vector(loc)
    return obj


def export_all():
    clean_scene()
    build_textures()
    for family in FAMILIES:
        for role in ROLES:
            root = build_figure(family, role)
            export_hierarchy(root, os.path.join(OUT, "bodies", f"{family}_{role}.glb"))
            delete_hierarchy(root)
    for kind in WEAPONS:
        root = build_weapon(kind)
        export_hierarchy(root, os.path.join(OUT, "weapons", f"{kind}.glb"))
        delete_hierarchy(root)
    builders = {
        "tree": lambda: build_tree("Tree", 1),
        "tree_b": lambda: build_tree("TreeB", 2),
        "boulder": lambda: displaced_rock("Boulder", 0.7, 3, Vector((1.45, 1.05, 0.75))),
        "boulder_b": lambda: displaced_rock("BoulderB", 0.5, 7, Vector((1.1, 1.5, 0.6))),
        "arch": build_arch,
        "banner": build_banner,
        "stack": build_stack,
        "spire": build_spire,
        "monolith": build_monolith,
        "shrine": build_shrine,
        "well": build_well,
        "cairn": build_cairn,
        "roots": build_roots,
        "tuft": build_undergrowth,
        "terrain": build_terrain,
    }
    # rocks return a mesh not a parent empty — wrap if needed
    for name, builder in builders.items():
        root = builder()
        if root.type != "EMPTY":
            holder = empty(name.capitalize(), (0, 0, 0))
            parent_to(root, holder)
            root = holder
        export_hierarchy(root, os.path.join(OUT, "props", f"{name}.glb"))
        delete_hierarchy(root)


def main():
    import importlib.util
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "anatomy.py")
    spec = importlib.util.spec_from_file_location("crownfall_anatomy", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.install(globals())
    if os.environ.get("FORGE_ONLY") == "terrain":
        clean_scene()
        build_textures()
        root = build_terrain()
        export_hierarchy(root, os.path.join(OUT, "props", "terrain.glb"))
        print("FORGE_DONE", flush=True)
        return
    if DO_QC:
        qc_stills()
    if DO_EXPORT:
        export_all()
    print("FORGE_DONE", flush=True)


if __name__ == "__main__":
    main()
