"""Mechanism physics and the overlay it draws. All mechanisms here are fictional."""
import importlib.util
import pathlib
import re
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


mechanism = load("mechanism")
solutions = load("solutions")
CW, ACW = mechanism.CLOCKWISE, mechanism.ANTICLOCKWISE


def train(belt="open", side="right"):
    parts = {"1": {"kind": "gear", "at": (100, 200), "r": 40, "teeth": 16},
             "2": {"kind": "gear", "at": (180, 200), "r": 40, "teeth": 16, "belt_r": 12},
             "3": {"kind": "pulley", "at": (400, 120), "r": 24, "belt_r": 12}}
    links = [("mesh", "1", "2"), ("belt", "2", "3", belt)]
    rope = {"part": "3", "side": side, "to_y": 300}
    return mechanism.Mechanism(parts, links, ("1", CW), rope)


class MechanismTest(unittest.TestCase):
    def test_meshes_reverse_and_belts_keep_or_reverse(self):
        open_belt = train("open")
        self.assertEqual(("clockwise", "anticlockwise", "anticlockwise"), tuple(open_belt.direction(k) for k in "123"))
        crossed = train("crossed")
        self.assertEqual("clockwise", crossed.direction("3"))

    def test_speeds_follow_the_radii(self):
        m = mechanism.Mechanism({"a": {"kind": "gear", "at": (0, 0), "r": 40, "teeth": 20},
                                 "b": {"kind": "gear", "at": (60, 0), "r": 20, "teeth": 10}},
                                [("mesh", "a", "b")], ("a", CW))
        self.assertAlmostEqual(-2.0, m.omega["b"])
        self.assertAlmostEqual(m.travel("a", 90), m.travel("b", 90))  # the pitch circles roll together

    def test_the_rope_side_decides_where_the_load_goes(self):
        self.assertEqual("up", train("open", "right").load_moves())    # pulley anticlockwise, right edge rises
        self.assertEqual("down", train("open", "left").load_moves())
        self.assertEqual("down", train("crossed", "right").load_moves())

    def test_a_closed_loop_of_three_gears_jams(self):
        parts = {k: {"kind": "gear", "at": (i * 50, 0), "r": 20, "teeth": 10} for i, k in enumerate("abc")}
        with self.assertRaisesRegex(mechanism.MechanismError, "jams"):
            mechanism.Mechanism(parts, [("mesh", "a", "b"), ("mesh", "b", "c"), ("mesh", "c", "a")], ("a", CW))

    def test_every_linked_part_moves_together_and_the_overlay_is_safe(self):
        m = train("crossed")
        fragment = m.layer("go", tags={"1": ("#d9772b", 0, 50), "load": ("#2f9d5a", 40, 0)})
        motions = m.motions("go", angle=120, duration=8000, max_drop=1000)
        ids = set(re.findall(r'id="([^"]+)"', fragment))
        self.assertTrue(all(motion["target"] in ids for motion in motions))
        self.assertEqual({8000}, {motion["duration"] for motion in motions})
        self.assertEqual({"linear"}, {motion["easing"] for motion in motions})
        rotations = {mo["target"]: mo["angle"] for mo in motions if mo["type"] == "rotate"}
        self.assertEqual((120, -120, 120), (rotations["go-part-1"], rotations["go-part-2"], rotations["go-part-3"]))  # equal belt radii: same speed
        load_move = next(mo for mo in motions if mo["target"] == "go-load")
        self.assertGreater(load_move["dy"], 0)  # crossed belt: pulley clockwise, right edge goes down
        overlay = {"figure": "q1-fig-1", "viewBox": "0 0 500 400", "steps": {"go": fragment}}
        self.assertEqual([], solutions.overlay_problems(fragment))
        self.assertEqual([], solutions.motion_problems([{"text": "Turn.", "overlay": "go", "motion": motions}], overlay))
        bounce = [dict(motions[0], easing="bounce")]
        self.assertIn("step-1-motion-easing", solutions.motion_problems([{"text": "Turn.", "overlay": "go", "motion": bounce}], overlay))

    def test_the_two_runs_of_an_open_belt_flow_opposite_ways(self):
        flows = [mo["distance"] for mo in train("open").motions("go") if mo["type"] == "flow" and "belt" in mo["target"]]
        self.assertEqual(2, len(flows))
        self.assertLess(flows[0] * flows[1], 0)  # both runs drawn from the same end: out along one, back along the other


if __name__ == "__main__":
    unittest.main()
