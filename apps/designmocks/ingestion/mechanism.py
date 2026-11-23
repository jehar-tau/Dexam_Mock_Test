"""Gear, belt and pulley mechanisms for visual solutions, animated so the physics holds.

Every part linked to the driver turns at the same moment, with linear timing, so meshing gears and belts keep their
speed ratio for the whole animation:

- meshing gears turn opposite ways, at speeds in inverse ratio to their radii;
- an open belt keeps the direction and a crossed belt reverses it (speed ratio from the belt radii);
- parts on one axle turn together;
- a rope leaving the right edge of a pulley goes down when the pulley turns clockwise (the left edge: anticlockwise).

`Mechanism.layer()` draws the whole mechanism as an overlay fragment (ids prefixed with the layer name, because the
review page keeps earlier layers in the page) and `Mechanism.motions()` gives the matching motion list. See PLAN.md,
"Mechanism questions".
"""
import math

INK, ORANGE, BLUE, GREEN, WHITE = "#111111", "#d9772b", "#2f6fd9", "#2f9d5a", "#ffffff"
CLOCKWISE, ANTICLOCKWISE = 1, -1


class MechanismError(Exception):
    """The links contradict each other (the mechanism would jam) or name an unknown part."""


def fmt(value):
    return f"{value:.1f}".rstrip("0").rstrip(".")


def label(x, y, text, colour, size=11):
    width = len(text) * size * 0.6 + 14
    return (f'<g><rect x="{fmt(x - width / 2)}" y="{fmt(y - size)}" width="{fmt(width)}" height="{size + 8}" rx="6" fill="{colour}"/>'
            f'<text x="{fmt(x)}" y="{fmt(y + 1)}" font-size="{size}" font-weight="700" text-anchor="middle" fill="{WHITE}">{text}</text></g>')


def tangents(c1, r1, c2, r2, crossed):
    """The two straight runs of a belt between circles: open belts use outer tangents, crossed belts inner ones."""
    (x1, y1), (x2, y2) = c1, c2
    dx, dy = x2 - x1, y2 - y1
    distance = math.hypot(dx, dy)
    base = math.atan2(dy, dx)
    spread = math.acos(((r1 + r2) if crossed else (r1 - r2)) / distance)
    runs = []
    for side in (1, -1):
        angle = base + side * spread
        start = (x1 + r1 * math.cos(angle), y1 + r1 * math.sin(angle))
        end = ((x2 - r2 * math.cos(angle), y2 - r2 * math.sin(angle)) if crossed
               else (x2 + r2 * math.cos(angle), y2 + r2 * math.sin(angle)))
        runs.append((start, end))
    return runs


class Mechanism:
    def __init__(self, parts, links, driver, rope=None):
        """parts: {name: {kind: gear|pulley, at: (x, y), r: pitch or rim radius, teeth: n (gears), belt_r: radius the
        belt runs on (default r), mark: draw a turning dot (default True)}}.
        links: ("mesh", a, b) | ("belt", a, b, "open" | "crossed") | ("axle", a, b).
        driver: (name, CLOCKWISE | ANTICLOCKWISE). rope: {part, side: right|left, to_y, load_w, load_h, load_label}."""
        self.parts, self.links, self.driver, self.rope = parts, links, driver, rope
        self.omega = self._solve()
        self.phase = self._phases()

    # ---- physics ----
    def _solve(self):
        name, direction = self.driver
        omega = {name: float(direction)}
        changed = True
        while changed:
            changed = False
            for link in self.links:
                kind, a, b = link[:3]
                for x, y in ((a, b), (b, a)):
                    if x not in self.parts or y not in self.parts:
                        raise MechanismError(f"unknown part in {link}")
                    if x not in omega:
                        continue
                    if kind == "mesh":
                        value = -omega[x] * self.parts[x]["r"] / self.parts[y]["r"]
                    elif kind == "belt":
                        sign = -1 if link[3] == "crossed" else 1
                        value = sign * omega[x] * self.belt_r(x) / self.belt_r(y)
                    elif kind == "axle":
                        value = omega[x]
                    else:
                        raise MechanismError(f"unknown link {kind}")
                    if y in omega:
                        if abs(omega[y] - value) > 1e-6 * max(1, abs(value)):
                            raise MechanismError(f"{y} would be driven two ways: the mechanism jams")
                    else:
                        omega[y] = value
                        changed = True
        return omega

    def belt_r(self, name):
        return self.parts[name].get("belt_r", self.parts[name]["r"])

    def direction(self, name):
        return "clockwise" if self.omega[name] > 0 else "anticlockwise"

    def rope_point(self):
        part = self.parts[self.rope["part"]]
        (x, y), r = part["at"], self.rope.get("r", part["r"])
        return (x + r, y) if self.rope["side"] == "right" else (x - r, y)

    def load_moves(self):
        """'down' or 'up': the rope's edge of the pulley carries the load with it."""
        w = self.omega[self.rope["part"]]
        down = w > 0 if self.rope["side"] == "right" else w < 0
        return "down" if down else "up"

    def travel(self, name, angle):
        """How far a point on the part's pitch circle moves while the driver turns `angle` degrees."""
        return abs(math.radians(angle) * self.omega[name]) * self.parts[name]["r"]

    # ---- drawing ----
    def _phases(self):
        """Tooth angles so that a tooth of one gear sits in a gap of the gear it meshes with."""
        phase = {}
        gears = [n for n, p in self.parts.items() if p["kind"] == "gear"]
        if not gears:
            return phase
        start = self.driver[0] if self.driver[0] in gears else gears[0]
        phase[start] = 0.0
        queue = [start]
        while queue:
            a = queue.pop(0)
            for kind, x, y, *_ in self.links:
                if kind != "mesh" or a not in (x, y):
                    continue
                b = y if a == x else x
                if b in phase or self.parts[b]["kind"] != "gear":
                    continue
                (ax, ay), (bx, by) = self.parts[a]["at"], self.parts[b]["at"]
                towards_b = math.atan2(by - ay, bx - ax)
                pitch_a = 2 * math.pi / self.parts[a]["teeth"]
                offset = ((towards_b - phase[a]) + pitch_a / 2) % pitch_a - pitch_a / 2  # a's nearest tooth from the contact
                arc = offset * self.parts[a]["r"]
                pitch_b = 2 * math.pi / self.parts[b]["teeth"]
                phase[b] = (towards_b + math.pi) - arc / self.parts[b]["r"] + pitch_b / 2
                queue.append(b)
        return phase

    def _gear(self, name):
        part = self.parts[name]
        n, r = part["teeth"], part["r"]
        outer, root = r + part.get("addendum", 4.5), r - part.get("dedendum", 4.5)
        pitch = 2 * math.pi / n
        points = []
        for i in range(n):
            centre = self.phase.get(name, 0.0) + i * pitch
            for shift, radius in ((-0.5, root), (-0.27, outer), (0.27, outer), (0.5, root)):
                angle = centre + shift * pitch * (0.62 if radius == outer else 1)
                points.append((radius * math.cos(angle), radius * math.sin(angle)))
        path = "M" + " L".join(f"{fmt(x)},{fmt(y)}" for x, y in points) + " Z"
        return (f'<path d="{path}" fill="{WHITE}" stroke="{INK}" stroke-width="1.6" stroke-linejoin="round"/>'
                f'<circle r="{fmt(part.get("bore", 6))}" fill="{WHITE}" stroke="{INK}" stroke-width="1.4"/>')

    def _pulley(self, name):
        r = self.parts[name]["r"]
        return (f'<circle r="{fmt(r)}" fill="{WHITE}" stroke="{INK}" stroke-width="1.6"/>'
                f'<circle r="{fmt(self.parts[name].get("bore", 6))}" fill="{WHITE}" stroke="{INK}" stroke-width="1.4"/>')

    def _belt_motions(self, prefix, angle, duration):
        """Each straight run of a belt flows on its own: the belt goes out along one run and back along the other."""
        flows = []
        for index, link in enumerate(self.links):
            if link[0] != "belt":
                continue
            _, a, b, how = link
            ra = self.belt_r(a) + 1.5
            for run, (s, e) in enumerate(tangents(self.parts[a]["at"], ra, self.parts[b]["at"], self.belt_r(b) + 1.5, how == "crossed")):
                cx, cy = self.parts[a]["at"]
                # velocity of the belt where it leaves part a (clockwise is positive in screen coordinates)
                vx, vy = -self.omega[a] * (s[1] - cy), self.omega[a] * (s[0] - cx)
                along = vx * (e[0] - s[0]) + vy * (e[1] - s[1])
                distance = math.copysign(abs(math.radians(angle) * self.omega[a]) * ra, along)
                flows.append({"target": f"{prefix}belt-{index}-run-{run}", "type": "flow", "distance": round(distance, 1),
                              "duration": duration, "easing": "linear"})
        return flows

    def layer(self, name, tags=(), highlight=(), belt_colour=None, extra_below="", extra_above="", background=True):
        """The whole mechanism as an overlay fragment. tags: {part: (colour, dx, dy)} direction labels."""
        prefix = f"{name}-"
        body = [f'<rect x="0" y="0" width="100%" height="100%" fill="{WHITE}"/>' if background else "", extra_below]
        belts = []
        for index, link in enumerate(self.links):
            if link[0] != "belt":
                continue
            _, a, b, how = link
            ca, cb = self.parts[a]["at"], self.parts[b]["at"]
            ra, rb = self.belt_r(a) + 1.5, self.belt_r(b) + 1.5
            stroke = belt_colour or INK
            runs = "".join(f'<g id="{prefix}belt-{index}-run-{run}"><line x1="{fmt(s[0])}" y1="{fmt(s[1])}" x2="{fmt(e[0])}" y2="{fmt(e[1])}" '
                           f'stroke="{stroke}" stroke-width="2.6" stroke-dasharray="9 5"/></g>'
                           for run, (s, e) in enumerate(tangents(ca, ra, cb, rb, how == "crossed")))
            wraps = "".join(f'<circle cx="{fmt(c[0])}" cy="{fmt(c[1])}" r="{fmt(r)}" fill="none" stroke="{stroke}" stroke-width="2.6"/>'
                            for c, r in ((ca, ra), (cb, rb)))
            belts.append(runs + wraps)
        for part_name, part in self.parts.items():
            x, y = part["at"]
            shape = self._gear(part_name) if part["kind"] == "gear" else self._pulley(part_name)
            if part_name in highlight:
                ring = part["r"] + (8 if part["kind"] == "gear" else 4)
                shape += f'<circle r="{fmt(ring)}" fill="none" stroke="{ORANGE}" stroke-width="3" stroke-dasharray="5 4"/>'
            if part.get("mark", True):
                reach = part["r"] - (12 if part["kind"] == "gear" else 7)
                shape += f'<circle cx="0" cy="{fmt(-reach)}" r="4.5" fill="{ORANGE}"/>'
            body.append(f'<g id="{prefix}part-{part_name}"><g transform="translate({fmt(x)},{fmt(y)})">{shape}</g></g>')
        body.extend(belts)
        if self.rope:
            rx, ry = self.rope_point()
            top = self.rope["to_y"]
            w, h = self.rope.get("load_w", 40), self.rope.get("load_h", 44)
            body.append(f'<g id="{prefix}rope"><line x1="{fmt(rx)}" y1="{fmt(ry)}" x2="{fmt(rx)}" y2="{fmt(top)}" stroke="{INK}" stroke-width="1.6" stroke-dasharray="6 4"/></g>')
            body.append(f'<g id="{prefix}load"><line x1="{fmt(rx)}" y1="{fmt(top - 30)}" x2="{fmt(rx)}" y2="{fmt(top)}" stroke="{INK}" stroke-width="1.6"/>'
                        f'<path d="M{fmt(rx - w * 0.32)},{fmt(top)} L{fmt(rx + w * 0.32)},{fmt(top)} L{fmt(rx + w / 2)},{fmt(top + h)} L{fmt(rx - w / 2)},{fmt(top + h)} Z" '
                        f'fill="{WHITE}" stroke="{INK}" stroke-width="1.6"/>'
                        f'<text x="{fmt(rx)}" y="{fmt(top + h * 0.68)}" font-size="15" font-weight="700" text-anchor="middle" fill="{INK}">{self.rope.get("load_label", "W")}</text></g>')
        body.append(extra_above)
        for part_name, (colour, dx, dy) in dict(tags).items():
            if part_name == "load":
                rx, _ = self.rope_point()
                body.append(label(rx + dx, self.rope["to_y"] + dy, f"moves {self.load_moves()}", colour))
            else:
                x, y = self.parts[part_name]["at"]
                body.append(label(x + dx, y + dy, self.direction(part_name), colour))
        return "".join(body)

    def motions(self, name, angle=150, duration=8000, max_drop=28):
        """Turn the driver by `angle` degrees and everything linked to it, together, at constant speed.
        The angle is reduced if the load would travel more than `max_drop` (it must stay inside the figure)."""
        prefix = f"{name}-"
        if self.rope:
            reach = math.radians(1) * abs(self.omega[self.rope["part"]]) * self.rope.get("r", self.parts[self.rope["part"]]["r"])
            angle = min(angle, round(max_drop / reach))
        out = []
        for part_name, part in self.parts.items():
            if part_name not in self.omega:
                continue
            x, y = part["at"]
            out.append({"target": f"{prefix}part-{part_name}", "type": "rotate", "angle": round(angle * self.omega[part_name], 1),
                        "cx": round(x, 1), "cy": round(y, 1), "duration": duration, "easing": "linear"})
        out.extend(self._belt_motions(prefix, angle, duration))
        if self.rope:
            part = self.rope["part"]
            r = self.rope.get("r", self.parts[part]["r"])
            drop = abs(math.radians(angle) * self.omega[part]) * r
            drop = drop if self.load_moves() == "down" else -drop
            out.append({"target": f"{prefix}rope", "type": "flow", "distance": round(drop, 1), "duration": duration, "easing": "linear"})
            out.append({"target": f"{prefix}load", "type": "move", "dx": 0, "dy": round(drop, 1), "duration": duration, "easing": "linear"})
        return out

    def figure(self, extra_below="", extra_above=""):
        """The plain question figure: solid belts and rope, no marks."""
        plain = Mechanism({k: {**v, "mark": False} for k, v in self.parts.items()}, self.links, self.driver, self.rope)
        fragment = plain.layer("fig", background=False, extra_below=extra_below, extra_above=extra_above)
        return fragment.replace(' stroke-dasharray="9 5"', "").replace(' stroke-dasharray="6 4"', "")
