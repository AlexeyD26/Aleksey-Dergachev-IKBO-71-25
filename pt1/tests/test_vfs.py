import base64
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_DIR / "src"))
from vfs import load_vfs


class VfsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.path = self.folder / "vfs.json"

    def write_vfs(self, data):
        self.path.write_text(json.dumps(data), encoding="utf-8")
        return self.path

    def test_minimal_and_default(self):
        self.assertEqual(load_vfs(None), {})
        self.assertEqual(load_vfs(self.write_vfs({})), {})

    def test_files_stay_in_memory(self):
        data = b"\x00\x01\x02\xff"
        self.write_vfs({
            "binary.bin": base64.b64encode(data).decode(),
            "hello.txt": "SGVsbG8hCg==",
            "empty.txt": "",
        })
        before_data = self.path.read_bytes()
        before_files = set(self.folder.iterdir())
        vfs = load_vfs(self.path)
        self.assertEqual(vfs["binary.bin"], data)
        self.assertEqual(vfs["hello.txt"], b"Hello!\n")
        self.assertEqual(vfs["empty.txt"], b"")
        self.assertEqual(self.path.read_bytes(), before_data)
        self.assertEqual(set(self.folder.iterdir()), before_files)

    def test_nested_folders(self):
        path = self.write_vfs({
            "home": {"student": {"docs": {"note.txt": "Tm90ZXMK"}}},
            "empty": {},
        })
        vfs = load_vfs(path)
        self.assertEqual(vfs["home"]["student"]["docs"]["note.txt"], b"Notes\n")
        self.assertEqual(vfs["empty"], {})
        self.assertFalse((self.folder / "home").exists())

    def test_invalid_root(self):
        for data in [[], "text", None]:
            with self.subTest(data=data):
                with self.assertRaises(ValueError):
                    load_vfs(self.write_vfs(data))

    def test_invalid_file_data(self):
        for data in ["invalid!", "привет", 123, [], None]:
            with self.subTest(data=data):
                with self.assertRaises(ValueError):
                    load_vfs(self.write_vfs({"file.txt": data}))

    def test_invalid_names(self):
        for name in ["", ".", "..", "a/b", "\0"]:
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    load_vfs(self.write_vfs({name: ""}))

    def test_startup_errors(self):
        self.path.write_text("{broken", encoding="utf-8")
        bad_base64 = self.folder / "bad.json"
        bad_base64.write_text('{"file.txt": "!"}', encoding="utf-8")
        for path in [self.folder / "missing.json", self.path, bad_base64]:
            with self.subTest(path=path.name):
                result = subprocess.run(
                    [sys.executable, str(PROJECT_DIR / "src" / "main.py"),
                     "--vfs", str(path)],
                    input="ls\nexit\n",
                    text=True,
                    capture_output=True,
                    timeout=5,
                )
                self.assertEqual(result.returncode, 1)
                self.assertIn("Ошибка загрузки VFS", result.stdout)
                self.assertNotIn("Traceback", result.stderr)
                self.assertNotIn("Команда: ls", result.stdout)

    def test_example_files(self):
        folder = PROJECT_DIR / "examples" / "vfs"
        self.assertEqual(load_vfs(folder / "minimal.json"), {})
        files = load_vfs(folder / "files.json")
        self.assertEqual(files["hello.txt"], b"Hello!\n")
        self.assertEqual(files["binary.bin"], b"\x00\x01\x02\x03\xff")
        deep = load_vfs(folder / "deep.json")
        docs = deep["home"]["student"]["docs"]
        self.assertEqual(docs["note.txt"], b"Notes\n")
        self.assertEqual(docs["nested file.txt"], b"File with a space\n")


if __name__ == "__main__":
    unittest.main()
