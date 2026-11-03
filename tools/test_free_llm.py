#!/usr/bin/env python3
"""Offline tests for tools/free_llm_reader.py and `answer_engine.py ingest-free`.
Run: python3 tools/test_free_llm.py"""
import http.server
import json
import os
import pathlib
import sqlite3
import tempfile
import threading
import unittest

import answer_engine
import free_llm_reader as reader


class Reply(http.server.BaseHTTPRequestHandler):
    seen = []
    plan = []

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        Reply.seen.append({"auth": self.headers.get("Authorization"), "body": body})
        status, payload = Reply.plan.pop(0) if Reply.plan else (200, '{"answer": "B", "confidence": "high"}')
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if status == 429:
            self.send_header("Retry-After", "0")
        self.end_headers()
        if status == 200:
            self.wfile.write(json.dumps({"choices": [{"message": {"content": payload}}]}).encode())
        else:
            self.wfile.write(payload.encode())

    def log_message(self, *args):
        pass


class ParseReply(unittest.TestCase):
    def test_plain_and_fenced_json(self):
        self.assertEqual(reader.parse_reply('{"answer": "C", "confidence": "HIGH"}')["answer"], "C")
        fenced = 'Thinking...\n```json\n{"answer": "AC", "confidence": "medium", "badCrop": true}\n```'
        parsed = reader.parse_reply(fenced)
        self.assertEqual((parsed["answer"], parsed["confidence"], parsed["badCrop"]), ("AC", "medium", True))

    def test_null_and_garbage(self):
        self.assertIsNone(reader.parse_reply('{"answer": null, "confidence": "low"}')["answer"])
        self.assertIsNone(reader.parse_reply("I cannot tell."))
        self.assertIsNone(reader.parse_reply(""))


class Chat(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.HTTPServer(("127.0.0.1", 0), Reply)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.spec = {"base_url": f"http://127.0.0.1:{cls.server.server_port}/v1", "model": "m", "key_env": "TEST_KEY", "rpm": 6000}
        os.environ["TEST_KEY"] = "secret-value"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        Reply.seen, Reply.plan = [], []

    def test_text_question_sends_key_and_options(self):
        item = {"id": "q", "type": "MCQ", "image": None, "prompt": "Pick one", "options": [{"position": "A", "text": "x"}, {"position": "B", "text": "y"}]}
        text = reader.chat(self.spec, reader.build_messages(item, self.spec))
        self.assertEqual(reader.parse_reply(text)["answer"], "B")
        self.assertEqual(Reply.seen[0]["auth"], "Bearer secret-value")
        self.assertIn("B) y", Reply.seen[0]["body"]["messages"][0]["content"])

    def test_image_question_sends_data_url(self):
        from PIL import Image

        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / "q.png"
            Image.new("RGB", (3000, 1000), "white").save(path)
            item = {"id": "q", "type": "MCQ", "image": str(path)}
            reader.chat(self.spec, reader.build_messages(item, self.spec))
        part = Reply.seen[0]["body"]["messages"][0]["content"][1]
        self.assertTrue(part["image_url"]["url"].startswith("data:image/"))

    def test_retries_after_rate_limit(self):
        Reply.plan = [(429, "slow down")]
        text = reader.chat(self.spec, [{"role": "user", "content": "hi"}])
        self.assertEqual(reader.parse_reply(text)["answer"], "B")
        self.assertEqual(len(Reply.seen), 2)

    def test_daily_quota_stops(self):
        Reply.plan = [(429, "quota exceeded for today")] * 3
        with self.assertRaises(reader.Quota):
            reader.chat(self.spec, [{"role": "user", "content": "hi"}])

    def test_bad_key_is_fatal_and_never_echoed(self):
        Reply.plan = [(401, "bad key secret-value")]
        with self.assertRaises(SystemExit) as caught:
            reader.chat(self.spec, [{"role": "user", "content": "hi"}])
        self.assertNotIn("secret-value", str(caught.exception))


class IngestFree(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.db = pathlib.Path(self.folder.name) / "bank.sqlite"
        answer_engine.DB = self.db
        conn = sqlite3.connect(self.db)
        conn.execute("""CREATE TABLE questions (id TEXT, paper_id TEXT, question_no TEXT, question_type TEXT, prompt TEXT,
            options_json TEXT, answer_key TEXT, answer_status TEXT, answer_verification TEXT, answer_source_json TEXT,
            block_path TEXT, crop_review TEXT, figure_paths_json TEXT, status TEXT, review_notes_json TEXT, updated_at TEXT)""")
        options = json.dumps([{"id": "A", "text": "a"}, {"id": "B", "text": "b"}, {"id": "C", "text": "c"}, {"id": "D", "text": "d"}])
        rows = [("claude-key", "B", "independently-solved", None), ("free-key", "C", "independently-solved", None),
                ("unkeyed", None, "pending", None), ("official", "A", "official-key", None)]
        for question_id, key, status, verification in rows:
            conn.execute("INSERT INTO questions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                         (question_id, "nift-x", "1", "MCQ", "p", options, key, status, verification,
                          json.dumps({"solve": {"method": "free-llm"}}) if question_id == "free-key" else None,
                          None, "approved", "[]", None, None, None))
        conn.commit()
        conn.close()

    def tearDown(self):
        self.folder.cleanup()

    def votes(self, provider, **answers):
        path = pathlib.Path(self.folder.name) / "lane" / "results" / provider / "batch.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({q: {"answer": a, "confidence": "high"} for q, a in answers.items()}))
        return str(path)

    def state(self, question_id):
        conn = sqlite3.connect(self.db)
        conn.row_factory = sqlite3.Row
        return dict(conn.execute("SELECT * FROM questions WHERE id=?", (question_id,)).fetchone())

    def test_two_providers_verify_a_claude_key(self):
        answer_engine.ingest_free(type("A", (), {"files": [self.votes("gemini", **{"claude-key": "B"})]}))
        self.assertIsNone(self.state("claude-key")["answer_verification"])
        answer_engine.ingest_free(type("A", (), {"files": [self.votes("groq", **{"claude-key": "B"})]}))
        self.assertEqual(self.state("claude-key")["answer_verification"], "second-pass-reproduced")

    def test_free_made_key_needs_three(self):
        for provider in ("gemini", "groq"):
            answer_engine.ingest_free(type("A", (), {"files": [self.votes(provider, **{"free-key": "C"})]}))
        self.assertIsNone(self.state("free-key")["answer_verification"])
        answer_engine.ingest_free(type("A", (), {"files": [self.votes("mistral", **{"free-key": "C"})]}))
        self.assertEqual(self.state("free-key")["answer_verification"], "second-pass-reproduced")

    def test_two_providers_contradicting_a_key_disagree(self):
        for provider in ("gemini", "groq"):
            answer_engine.ingest_free(type("A", (), {"files": [self.votes(provider, **{"claude-key": "D"})]}))
        self.assertEqual(self.state("claude-key")["answer_verification"], "second-pass-disagreed")

    def test_unkeyed_gets_a_key_only_from_two_agreeing(self):
        answer_engine.ingest_free(type("A", (), {"files": [self.votes("gemini", unkeyed="A")]}))
        self.assertIsNone(self.state("unkeyed")["answer_key"])
        answer_engine.ingest_free(type("A", (), {"files": [self.votes("groq", unkeyed="A")]}))
        row = self.state("unkeyed")
        self.assertEqual((row["answer_key"], row["answer_status"], row["answer_verification"]), ("A", "independently-solved", None))

    def test_official_keys_are_never_touched(self):
        for provider in ("gemini", "groq", "mistral"):
            answer_engine.ingest_free(type("A", (), {"files": [self.votes(provider, official="D")]}))
        row = self.state("official")
        self.assertEqual((row["answer_key"], row["answer_status"], row["answer_verification"]), ("A", "official-key", None))

    def test_low_confidence_is_not_a_vote(self):
        path = pathlib.Path(self.folder.name) / "lane" / "results" / "gemini" / "low.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"unkeyed": {"answer": "A", "confidence": "low"}}))
        answer_engine.ingest_free(type("A", (), {"files": [str(path)]}))
        self.assertNotIn("free_votes", self.state("unkeyed")["answer_source_json"] or "")


if __name__ == "__main__":
    unittest.main(verbosity=1)
