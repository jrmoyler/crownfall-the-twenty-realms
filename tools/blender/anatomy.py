# Sculpted Crownfall bodies, stones, and ground.
# Installed over the tube kit in forge_realms so silhouettes read as people
# and rubble, not as primitives.

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector


def gauss(x, mu, sigma):
    return math.exp(-((x - mu) ** 2) / (2.0 * sigma * sigma + 1e-8))


def install(g):
    g["build_figure"] = lambda family, role: build_figure(g, family, role)
    g["displaced_rock"] = lambda name, radius, seed, stretch: displaced_rock(g, name, radius, seed, stretch)
    g["build_terrain"] = lambda: build_terrain(g)
    g["build_arch"] = lambda: build_arch(g)
    g["build_tree"] = lambda name, seed: build_tree(g, name, seed)
    g["build_well"] = lambda: build_well(g)
    g["build_monolith"] = lambda: build_monolith(g)
    g["build_spire"] = lambda: build_spire(g)
    g["build_stack"] = lambda: build_stack(g)


def _smooth(g, edge0, edge1, x):
    return g["smoothstep"](edge0, edge1, x)


def _lerp(g, a, b, t):
    return g["lerp"](a, b, t)


def _fbm(g, x, y, octaves, seed):
    return g["fbm"](x, y, octaves, seed)


def sculpt_direction(n, role, family):
    """Unit-sphere direction -> skull point. -Y is the face."""
    nx, ny, nz = n.x, n.y, n.z
    front = _smooth(G, 0.2, -0.8, ny)
    side = abs(nx)
    jaw_w = {"brute": 1.16, "soldier": 1.02, "ruler": 1.0, "skirmisher": 0.9, "mystic": 0.88}[role]
    if family == "monolith":
        jaw_w *= 1.06
    elif family == "observatory":
        jaw_w *= 0.94

    px = nx * 0.078
    py = ny * 0.090
    pz = nz * 0.102

    back = _smooth(G, -0.05, 0.9, ny)
    py += 0.012 * back
    px *= 1.0 + 0.08 * back

    jaw = _smooth(G, 0.08, -0.78, nz)
    px *= _lerp(G, 1.0, 0.58 * jaw_w, jaw * (0.45 + 0.55 * front))
    py *= _lerp(G, 1.0, 0.74, jaw)
    chin = jaw * front * _smooth(G, 0.55, 0.0, side)
    pz -= 0.038 * chin
    py -= 0.028 * chin

    brow = gauss(nz, 0.24, 0.075) * front * _smooth(G, 0.7, 0.18, side)
    if family == "monolith":
        brow *= 1.6
    py -= 0.036 * brow
    pz += 0.01 * brow

    for sign in (1.0, -1.0):
        dx = (nx - sign * 0.32) / 0.15
        dy = (ny + 0.72) / 0.28
        dz = (nz - 0.05) / 0.11
        sock = math.exp(-(dx * dx + dy * dy * 0.35 + dz * dz))
        py += 0.04 * sock
        lid = math.exp(-((dx * 1.05) ** 2 + ((nz - 0.15) / 0.055) ** 2)) * front
        py -= 0.01 * lid
        pz += 0.004 * lid

    nose = math.exp(-((nx / 0.09) ** 2 + ((nz + 0.02) / 0.18) ** 2)) * front
    bridge = nose * _smooth(G, -0.22, 0.28, nz)
    tip = nose * gauss(nz, -0.14, 0.07)
    py -= 0.022 * bridge + 0.055 * tip
    for sign in (1.0, -1.0):
        ndx = (nx - sign * 0.05) / 0.03
        ndz = (nz + 0.14) / 0.035
        nostril = math.exp(-(ndx * ndx + ndz * ndz)) * front
        py += 0.01 * nostril

    cheek = gauss(nz, -0.02, 0.12) * gauss(side, 0.42, 0.14) * front
    py -= 0.012 * cheek
    zygo = gauss(nz, 0.02, 0.06) * gauss(side, 0.48, 0.08) * front
    px += math.copysign(0.006 * zygo, nx if nx else 1)

    mouth = gauss(nz, -0.32, 0.028) * gauss(nx, 0.0, 0.11) * front
    py -= 0.008 * mouth
    upper = gauss(nz, -0.29, 0.016) * gauss(nx, 0.0, 0.09) * front
    py -= 0.005 * upper
    phil = gauss(nz, -0.2, 0.028) * gauss(nx, 0.0, 0.02) * front
    py += 0.005 * phil

    # masseter
    mass = gauss(nz, -0.18, 0.1) * gauss(side, 0.62, 0.1)
    px += math.copysign(0.006 * mass * jaw_w, nx if nx else 1)

    temple = gauss(nz, 0.28, 0.08) * gauss(side, 0.55, 0.12)
    px *= 1.0 - 0.06 * temple

    return Vector((px, py, pz))


G = None


def build_head(g, role, family, bulk):
    global G
    G = g
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(
        bm,
        u_segments=36,
        v_segments=26,
        radius=1.0,
        matrix=Matrix.Identity(4),
        calc_uvs=True,
    )
    scale = 0.92 + 0.12 * min(1.3, bulk)
    if role == "brute":
        scale *= 1.06
    for vert in bm.verts:
        vert.co = sculpt_direction(vert.co.normalized(), role, family) * scale
    obj = g["new_object"]("Head", bm)
    return g["finish"](obj, g["mats"]()["Skin"], sub=1, displace=0.0, decimate=1)


def add_ear(g, parts, sign, center, scale):
    def sample(_iu, _iv, u, v, sign=sign):
        a = -0.2 + u * 1.15
        r = 0.01 + 0.02 * math.sin(v * math.pi) * (1.0 - 0.25 * u)
        x = sign * (0.074 * scale + math.cos(a) * r + 0.004 * math.sin(v * 9))
        y = 0.012 + math.sin(a) * r * 0.45
        z = (v - 0.45) * 0.05 * scale - 0.004 * u
        return center + Vector((x, y, z))

    ear = g["grid_surface"](f"Ear{sign}", 6, 8, sample)
    parts.append(g["finish"](ear, g["mats"]()["Skin"], solid=0.004, sub=1, displace=0.0, decimate=1))


def add_eye(g, parts, center, sign, scale):
    loc = center + Vector((sign * 0.029 * scale, -0.058 * scale, 0.006 * scale))
    eye = g["tube"](
        f"Eye{sign}",
        [loc + Vector((0, 0.004, 0)), loc + Vector((0, -0.01, 0))],
        [(0.011 * scale, 0.007 * scale), (0.008 * scale, 0.005 * scale)],
        sides=10,
        caps=True,
    )
    parts.append(g["finish"](eye, g["mats"]()["Ink"], sub=1, decimate=1))
    lid_c = loc + Vector((0, -0.004, 0.008 * scale))

    def lid(_iu, _iv, u, v, lid_c=lid_c, sign=sign):
        a = (u - 0.5) * 0.9
        return lid_c + Vector((math.sin(a) * 0.016 * scale * (1 if sign else 1), -0.004 * v, 0.004 - v * 0.008))

    lid = g["grid_surface"](f"Lid{sign}", 3, 8, lid)
    parts.append(g["finish"](lid, g["mats"]()["Skin"], solid=0.003, sub=1, decimate=1))


def add_hand(g, parts, wrist, direction, sign, bulk, plated, rng):
    m = g["mats"]()
    direction = direction.normalized()
    up = Vector((0, 0, 1))
    side = direction.cross(up)
    if side.length < 0.2:
        side = direction.cross(Vector((0, 1, 0)))
    side = side.normalized()
    if side.x * sign < 0:
        side = -side
    palm_n = side.cross(direction).normalized()
    palm = wrist + direction * 0.055
    widths = [(0.034 * bulk, 0.014 * bulk), (0.038 * bulk, 0.016 * bulk), (0.03 * bulk, 0.013 * bulk)]
    hand = g["tube"](f"Palm{sign}", [wrist, wrist.lerp(palm, 0.55), palm], widths, sides=10, caps=True)
    skin_or = m["Plate"] if plated else m["Skin"]
    parts.append(g["finish"](hand, m["Skin"], sub=1, decimate=1))
    for finger in range(4):
        spread = (finger - 1.5) * 0.012 * bulk
        root = palm + side * spread + direction * 0.01 + palm_n * (-0.004 if finger == 0 else 0.0)
        curl = palm_n * (0.012 + 0.004 * finger) + direction * (0.05 - 0.004 * abs(finger - 1.5))
        mid = root + curl * 0.55
        tip = root + curl + side * spread * 0.15
        rad = 0.014 * bulk * (1.08 if finger in (1, 2) else 0.9)
        fin = g["tube"](
            f"Finger{sign}{finger}",
            [root, mid, tip],
            [(rad, rad * 0.82), (rad * 0.86, rad * 0.7), (rad * 0.45, rad * 0.38)],
            sides=7,
            caps=True,
        )
        parts.append(g["finish"](fin, m["Skin"], sub=1, decimate=1))
    thumb_root = palm - direction * 0.01 + side * (-sign * 0.02) + palm_n * -0.01
    thumb_tip = thumb_root + (-side * sign) * 0.028 + direction * 0.02 + palm_n * -0.012
    thumb = g["tube"](
        f"Thumb{sign}",
        [thumb_root, thumb_root.lerp(thumb_tip, 0.5), thumb_tip],
        [(0.012 * bulk, 0.01 * bulk), (0.01 * bulk, 0.008 * bulk), (0.007 * bulk, 0.006 * bulk)],
        sides=7,
        caps=True,
    )
    parts.append(g["finish"](thumb, m["Skin"], sub=1, decimate=1))
    if plated:
        shell_c = palm + palm_n * 0.01

        def shell(_iu, _iv, u, v, shell_c=shell_c):
            return shell_c + side * ((u - 0.5) * 0.05 * bulk) + direction * ((0.5 - v) * 0.04) + palm_n * (0.008 + 0.004 * math.sin(u * 6))

        plate = g["grid_surface"](f"Knuckle{sign}", 4, 6, shell)
        parts.append(g["finish"](plate, skin_or, solid=0.006, sub=1, decimate=1))


def sculpt_torso(obj, bulk, shoulder):
    for vert in obj.data.vertices:
        x, y, z = vert.co.x, vert.co.y, vert.co.z
        front = _smooth(G, 0.02, -0.08, y)
        back = _smooth(G, -0.02, 0.08, y)
        for sign in (1.0, -1.0):
            dx = (x - sign * 0.055 * bulk) / (0.05 * bulk)
            dz = (z - 1.30) / 0.07
            pec = math.exp(-(dx * dx + dz * dz)) * front
            vert.co.y -= 0.02 * pec
        sternum = math.exp(-((x / (0.016 * bulk)) ** 2 + ((z - 1.28) / 0.1) ** 2)) * front
        vert.co.y += 0.007 * sternum
        for i, zz in enumerate((1.16, 1.20, 1.24)):
            ab = math.exp(-((x / (0.045 * bulk)) ** 2 + ((z - zz) / 0.022) ** 2)) * front
            vert.co.y -= 0.006 * ab * (1 if i < 2 else 0.6)
        spine = math.exp(-((x / 0.02) ** 2 + ((z - 1.22) / 0.2) ** 2)) * back
        vert.co.y -= 0.006 * spine
        for sign in (1.0, -1.0):
            trap = math.exp(-(((x - sign * 0.1 * shoulder) / 0.06) ** 2 + ((z - 1.42) / 0.06) ** 2))
            vert.co.z += 0.012 * trap
            vert.co.x += sign * 0.008 * trap
        waist = math.exp(-((z - 1.05) / 0.06) ** 2)
        vert.co.x *= 1.0 - 0.04 * waist * (1 if abs(x) > 0.04 else 0)


def build_figure(g, family, role):
    global G
    G = g
    p = g["role_params"](family, role)
    rng = p["rng"]
    m = g["mats"]()
    bulk = p["bulk"]
    height = p["height"]
    shoulder = p["shoulder"]
    parts = []

    def z(value):
        return value * height

    # pelvis through clavicle — waist pinched, chest deep, one shoulder dropped
    drop = 0.02 * height
    torso_z = [0.86, 0.96, 1.05, 1.14, 1.24, 1.33, 1.42, 1.48]
    torso_r = [
        (0.105, 0.085),
        (0.145, 0.105),
        (0.118, 0.09),
        (0.132, 0.098),
        (0.155, 0.112),
        (0.178, 0.12),
        (0.2 * shoulder, 0.115),
        (0.07, 0.06),
    ]
    torso_pts = []
    torso_rad = []
    for i, (zz, rad) in enumerate(zip(torso_z, torso_r)):
        sway = 0.018 * math.sin(i * 0.8)
        torso_pts.append(Vector((sway * bulk, -0.012 * (1 if i > 3 else 0.2), z(zz))))
        torso_rad.append((rad[0] * bulk, rad[1] * bulk))
    body = g["tube"]("Body", torso_pts, torso_rad, sides=18, caps=True)
    g["finish"](body, m["Skin"], sub=1, displace=0.0, decimate=1)
    sculpt_torso(body, bulk, shoulder)
    parts.append(body)

    neck_base = Vector((0.01 * bulk, -0.01, z(1.46)))
    neck_top = Vector((0.0, -0.02, z(1.60)))
    neck = g["tube"](
        "Neck",
        [neck_base, neck_base.lerp(neck_top, 0.45), neck_top],
        [(0.062 * bulk, 0.055 * bulk), (0.05 * bulk, 0.048 * bulk), (0.046 * bulk, 0.044)],
        sides=12,
        caps=True,
    )
    parts.append(g["finish"](neck, m["Skin"], sub=1, decimate=1))

    head = build_head(g, role, family, bulk)
    head_shift = Vector((0.0, -0.02, z(1.70)))
    for vert in head.data.vertices:
        vert.co += head_shift
    parts.append(head)
    add_ear(g, parts, 1, head_shift, 1.0)
    add_ear(g, parts, -1, head_shift, 1.0)
    if p["hood"] < 0.5:
        add_eye(g, parts, head_shift, 1, 1.0)
        add_eye(g, parts, head_shift, -1, 1.0)

    if p["hair"] > 0.25 and p["hood"] < 0.45:
        for lock in range(7):
            a0 = math.pi * (0.15 + lock / 6.0)

            def lock_sample(_iu, _iv, u, v, a0=a0, lock=lock):
                a = a0 + (u - 0.5) * 0.45
                hang = v ** 1.15
                rad = 0.09 - 0.01 * hang + 0.008 * math.sin(lock + u * 4)
                x = math.cos(a) * rad
                y = math.sin(a) * rad * 0.8 + 0.02
                zz = z(_lerp(g, 1.80, 1.52 - 0.08 * (lock % 3) * 0.15, hang))
                zz -= 0.015 * math.sin(u * 8 + lock) * hang
                return Vector((x, y, zz))

            hair = g["grid_surface"](f"Hair{lock}", 5, 4, lock_sample)
            parts.append(g["finish"](hair, m["Ink"], solid=0.006, sub=1, decimate=1))

    if p["hood"] > 0.4:
        def hood_sample(_iu, _iv, u, v):
            gap = 0.55 + 0.15 * math.sin(v * 3)
            a = -math.pi + gap + u * (math.tau - gap * 2)
            rad = _lerp(g, 0.02, 0.125 * bulk, min(1.0, v * 1.6))
            if v > 0.55:
                rad += 0.045 * (v - 0.55) * (1 + 0.2 * math.sin(u * 14))
            zz = z(_lerp(g, 1.86, 1.42, v ** 0.9))
            x = math.sin(a) * rad
            y = -math.cos(a) * rad * 0.9
            if v > 0.82:
                zz -= 0.05 * abs(math.sin(u * 11 + v))
            return Vector((x, y, zz))

        hood = g["grid_surface"]("Hood", 12, 16, hood_sample)
        parts.append(g["finish"](hood, m["Cloth"], solid=0.008, sub=1, displace=0.003, noise=0.35, decimate=0.9))

    if family == "grove":
        for sign, phase in ((1, 0.2), (-1, 1.4)):
            root_pt = Vector((sign * 0.045, 0.015, z(1.78)))
            direction = Vector((sign * 0.16, 0.04, 0.22))
            g["grow_antler"](parts, m, root_pt, direction, 0.018, 2, rng, f"{sign}")
    if p["hood"] < 0.7 and family != "grove":
        if family == "basilica" and role in ("ruler", "soldier", "brute"):
            band_pts = []
            steps = 16
            for i in range(steps):
                a = math.tau * i / steps
                wob = 1 + 0.06 * math.sin(a * 3 + 0.4) + 0.03 * math.sin(a * 7)
                band_pts.append(Vector((math.cos(a) * 0.092 * wob, math.sin(a) * 0.1 * wob - 0.01, z(1.76 + 0.008 * math.sin(a * 2)))))
            band_pts.append(band_pts[0])
            rad = [(0.011 + 0.004 * math.sin(i * 1.7), 0.008) for i in range(len(band_pts))]
            band = g["tube"]("CrownBand", band_pts, rad, sides=6, caps=False)
            parts.append(g["finish"](band, m["Trim"], sub=1, decimate=1))
            tines = 5 if role == "ruler" else 3
            for i in range(tines):
                a = -0.8 + i * (1.6 / max(1, tines - 1))
                a += rng.uniform(-0.06, 0.06)
                base = Vector((math.sin(a) * 0.078, -math.cos(a) * 0.07 - 0.015, z(1.77)))
                top = base + Vector((rng.uniform(-0.03, 0.03), -0.015, z(0.11 + (0.08 if role == "ruler" else 0.02) * rng.random())))
                tine = g["tube"](
                    f"Tine{i}",
                    g["curve_points"](base, top, Vector((0.02, 0.01, 0)), 4, rng),
                    [(0.012, 0.008), (0.01, 0.007), (0.006, 0.005), (0.002, 0.002)],
                    sides=6,
                    caps=True,
                )
                parts.append(g["finish"](tine, m["Trim"], sub=1, decimate=1))
        elif family == "foundry" and role != "mystic":
            def mask_sample(_iu, _iv, u, v):
                a = -0.85 + u * 1.7
                rad = 0.09 * (1 + 0.05 * math.sin(u * 9))
                zz = z(_lerp(g, 1.76, 1.56, v))
                x = math.sin(a) * rad
                y = -0.055 - 0.02 * (1 - abs(u - 0.5) * 1.4)
                if 0.35 < v < 0.7 and abs(u - 0.35) < 0.12:
                    y += 0.012  # broken eye slit, one side only
                if abs(u - 0.5) < 0.08 and v > 0.4:
                    y -= 0.016
                zz += 0.01 * math.sin(u * 18) * v
                return Vector((x, y, zz))

            mask = g["grid_surface"]("Mask", 8, 12, mask_sample)
            parts.append(g["finish"](mask, m["Plate"], solid=0.007, sub=1, displace=0.004, noise=0.22, decimate=0.92))
        elif family == "monolith" and role in ("ruler", "soldier", "brute"):
            def brow_sample(_iu, _iv, u, v):
                a = -1.2 + u * 2.4
                zz = z(1.75 - v * 0.07 + 0.01 * math.sin(u * 8))
                x = math.sin(a) * 0.095 * bulk
                y = -0.045 - 0.035 * math.cos(a) * (1 - v * 0.3)
                return Vector((x, y, zz))

            brow = g["grid_surface"]("Brow", 5, 14, brow_sample)
            parts.append(g["finish"](brow, m["Stone"], solid=0.014, sub=1, displace=0.006, noise=0.4, decimate=0.9))
        elif family == "observatory" and role == "ruler":
            band_pts = []
            for i in range(18):
                a = math.tau * i / 18
                band_pts.append(Vector((math.cos(a) * (0.084 + 0.004 * math.sin(a * 5)), math.sin(a) * 0.092 - 0.012, z(1.78))))
            band_pts.append(band_pts[0])
            band = g["tube"]("Circlet", band_pts, [(0.007, 0.005)] * len(band_pts), sides=5, caps=False)
            parts.append(g["finish"](band, m["Trim"], sub=1, decimate=1))

    # legs — weight on the left, right knee soft
    for side, sign in (("L", 1), ("R", -1)):
        weighted = sign > 0
        hip = Vector((sign * 0.09 * bulk, 0.005, z(0.92)))
        knee = Vector((
            sign * (0.1 if weighted else 0.125) * bulk,
            -0.02 if weighted else 0.06,
            z(0.50 if weighted else 0.47),
        ))
        ankle = Vector((sign * 0.1 * bulk, 0.01 if weighted else -0.02, z(0.09)))
        pts = g["curve_points"](hip, knee, Vector((sign * 0.015, -0.02, 0)), 5, rng)
        pts += g["curve_points"](knee, ankle, Vector((sign * 0.01, 0.015, 0)), 4, rng)[1:]
        rads = []
        for i, _pt in enumerate(pts):
            t = i / (len(pts) - 1)
            rx = _lerp(g, 0.092, 0.04, t) * bulk
            ry = _lerp(g, 0.098, 0.046, t) * bulk
            if 0.42 < t < 0.58:
                ry *= 1.18
                rx *= 1.05
            if 0.62 < t < 0.82:
                ry *= 1.22
            rads.append((rx, ry))
        leg_mat = m["Skin"] if p["robe"] < 0.75 else m["Cloth"]
        leg = g["tube"](f"Leg{side}", pts, rads, sides=12, caps=True)
        parts.append(g["finish"](leg, leg_mat, sub=1, decimate=1))
        # boot: heel, arch, toe box — flatten the sole after
        heel = Vector((ankle.x, ankle.y + 0.03, z(0.045)))
        ball = Vector((ankle.x + sign * 0.012, ankle.y - 0.11, z(0.04)))
        toe = Vector((ankle.x + sign * 0.01, ankle.y - 0.18, z(0.045)))
        boot_pts = [heel, heel.lerp(ball, 0.45), ball, toe]
        boot_r = [(0.05 * bulk, 0.042), (0.055 * bulk, 0.05), (0.05 * bulk, 0.046), (0.032 * bulk, 0.026)]
        boot = g["tube"](f"Boot{side}", boot_pts, boot_r, sides=10, caps=True)
        boot = g["finish"](boot, m["Leather"], sub=1, displace=0.003, noise=0.3, decimate=1)
        for vert in boot.data.vertices:
            if vert.co.z < z(0.03):
                vert.co.z = z(0.012)
        parts.append(boot)
        if p["robe"] < 0.85:
            b_top = Vector((hip.x, hip.y - 0.015, hip.z))
            b_low = Vector((knee.x, knee.y, knee.z + 0.02))
            bpts = g["curve_points"](b_top, b_low, Vector((sign * 0.01, -0.015, 0)), 4, rng)
            brads = [(0.11 * bulk, 0.1 * bulk), (0.09 * bulk, 0.082 * bulk), (0.072 * bulk, 0.066 * bulk), (0.06 * bulk, 0.055 * bulk)]
            breech = g["tube"](f"Breech{side}", bpts, brads, sides=10, caps=False)
            parts.append(g["finish"](breech, m["Cloth"], solid=0.007, sub=1, displace=0.002, noise=0.4, decimate=0.92))

    grip = Vector((-0.22 * bulk, -0.2, z(0.98)))
    for side, sign in (("L", 1), ("R", -1)):
        sho = Vector((sign * (0.2 if sign > 0 else 0.19) * shoulder * bulk, -0.02, z(1.40 if sign > 0 else 1.38) - (0 if sign > 0 else drop)))
        if sign < 0:
            elb = Vector((sign * 0.34 * bulk, -0.16, z(1.12)))
            wri = Vector((sign * 0.22 * bulk, -0.24, z(0.96)))
        else:
            elb = Vector((sign * 0.30 * bulk, -0.04, z(1.08)))
            wri = Vector((sign * 0.18 * bulk, -0.12, z(0.90)))
        pts = g["curve_points"](sho, elb, Vector((sign * 0.03, -0.04, 0.02)), 5, rng)
        pts += g["curve_points"](elb, wri, Vector((sign * 0.015, -0.04, -0.01)), 4, rng)[1:]
        rads = []
        for i in range(len(pts)):
            t = i / (len(pts) - 1)
            rx = _lerp(g, 0.072, 0.032, t) * bulk
            ry = _lerp(g, 0.064, 0.03, t) * bulk
            if 0.28 < t < 0.48:
                rx *= 1.18  # biceps / forearm belly
            rads.append((rx, ry))
        arm = g["tube"](f"Arm{side}", pts, rads, sides=12, caps=True)
        parts.append(g["finish"](arm, m["Skin"], sub=1, decimate=1))
        # sleeve
        if p["robe"] > 0.2 or p["plate"] > 0.2:
            sleeve_end = pts[min(3, len(pts) - 1)]
            spts = pts[:4]
            sr = [(r[0] * 1.25, r[1] * 1.2) for r in rads[:4]]
            sleeve = g["tube"](f"Sleeve{side}", spts, sr, sides=10, caps=False)
            parts.append(g["finish"](sleeve, m["Cloth"], solid=0.006, sub=1, decimate=0.9))
            _ = sleeve_end
        direction = (wri - elb).normalized()
        add_hand(g, parts, wri, direction, sign, bulk, p["plate"] > 0.45 and role != "mystic", rng)
        if sign < 0:
            grip = wri + direction * 0.05

    if p["robe"] > 0.12:
        hem = _lerp(g, 1.12, 0.38, min(1.0, p["robe"]))

        def robe_sample(_iu, iv, u, v):
            openness = 0.22 if p["robe"] < 0.7 else 0.08
            a = -math.pi + openness + u * (math.tau - openness * 2)
            body_r = _lerp(g, 0.19 * bulk, 0.17 * bulk, v)
            fold = (
                math.sin(u * math.tau * 3.0 + v * 2.2) * 0.6
                + math.sin(u * math.tau * 8.0 - v * 4.0 + iv) * 0.28
                + math.sin(u * 23.0 + v * 9.0) * 0.12
            )
            fold *= 0.65 + 0.35 * math.sin(u * 2.1 + 0.6)
            fold_amp = 0.01 + 0.028 * (v ** 1.2) * p["robe"]
            rad = body_r + 0.028 + fold * fold_amp
            zz = z(_lerp(g, 1.40, hem, v))
            zz -= 0.03 * (v ** 2)
            # longer on the back-right, torn
            zz -= 0.04 * v * max(0.0, math.sin(a))
            if v > 0.86:
                zz += 0.05 * math.sin(u * 17.0 + 1.3) * (v - 0.86) * 8
            x = math.sin(a) * rad
            y = -math.cos(a) * rad * 0.78 + 0.03 * v
            return Vector((x, y, zz))

        robe = g["grid_surface"]("Robe", 16, 24, robe_sample)
        parts.append(g["finish"](robe, m["Cloth"], solid=0.009, sub=1, displace=0.003, noise=0.45, decimate=0.88))

    if p["plate"] > 0.25:
        def plate_sample(_iu, _iv, u, v):
            a = -0.9 + u * 1.8
            zz = z(_lerp(g, 1.44, 1.04, v))
            rad = (0.17 + 0.025 * math.sin(v * math.pi)) * bulk * (0.82 + 0.18 * p["plate"])
            x = math.sin(a) * rad
            y = -0.03 - math.cos(a) * 0.105 * bulk - 0.018 * math.sin(v * math.pi)
            if abs(u - 0.5) < 0.05:
                y -= 0.014 * (1 - v)
            # a dent, not a pattern
            if abs(u - 0.32) < 0.08 and abs(v - 0.4) < 0.12:
                y += 0.01
            return Vector((x, y, zz))

        plate = g["grid_surface"]("Plate", 10, 14, plate_sample)
        parts.append(g["finish"](plate, m["Plate"], solid=0.009, sub=1, displace=0.0025, noise=0.2, decimate=0.92))
        for i in range(3):
            def lame_sample(_iu, _iv, u, v, i=i):
                a = -0.7 + u * 1.4
                sag = 0.02 * math.sin(u * math.pi)
                zz = z(1.06 - i * 0.045) - v * 0.035 + sag
                x = math.sin(a) * (0.15 - i * 0.008) * bulk
                y = -0.08 - math.cos(a) * 0.04 - v * 0.02
                return Vector((x, y, zz))

            lame = g["grid_surface"](f"Fauld{i}", 3, 10, lame_sample)
            parts.append(g["finish"](lame, m["Plate"], solid=0.006, sub=0, decimate=1))
        belt_pts = []
        for i in range(18):
            a = math.tau * i / 18
            radx = 0.145 * bulk * (1 + 0.05 * math.sin(a * 2.0 + 0.5) + 0.02 * math.sin(a * 5))
            rady = 0.11 * bulk * (1 + 0.04 * math.cos(a * 3))
            belt_pts.append(Vector((math.sin(a) * radx, -math.cos(a) * rady, z(1.02 + 0.012 * math.sin(a * 2)))))
        belt_pts.append(belt_pts[0])
        belt = g["tube"]("Belt", belt_pts, [(0.014, 0.01)] * len(belt_pts), sides=6, caps=False)
        parts.append(g["finish"](belt, m["Leather"], sub=0, decimate=1))

    if p["pauldron"] > 0.2:
        for sign in (1, -1):
            scale = p["pauldron"] * (1.35 if sign < 0 else 0.78)

            def paul_sample(_iu, _iv, u, v, sign=sign, scale=scale):
                a = -0.2 + u * 1.35
                b = v * 1.05
                rx = 0.11 * scale
                ry = 0.08 * scale
                x = sign * (0.2 * shoulder * bulk) + math.sin(a) * rx
                zpos = z(1.44) + math.cos(b) * ry * 0.45 - (0.02 if sign > 0 else 0)
                y = -0.03 + math.sin(b) * 0.045 * (1 if u < 0.85 else 0.4)
                if u > 0.82:
                    zpos -= 0.02 * (u - 0.82) * 6  # chipped rim
                return Vector((x, y, zpos))

            paul = g["grid_surface"](f"Paul{sign}", 6, 9, paul_sample)
            mat = m["Plate"] if p["plate"] > 0.3 else m["Leather"]
            parts.append(g["finish"](paul, mat, solid=0.01, sub=1, displace=0.003, noise=0.28, decimate=0.9))

    cape_len = 0.4 + 0.9 * min(1.2, p["cape"])

    def cape_sample(_iu, _iv, u, v):
        width = _lerp(g, 0.18, 0.42, min(1, v * 1.05)) * (0.8 + 0.25 * p["cape"])
        x = (u - 0.5) * 2 * width * bulk
        x += 0.03 * math.sin(v * 4 + u * 2) * v
        fold = math.sin(u * math.pi * 5.0 + v) * (0.008 + 0.03 * v)
        fold += math.sin(u * math.pi * 11.0) * 0.008 * v
        y = 0.09 + v * 0.2 + fold
        zz = z(1.46) - v * z(cape_len)
        zz += 0.02 * math.sin(u * 3.0) * v
        if v > 0.78:
            tear = math.sin(u * 19.0 + 0.7)
            zz += 0.07 * max(0.0, tear) * (v - 0.78) * 4
            x *= 1 + 0.05 * math.sin(u * 13)
        return Vector((x, y, zz))

    cape = g["grid_surface"]("Cape", 18, 16, cape_sample)
    g["finish"](cape, m["Cloth"], solid=0.007, sub=1, displace=0.003, noise=0.4, decimate=0.88)
    g["shift_origin"](cape, Vector((0.0, 0.1, z(1.46))))
    parts.append(cape)

    if family == "observatory" and role in ("ruler", "mystic"):
        def veil_sample(_iu, _iv, u, v):
            x = (u - 0.5) * _lerp(g, 0.1, 0.22, v) * (1 + 0.08 * math.sin(v * 9))
            y = 0.11 + v * 0.14 + math.sin(u * 10 + v * 3) * 0.01 * v
            zz = z(1.72) - v * z(1.2)
            if v > 0.9:
                zz += 0.04 * math.sin(u * 15)
            return Vector((x, y, zz))

        veil = g["grid_surface"]("Veil", 14, 8, veil_sample)
        g["finish"](veil, m["Cloth"], solid=0.005, sub=1, decimate=0.9)
        g["shift_origin"](veil, Vector((0, 0.08, z(1.72))))
        parts.append(veil)

    bpy.ops.object.mode_set(mode="OBJECT")
    root = g["empty"]("Figure", (0, 0, 0))
    for part in parts:
        g["parent_to"](part, root)
    grip_empty = g["empty"]("Grip", grip)
    grip_empty["is_grip"] = 1
    g["parent_to"](grip_empty, root)
    bpy.context.view_layer.update()
    low = min((child.matrix_world @ vert.co).z for child in root.children if child.type == "MESH" for vert in child.data.vertices)
    root.location.z -= low
    cape_obj = next((child for child in root.children if child.name.startswith("Cape")), None)
    veil = next((child for child in root.children if child.name.startswith("Veil")), None)
    if cape_obj is not None and veil is not None:
        g["parent_to"](veil, cape_obj)
    bpy.context.view_layer.update()
    print("FIGURE", family, role, "sculpted", flush=True)
    return root


def displaced_rock(g, name, radius, seed, stretch):
    global G
    G = g
    rng = random.Random(int(seed) + 3)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0, matrix=Matrix.Identity(4))
    obj = g["new_object"](name, bm)
    sx, sy, sz = float(stretch.x), float(stretch.y), float(stretch.z)
    for vert in obj.data.vertices:
        vert.co.x *= sx * radius
        vert.co.y *= sy * radius
        vert.co.z *= sz * radius * 0.8
    for _i in range(6):
        normal = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.2, 1))).normalized()
        dist = radius * rng.uniform(0.15, 0.62) * max(sx, sy, sz) * 0.45
        for vert in obj.data.vertices:
            proj = vert.co.dot(normal)
            if proj > dist:
                vert.co -= normal * (proj - dist) * rng.uniform(0.65, 1.0)
    for vert in obj.data.vertices:
        p = vert.co
        n = _fbm(g, p.x * 1.6 + seed, p.y * 1.6, 4, int(seed) % 97)
        ridge = abs(_fbm(g, p.x * 3.1, p.z * 2.4, 3, int(seed) + 5) - 0.5)
        direction = p.normalized() if p.length > 1e-5 else Vector((0, 0, 1))
        vert.co += direction * ((n - 0.5) * radius * 0.28 - ridge * radius * 0.05)
    low = min(v.co.z for v in obj.data.vertices)
    for vert in obj.data.vertices:
        if vert.co.z < low + radius * 0.22:
            vert.co.z = low + (vert.co.z - low) * 0.2
        vert.co.z -= low
    return g["finish"](obj, g["mats"]()["Stone"], sub=0, decimate=1)


def build_terrain(g):
    global G
    G = g
    m = g["mats"]()
    size = 46.0
    n = 110
    bm = bmesh.new()
    uv = g["uv_layer"](bm)
    grid = []
    for iy in range(n + 1):
        row = []
        v = iy / n
        y = (v - 0.5) * size
        for ix in range(n + 1):
            u = ix / n
            x = (u - 0.5) * size
            wx = _fbm(g, x * 0.07, y * 0.07, 4, 11) - 0.5
            wy = _fbm(g, x * 0.07 + 3.0, y * 0.07, 4, 12) - 0.5
            sx = x + wx * 7.0
            sy = y + wy * 7.0
            broad = _fbm(g, sx * 0.04, sy * 0.04, 5, 2)
            ridge = abs(_fbm(g, sx * 0.08, sy * 0.065, 4, 8) - 0.5)
            ridge = (0.5 - ridge) ** 2
            detail = _fbm(g, sx * 0.28, sy * 0.28, 4, 5)
            peb = _fbm(g, x * 0.9, y * 0.9, 2, 9)
            basin = _smooth(g, 0.42, 0.78, _fbm(g, x * 0.05 + 1.2, y * 0.05, 3, 4))
            h = (broad - 0.48) * 2.6 + ridge * 4.8 + (detail - 0.5) * 0.55
            h = h * _lerp(g, 0.35, 1.0, basin) + (detail - 0.5) * 0.12
            path = abs((y + math.sin(x * 0.13) * 3.2) + (_fbm(g, x * 0.18, y * 0.18, 2, 6) - 0.5) * 4)
            h -= _smooth(g, 2.4, 0.25, path) * 0.28
            gully = abs(x * 0.28 - y * 0.2 + math.sin(y * 0.18) * 2.4)
            h -= _smooth(g, 1.8, 0.15, gully) * 0.85 * (0.45 + basin)
            edge = _smooth(g, 12.0, 20.0, math.hypot(x, y) + (_fbm(g, math.atan2(y, x) * 1.7, 0.4, 3, 7) - 0.5) * 14)
            h += edge * (1.8 + ridge * 4.5)
            h += (peb - 0.5) * 0.05
            row.append(bm.verts.new((x, y, h)))
        grid.append(row)
    for iy in range(n):
        for ix in range(n):
            face = bm.faces.new((grid[iy][ix], grid[iy][ix + 1], grid[iy + 1][ix + 1], grid[iy + 1][ix]))
            coords = ((ix / n, iy / n), ((ix + 1) / n, iy / n), ((ix + 1) / n, (iy + 1) / n), (ix / n, (iy + 1) / n))
            for loop, coord in zip(face.loops, coords):
                loop[uv].uv = coord
            face.smooth = True
    obj = g["new_object"]("Terrain", bm)
    g["finish"](obj, m["Earth"], sub=0, decimate=1)
    root = g["empty"]("Terrain", (0, 0, 0))
    g["parent_to"](obj, root)
    return root


def build_arch(g):
    rng = random.Random(30)
    parts = []
    steps = 8
    for i in range(steps):
        t = i / (steps - 1)
        ang = math.pi * (0.18 + 0.62 * t)
        x = math.cos(ang) * 1.2
        z = math.sin(ang) * 0.85
        if i >= 6:
            z -= 0.28 * (i - 5)
            x += 0.18 * (i - 5)
        rock = displaced_rock(g, f"Voussoir{i}", rng.uniform(0.18, 0.28), 30 + i, Vector((1.15, 0.72, 0.7)))
        rock.location = Vector((x + rng.uniform(-0.04, 0.04), rng.uniform(-0.05, 0.06), max(0.05, z)))
        rock.rotation_euler.z = ang + rng.uniform(-0.2, 0.2)
        rock.rotation_euler.y = rng.uniform(-0.15, 0.15)
        parts.append(rock)
    rubble = displaced_rock(g, "ArchRubble", 0.34, 12, Vector((1.4, 1.1, 0.45)))
    rubble.location = Vector((1.15, 0.2, 0))
    parts.append(rubble)
    root = g["empty"]("Arch", (0, 0, 0))
    for part in parts:
        g["parent_to"](part, root)
    return root


def build_tree(g, name, seed):
    global G
    G = g
    rng = random.Random(seed)
    m = g["mats"]()
    parts = []
    trunk_h = rng.uniform(1.8, 2.8)
    start = Vector((0, 0, 0))
    end = Vector((rng.uniform(-0.35, 0.35), rng.uniform(-0.25, 0.3), trunk_h))
    pts = g["curve_points"](start, end, Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.25, 0.25), 0)), 7, rng)
    rads = []
    for i in range(len(pts)):
        t = i / (len(pts) - 1)
        rads.append((
            _lerp(g, 0.18, 0.035, t) * rng.uniform(0.9, 1.15),
            _lerp(g, 0.15, 0.03, t) * rng.uniform(0.85, 1.1),
        ))
    trunk = g["tube"]("Trunk", pts, rads, sides=12, caps=True)
    trunk = g["finish"](trunk, m["Wood"], sub=1, displace=0.012, noise=0.22, decimate=0.85)
    for vert in trunk.data.vertices:
        ang = math.atan2(vert.co.y, vert.co.x)
        vert.co.x += math.cos(ang * 5 + seed) * 0.01
        vert.co.y += math.sin(ang * 5 + seed) * 0.01
    parts.append(trunk)
    tips = []
    for i in range(7):
        origin = pts[min(len(pts) - 2, 2 + (i % 4))]
        direction = Vector((rng.uniform(-1.1, 1.1), rng.uniform(-0.9, 0.9), rng.uniform(0.35, 1.2)))
        tip = origin + direction * rng.uniform(0.7, 1.15)
        bpts = g["curve_points"](origin, tip, Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.2, 0.2), 0.05)), 4, rng)
        rad = 0.045 * rng.uniform(0.7, 1.3)
        br = g["tube"](
            f"Branch{i}",
            bpts,
            [(rad, rad * 0.75), (rad * 0.7, rad * 0.55), (rad * 0.35, rad * 0.28), (0.01, 0.008)],
            sides=7,
            caps=True,
        )
        parts.append(g["finish"](br, m["Wood"], sub=0, decimate=1))
        tips.append(tip)
    for i, tip in enumerate(tips):
        def leaf_sample(_iu, _iv, u, v, tip=tip, i=i):
            ang = u * math.tau
            rad = (0.08 + 0.28 * (1 - v)) * (0.55 + 0.7 * abs(math.sin(ang * 2.0 + i)))
            if math.sin(ang * 3 + i * 1.7) > 0.72 and v < 0.7:
                rad *= 0.25  # torn gap, not a solid puff
            x = tip.x + math.cos(ang) * rad
            y = tip.y + math.sin(ang) * rad * 0.72
            zz = tip.z + 0.02 - v * 0.22 + 0.04 * math.sin(ang * 3 + v)
            return Vector((x, y, zz))

        clump = g["grid_surface"](f"Leaf{i}", 4, 10, leaf_sample)
        parts.append(g["finish"](clump, m["Foliage"], solid=0.012, sub=0, decimate=1))
    root = g["empty"](name, (0, 0, 0))
    for part in parts:
        g["parent_to"](part, root)
    return root


def build_well(g):
    rng = random.Random(13)
    m = g["mats"]()
    parts = []
    count = 9
    for i in range(count):
        if i == 4:
            continue  # gap, not a closed ring
        ang = math.tau * i / count + rng.uniform(-0.18, 0.18)
        rad = 0.72 + rng.uniform(-0.12, 0.18)
        rock = displaced_rock(g, f"Ring{i}", rng.uniform(0.16, 0.32), 40 + i, Vector((rng.uniform(0.8, 1.4), rng.uniform(0.7, 1.3), rng.uniform(0.55, 1.15))))
        rock.location = Vector((math.cos(ang) * rad, math.sin(ang) * rad, rng.uniform(-0.04, 0.1)))
        rock.rotation_euler.z = rng.uniform(0, math.tau)
        parts.append(rock)
    spill = displaced_rock(g, "Spill", 0.22, 48, Vector((1.3, 0.8, 0.4)))
    spill.location = Vector((0.95, 0.2, 0))
    parts.append(spill)
    water = g["tube"](
        "Water",
        [Vector((0.05, -0.02, 0.02)), Vector((0.02, 0.01, 0.07))],
        [(0.48, 0.42), (0.4, 0.36)],
        sides=12,
        caps=True,
    )
    parts.append(g["finish"](water, m["Well"], sub=1, decimate=1))
    root = g["empty"]("Well", (0, 0, 0))
    for part in parts:
        g["parent_to"](part, root)
    return root


def build_monolith(g):
    slab = displaced_rock(g, "Slab", 0.7, 6, Vector((0.42, 0.28, 2.8)))
    chip = displaced_rock(g, "Chip", 0.22, 16, Vector((1.2, 0.7, 0.5)))
    chip.location = Vector((0.35, 0.2, 0.0))
    root = g["empty"]("Monolith", (0, 0, 0))
    g["parent_to"](slab, root)
    g["parent_to"](chip, root)
    return root


def build_spire(g):
    rng = random.Random(2)
    m = g["mats"]()
    parts = []
    # a broken stack of drums, not a cone
    z = 0.0
    for i in range(5):
        drum = displaced_rock(g, f"Drum{i}", 0.34 - i * 0.03, 70 + i, Vector((1.0, 0.86, 0.55)))
        drum.location = Vector((rng.uniform(-0.05, 0.06), rng.uniform(-0.04, 0.05), z))
        drum.rotation_euler.z = rng.uniform(0, 1.2)
        if i == 4:
            drum.location.x += 0.15
            drum.rotation_euler.y = 0.4
        parts.append(drum)
        z += 0.42 - i * 0.03
    root = g["empty"]("Spire", (0, 0, 0))
    for part in parts:
        g["parent_to"](part, root)
    return root


def build_stack(g):
    rng = random.Random(8)
    parts = []
    z = 0.0
    for i in range(4):
        course = displaced_rock(g, f"Course{i}", 0.46 - i * 0.05, 80 + i, Vector((1.35, 1.15, 0.48)))
        course.location = Vector((rng.uniform(-0.06, 0.08) * (i + 1) * 0.15, rng.uniform(-0.05, 0.05), z))
        course.rotation_euler.z = rng.uniform(-0.2, 0.2)
        parts.append(course)
        z += 0.38
    slag = displaced_rock(g, "Slag", 0.4, 4, Vector((1.5, 1.15, 0.4)))
    slag.location = Vector((0.7, 0.35, 0))
    parts.append(slag)
    root = g["empty"]("Stack", (0, 0, 0))
    for part in parts:
        g["parent_to"](part, root)
    return root
