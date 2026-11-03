#!/usr/bin/env python3
"""Generates practice-batch-4.js: original NIFT-style English and quantitative drills plus three
original mock papers. Quantitative answers are computed here, never typed by hand.
Usage: python3 tools/generate_nift_original_batch.py"""
import json, random, pathlib
from fractions import Fraction
from math import gcd
import nift_english_content as E

ROOT = pathlib.Path(__file__).resolve().parent.parent
rng = random.Random(20261104)
LETTERS = "ABCD"
drills = []

seen_prompts = set()

def make(topic, difficulty, prompt, correct, wrong, solution, group):
    if prompt in seen_prompts:
        return None
    seen_prompts.add(prompt)
    options = [correct] + list(wrong)
    assert len(set(map(str, options))) == 4, (prompt, options)
    order = list(range(4)); rng.shuffle(order)
    shuffled = [options[i] for i in order]
    answer = LETTERS[order.index(0)]
    q = {"topic": topic, "difficulty": difficulty, "prompt": prompt,
         "options": shuffled, "correctAnswer": answer, "solution": solution, "group": group}
    drills.append(q); return q

def fmt(n):
    if isinstance(n, Fraction):
        return str(n.numerator) if n.denominator == 1 else f"{n.numerator}/{n.denominator}"
    return f"{n:g}" if isinstance(n, float) else str(n)

def near(ans, step, count=3, positive=True):
    out = set()
    for d in (step, -step, 2 * step, -2 * step, 3 * step, step // 2 or 1):
        v = ans + d
        if v != ans and (v > 0 or not positive): out.add(v)
    out = sorted(out, key=lambda v: abs(v - ans))[:count]
    assert len(out) == count
    return out

# ---------- English ----------
for word, right, wrong in E.SYNONYMS:
    make("English", "Easy", f"Choose the word closest in meaning to: {word}", right, wrong, f"'{word.capitalize()}' means {right}.", "vocab")
for word, right, wrong in E.ANTONYMS:
    make("English", "Easy", f"Choose the word opposite in meaning to: {word}", right, wrong, f"The opposite of '{word}' is '{right}'.", "vocab")
for sentence, right, wrong, why in E.FILL_BLANKS:
    make("English", "Medium", "Fill in the blank:\n" + sentence, right, wrong, why, "grammar")
for parts, bad, why in E.ERROR_SPOT:
    sentence = " ".join(parts)
    wrong = [p for i, p in enumerate(parts) if i != bad]
    make("English", "Medium", "Find the part of the sentence that has an error:\n" + sentence, parts[bad], wrong, why, "grammar")
for meaning, right, wrong in E.ONE_WORD:
    make("English", "Medium", f"Choose the one word that can be substituted for: {meaning}", right, wrong, f"'{right.capitalize()}' means {meaning.lower()}.", "vocab")
for idiom, right, wrong in E.IDIOMS:
    make("English", "Medium", f"Choose the meaning of the idiom: {idiom}", right, wrong, f"'{idiom.capitalize()}' means {right}.", "idiom")
passage_sets = []
for title, text, qs in E.PASSAGES:
    block = []
    for question, right, wrong, why in qs:
        block.append(make("English Comprehension", "Medium", f"Read the passage and answer the question.\n\n{title}\n{text}\n\n{question}", right, wrong, why, "passage"))
    passage_sets.append(block)

# ---------- Quantitative ----------
def pct():
    for _ in range(6):
        p = rng.choice([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75]); base = rng.choice([40, 60, 80, 120, 150, 200, 240, 360, 400, 480, 600])
        ans = base * p // 100
        if base * p % 100: continue
        make("Quantitative Aptitude", "Easy", f"What is {p}% of {base}?", ans, near(ans, max(2, ans // 10)), f"{p}% of {base} = {p}/100 × {base} = {ans}.", "quant")
    for _ in range(3):
        base = rng.choice([200, 400, 500, 800, 1000]); up = rng.choice([10, 20, 25, 30]); down = rng.choice([10, 20, 25])
        mid = base * (100 + up) // 100; end = mid * (100 - down) // 100
        if base * (100 + up) % 100 or mid * (100 - down) % 100: continue
        make("Quantitative Aptitude", "Medium", f"A price of Rs {base} is increased by {up}% and then decreased by {down}%. What is the final price?", end, near(end, max(5, end // 20)), f"After the rise: {base} × {100 + up}/100 = {mid}. After the fall: {mid} × {100 - down}/100 = {end}.", "quant")
    for _ in range(3):
        total = rng.choice([50, 80, 120, 200, 250]); score = rng.choice([30, 36, 40, 45, 60, 90, 120, 150, 100])
        if score >= total or (score * 100) % total: continue
        ans = score * 100 // total
        make("Quantitative Aptitude", "Easy", f"A student scores {score} marks out of {total}. What is the percentage?", ans, near(ans, 5), f"({score}/{total}) × 100 = {ans}%.", "quant")
def ratio():
    for _ in range(4):
        a, b = rng.choice([(2, 3), (3, 4), (4, 5), (5, 7), (3, 5), (2, 5)]); k = rng.randint(3, 12); total = (a + b) * k
        make("Quantitative Aptitude", "Easy", f"Two numbers are in the ratio {a}:{b} and their sum is {total}. What is the larger number?", b * k, near(b * k, k), f"Total parts = {a + b}; one part = {total}/{a + b} = {k}; larger = {b} × {k} = {b * k}.", "quant")
    for _ in range(3):
        a, b = rng.choice([(2, 3), (3, 5), (4, 7)]); k = rng.randint(4, 15); diff = (b - a) * k
        make("Quantitative Aptitude", "Medium", f"The ages of two friends are in the ratio {a}:{b}. If the difference of their ages is {diff} years, what is the age of the elder friend?", b * k, near(b * k, k), f"One part = {diff}/{b - a} = {k}; elder = {b} × {k} = {b * k} years.", "quant")
def average():
    for _ in range(4):
        n = rng.choice([4, 5, 6, 8]); avg = rng.randint(12, 40); total = n * avg
        make("Quantitative Aptitude", "Easy", f"The sum of {n} numbers is {total}. What is their average?", avg, near(avg, 2), f"Average = {total}/{n} = {avg}.", "quant")
    for _ in range(3):
        n = rng.choice([5, 6, 8, 10]); avg = rng.randint(20, 50); new = rng.randint(avg + 6, avg + 30)
        ans = Fraction(avg * n + new, n + 1)
        if ans.denominator != 1: continue
        ans = int(ans)
        make("Quantitative Aptitude", "Medium", f"The average of {n} numbers is {avg}. A new number {new} is included. What is the new average?", ans, near(ans, 1), f"New total = {avg * n} + {new} = {avg * n + new}; new average = {avg * n + new}/{n + 1} = {ans}.", "quant")
def profit():
    for _ in range(5):
        cp = rng.choice([200, 250, 400, 500, 800, 1200]); p = rng.choice([10, 15, 20, 25, 30]); sp = cp * (100 + p) // 100
        if cp * (100 + p) % 100: continue
        make("Quantitative Aptitude", "Medium", f"A shirt bought for Rs {cp} is sold for Rs {sp}. What is the profit percentage?", p, near(p, 5), f"Profit = {sp} − {cp} = {sp - cp}; profit % = {sp - cp}/{cp} × 100 = {p}%.", "quant")
    for _ in range(4):
        sp = rng.choice([480, 600, 720, 900, 1080, 1200]); p = rng.choice([20, 25, 50]); cp = Fraction(sp * 100, 100 + p)
        if cp.denominator != 1: continue
        cp = int(cp)
        make("Quantitative Aptitude", "Medium", f"A bag is sold for Rs {sp} at a profit of {p}%. What is its cost price?", cp, near(cp, max(10, cp // 10)), f"Cost price = {sp} × 100/{100 + p} = {cp}.", "quant")
    for _ in range(3):
        mp = rng.choice([500, 800, 1000, 1500]); d = rng.choice([10, 20, 25]); ans = mp * (100 - d) // 100
        if mp * (100 - d) % 100: continue
        make("Quantitative Aptitude", "Easy", f"A jacket has a marked price of Rs {mp}. A discount of {d}% is offered. What is the selling price?", ans, near(ans, max(10, ans // 20)), f"Selling price = {mp} × {100 - d}/100 = {ans}.", "quant")
def interest():
    for _ in range(4):
        P = rng.choice([1000, 2000, 5000, 8000]); r = rng.choice([4, 5, 6, 8, 10]); t = rng.choice([2, 3, 4, 5]); si = P * r * t // 100
        make("Quantitative Aptitude", "Medium", f"What is the simple interest on Rs {P} at {r}% per annum for {t} years?", si, near(si, max(20, si // 10)), f"SI = P × R × T/100 = {P} × {r} × {t}/100 = {si}.", "quant")
    for _ in range(2):
        P = rng.choice([2000, 4000, 5000]); r = rng.choice([5, 10]); t = rng.choice([2, 4]); si = P * r * t // 100
        make("Quantitative Aptitude", "Medium", f"A sum of Rs {P} earns simple interest of Rs {si} in {t} years. What is the rate per annum?", r, near(r, 2), f"Rate = SI × 100/(P × T) = {si} × 100/({P} × {t}) = {r}%.", "quant")
def speed():
    for _ in range(4):
        v = rng.choice([30, 40, 45, 50, 60, 72]); t = rng.choice([2, 3, 4, 5]); d = v * t
        make("Quantitative Aptitude", "Easy", f"A bus travels at {v} km/h for {t} hours. How far does it travel?", d, near(d, v // 2), f"Distance = speed × time = {v} × {t} = {d} km.", "quant")
    for _ in range(3):
        d = rng.choice([120, 150, 180, 240, 300]); t = rng.choice([2, 3, 4, 5]); 
        if d % t: continue
        v = d // t
        make("Quantitative Aptitude", "Medium", f"A cyclist covers {d} km in {t} hours. What is the average speed in km/h?", v, near(v, 5), f"Speed = {d}/{t} = {v} km/h.", "quant")
    for _ in range(2):
        kmh = rng.choice([36, 54, 72, 90]); ms = kmh * 5 // 18
        make("Quantitative Aptitude", "Medium", f"Convert {kmh} km/h to metres per second.", ms, near(ms, 2), f"{kmh} × 5/18 = {ms} m/s.", "quant")
def work():
    for _ in range(4):
        a, b = rng.choice([(10, 15), (12, 24), (20, 30), (6, 12), (15, 30), (8, 24)]); t = Fraction(a * b, a + b)
        if t.denominator != 1: continue
        make("Quantitative Aptitude", "Medium", f"A can finish a job in {a} days and B in {b} days. Working together, how many days will they take?", int(t), near(int(t), 1), f"Combined rate = 1/{a} + 1/{b} = {a + b}/{a * b}; time = {a * b}/{a + b} = {int(t)} days.", "quant")
    for _ in range(2):
        m, d = rng.choice([(6, 10), (8, 12), (5, 12)]); m2 = m * 2
        make("Quantitative Aptitude", "Medium", f"{m} workers complete a job in {d} days. How many days will {m2} workers take at the same rate?", d // 2, near(d // 2, 1), f"Double the workers halves the time: {d}/2 = {d // 2} days.", "quant")
def algebra():
    for _ in range(5):
        x = rng.randint(2, 15); a = rng.randint(2, 7); b = rng.randint(1, 20); c = a * x + b
        make("Quantitative Aptitude", "Easy", f"If {a}x + {b} = {c}, what is the value of x?", x, near(x, 1), f"{a}x = {c} − {b} = {c - b}, so x = {x}.", "quant")
    for _ in range(3):
        x = rng.randint(3, 12); y = rng.randint(2, 9); s = x + y; d = x - y
        if d <= 0: continue
        make("Quantitative Aptitude", "Medium", f"The sum of two numbers is {s} and their difference is {d}. What is the larger number?", x, near(x, 1), f"Larger = (sum + difference)/2 = ({s} + {d})/2 = {x}.", "quant")
def series():
    for _ in range(3):
        a = rng.randint(2, 9); d = rng.randint(3, 8); seq = [a + i * d for i in range(5)]; ans = a + 5 * d
        make("Quantitative Aptitude", "Easy", f"Find the next number: {', '.join(map(str, seq))}, ?", ans, near(ans, 1), f"The common difference is {d}, so the next term is {seq[-1]} + {d} = {ans}.", "quant")
    for _ in range(2):
        a = rng.choice([2, 3]); r = rng.choice([2, 3]); seq = [a * r ** i for i in range(5)]; ans = a * r ** 5
        make("Quantitative Aptitude", "Medium", f"Find the next number: {', '.join(map(str, seq))}, ?", ans, near(ans, r), f"Each term is multiplied by {r}; next = {seq[-1]} × {r} = {ans}.", "quant")
    for _ in range(2):
        s = rng.randint(2, 6); seq = [(s + i) ** 2 for i in range(4)]; ans = (s + 4) ** 2
        make("Quantitative Aptitude", "Medium", f"Find the next number: {', '.join(map(str, seq))}, ?", ans, near(ans, 2), f"These are squares of consecutive numbers; next = {s + 4}² = {ans}.", "quant")
def geometry():
    for _ in range(3):
        l, w = rng.randint(6, 20), rng.randint(3, 12)
        if l == w: continue
        make("Quantitative Aptitude", "Easy", f"What is the area of a rectangle {l} cm long and {w} cm wide (in cm²)?", l * w, near(l * w, l), f"Area = {l} × {w} = {l * w} cm².", "quant")
    for _ in range(3):
        l, w = rng.randint(8, 25), rng.randint(4, 12)
        if l == w: continue
        make("Quantitative Aptitude", "Easy", f"What is the perimeter of a rectangle {l} cm by {w} cm (in cm)?", 2 * (l + w), near(2 * (l + w), 2), f"Perimeter = 2 × ({l} + {w}) = {2 * (l + w)} cm.", "quant")
    for _ in range(3):
        b, h = rng.choice([(6, 8), (10, 12), (14, 9), (16, 5), (18, 7)]); area = b * h // 2
        make("Quantitative Aptitude", "Easy", f"A triangle has base {b} cm and height {h} cm. What is its area in cm²?", area, near(area, 3), f"Area = 1/2 × {b} × {h} = {area} cm².", "quant")
    for _ in range(2):
        r = rng.choice([7, 14, 21]); area = 22 * r * r // 7
        make("Quantitative Aptitude", "Medium", f"What is the area of a circle of radius {r} cm? (Use π = 22/7; answer in cm²)", area, near(area, 22), f"Area = πr² = 22/7 × {r} × {r} = {area} cm².", "quant")
def numbers():
    for _ in range(3):
        a, b = rng.choice([(12, 18), (8, 12), (15, 20), (9, 15), (16, 24), (14, 21)]); l = a * b // gcd(a, b)
        make("Quantitative Aptitude", "Medium", f"What is the LCM of {a} and {b}?", l, near(l, a // 2 or 1), f"LCM({a}, {b}) = {a} × {b}/HCF = {l}.", "quant")
    for _ in range(3):
        a, b = rng.choice([(24, 36), (18, 45), (30, 48), (28, 42), (36, 60)]); g = gcd(a, b)
        make("Quantitative Aptitude", "Medium", f"What is the HCF of {a} and {b}?", g, near(g, 2), f"The largest number dividing both {a} and {b} is {g}.", "quant")
    for _ in range(3):
        n, d, m = rng.choice([(3, 4, 5), (2, 3, 7), (5, 6, 3)]); f1 = Fraction(n, d) + Fraction(1, m)
        make("Quantitative Aptitude", "Medium", f"What is {n}/{d} + 1/{m}?", fmt(f1), [fmt(f1 + Fraction(1, d * m)), fmt(f1 - Fraction(1, d * m)), fmt(Fraction(n + 1, d + m))], f"{n}/{d} + 1/{m} = {fmt(f1)}.", "quant")
def ages():
    for _ in range(3):
        c = rng.randint(8, 14); f = rng.choice([3, 4]) * c; ans = f + 5 - (c + 5)
        make("Quantitative Aptitude", "Medium", f"A father is {f // c} times as old as his son. The son is {c} years old. How old will the father be after 5 years?", f + 5, near(f + 5, 5), f"Father now = {f // c} × {c} = {f}; after 5 years = {f + 5}.", "quant")
for gen in (pct, ratio, average, profit, interest, speed, work, algebra, series, geometry, numbers, ages):
    gen()

# ---------- assemble ----------
def to_js_question(q, qid, with_marks=True):
    return {"id": qid, "type": "MCQ", "topic": q["topic"], "difficulty": q["difficulty"], "marks": 1, "negative": 0.25,
            "prompt": q["prompt"], "options": [{"id": LETTERS[i], "text": str(t)} for i, t in enumerate(q["options"])],
            "correctAnswer": q["correctAnswer"], "solution": q["solution"],
            "source": "original", "licence": "owned", "status": "published", "version": "4"}

drill_out = []
for i, q in enumerate(drills, 1):
    d = to_js_question(q, f"nift-drill-b4-{i}")
    d["examId"] = "nift"
    drill_out.append(d)

by_group = {}
for q in drills: by_group.setdefault(q["group"], []).append(q)
quant = by_group["quant"]; vocab = by_group["vocab"]; grammar = by_group["grammar"]; idiom = by_group["idiom"]

papers = []
for n in range(3):
    pq = passage_sets[n]
    english = (pq + vocab[n * 3:n * 3 + 3] + vocab[20 + n * 3:20 + n * 3 + 3] + grammar[n * 5:n * 5 + 5] + grammar[25 + n * 3:25 + n * 3 + 3] + idiom[n * 2:n * 2 + 2] + vocab[40 + n * 2:40 + n * 2 + 2])
    qs_quant = quant[n * 15:n * 15 + 15]
    sections = []
    for sid, label, items in (("english", "Communication Ability & English", english), ("quant", "Quantitative Ability", qs_quant)):
        built = [to_js_question(q, f"nift-orig-m{n + 1}-{sid}-{j + 1}") for j, q in enumerate(items)]
        sections.append({"id": f"nift-orig-m{n + 1}-{sid}", "title": label, "label": "MCQ", "type": "MCQ", "marks": 1, "negative": 0.25,
                         "instructions": "Choose one option. Correct = +1. Wrong = −0.25.", "questions": built})
    total = sum(len(s["questions"]) for s in sections)
    papers.append({"id": f"nift-original-mock-{n + 1}", "examId": "nift", "examName": "NIFT", "year": 2026, "mode": "mini",
                   "title": f"NIFT English & Quant Original Mock {n + 1}", "subtitle": "NIFT-style · original practice paper",
                   "description": "English (grammar, vocabulary, comprehension) and quantitative ability in the NIFT GAT style. Original questions written for this project.",
                   "durationMinutes": 45, "totalMarks": total, "sections": sections})

js = "/* Original NIFT-style English and quantitative drills and mocks (batch 4).\n   Generated by tools/generate_nift_original_batch.py; every question is original. */\n(function () {\n  var drills = " + json.dumps(drill_out, indent=1, ensure_ascii=False) + ";\n  var papers = " + json.dumps(papers, indent=1, ensure_ascii=False) + ";\n  window.PRACTICE_BANK.push.apply(window.PRACTICE_BANK, drills);\n  window.MOCK_PAPERS.push.apply(window.MOCK_PAPERS, papers);\n})();\n"
(ROOT / "practice-batch-4.js").write_text(js)
print("drills", len(drill_out), {k: len(v) for k, v in by_group.items()}, "papers", [(p["id"], p["totalMarks"]) for p in papers])
