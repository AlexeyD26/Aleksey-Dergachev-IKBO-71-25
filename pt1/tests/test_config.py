import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


MAIN_FILE = Path(__file__).resolve().parents[1] / "src" / "main.py"


class ConfigTests(unittest.TestCase):

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        for name in ["from config.json", "from-cli.json", "new.json"]:
            (self.folder / name).write_text("{}", encoding="utf-8")
        self.script = self.folder / "start script.txt"
        self.script.write_text("ls from-script\nexit\n", encoding="utf-8")
        self.config = self.folder / "config.xml"
        self.config.write_text(
            "<config><vfs>from config.json</vfs>"
            "<script>start script.txt</script></config>", encoding="utf-8"
        )

    def run_shell(self, options, commands=""):
        return subprocess.run(
            [sys.executable, str(MAIN_FILE)] + options,
            input=commands,
            text=True,
            capture_output=True,
            timeout=5,
            cwd=self.folder,
        )

    def test_xml_settings(self):
        result = self.run_shell(["--config", str(self.config)])
        self.assertEqual(result.returncode, 0)
        self.assertIn("VFS: from config.json", result.stdout)
        self.assertIn("Стартовый скрипт: start script.txt", result.stdout)
        self.assertIn(f"Конфигурация: {self.config}", result.stdout)
        self.assertIn("from config> ls from-script", result.stdout)
        self.assertIn("Команда: ls; аргументы: ['from-script']", result.stdout)

    def test_vfs_priority(self):
        result = self.run_shell([
            "--config", str(self.config), "--vfs", "from-cli.json"
        ])
        self.assertEqual(result.returncode, 0)
        self.assertIn("VFS: from-cli.json", result.stdout)
        self.assertIn("Стартовый скрипт: start script.txt", result.stdout)
        self.assertIn("from-cli> ls from-script", result.stdout)

    def test_script_priority(self):
        script = self.folder / "other.txt"
        script.write_text("cd from-cli\nexit\n", encoding="utf-8")
        result = self.run_shell([
            "--config", str(self.config), "--script", str(script)
        ])
        self.assertEqual(result.returncode, 0)
        self.assertIn("VFS: from config.json", result.stdout)
        self.assertIn(f"Стартовый скрипт: {script}", result.stdout)
        self.assertIn("Команда: cd; аргументы: ['from-cli']", result.stdout)
        self.assertNotIn("Команда: ls", result.stdout)

    def test_both_priorities(self):
        self.config.write_text(
            "<config><vfs>old.json</vfs>"
            "<script>missing.txt</script></config>", encoding="utf-8"
        )
        result = self.run_shell([
            "--config", str(self.config), "--vfs", "new.json",
            "--script", str(self.script)
        ])
        self.assertEqual(result.returncode, 0)
        self.assertIn("VFS: new.json", result.stdout)
        self.assertIn(f"Стартовый скрипт: {self.script}", result.stdout)
        self.assertIn("Команда: ls", result.stdout)

    def test_config_errors(self):
        broken = self.folder / "broken.xml"
        broken.write_text("<config>", encoding="utf-8")
        wrong_root = self.folder / "wrong-root.xml"
        wrong_root.write_text("<settings/>", encoding="utf-8")
        for path in [self.folder / "missing.xml", broken, wrong_root]:
            with self.subTest(path=path.name):
                result = self.run_shell(["--config", str(path)])
                self.assertEqual(result.returncode, 2)
                self.assertIn("Ошибка чтения XML", result.stderr)
                self.assertNotIn("Traceback", result.stderr)

    def test_empty_config(self):
        self.config.write_text("<config/>", encoding="utf-8")
        result = self.run_shell(["--config", str(self.config)], "exit\n")
        self.assertEqual(result.returncode, 0)
        self.assertIn("VFS: None", result.stdout)
        self.assertIn("Стартовый скрипт: None", result.stdout)
        self.assertIn("my-vfs>", result.stdout)

    def test_script_errors_and_exit(self):
        self.script.write_text(
            "ls\nunknown\ncd \"broken\nexit extra\n\n"
            "cd \"my documents\"\nls after-error\nexit\nls after-exit\n",
            encoding="utf-8"
        )
        result = self.run_shell(
            ["--script", str(self.script)], "unknown-from-input\n"
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("my-vfs> unknown", result.stdout)
        self.assertIn("Строка 2: Неизвестная команда", result.stdout)
        self.assertIn("Строка 3: Ошибка ввода", result.stdout)
        self.assertIn("Строка 4: Ошибка: exit", result.stdout)
        self.assertIn("Команда: cd; аргументы: ['my documents']", result.stdout)
        self.assertIn("Команда: ls; аргументы: ['after-error']", result.stdout)
        self.assertNotIn("after-exit", result.stdout)
        self.assertNotIn("unknown-from-input", result.stdout)

    def test_script_file_errors(self):
        bad_script = self.folder / "bad.txt"
        bad_script.write_bytes(b"\xff\xfe")
        for path in [self.folder / "missing.txt", bad_script]:
            with self.subTest(path=path.name):
                result = self.run_shell(["--script", str(path)])
                self.assertEqual(result.returncode, 1)
                self.assertIn("Ошибка чтения стартового", result.stdout)
                self.assertNotIn("Traceback", result.stderr)

    def test_repl_after_script(self):
        self.script.write_text("ls from-script\n", encoding="utf-8")
        result = self.run_shell(
            ["--script", str(self.script)], "cd from-input\nexit\n"
        )
        self.assertEqual(result.returncode, 0)
        output = result.stdout
        self.assertIn("Команда: ls; аргументы: ['from-script']", output)
        self.assertIn("Команда: cd; аргументы: ['from-input']", output)
        self.assertLess(
            output.index("Команда: ls"), output.index("Команда: cd")
        )


if __name__ == "__main__":
    unittest.main()
