import subprocess
import sys
import unittest
from pathlib import Path


MAIN_FILE = Path(__file__).resolve().parents[1] / "src" / "main.py"


def run_shell(commands):
    result = subprocess.run(
        [sys.executable, str(MAIN_FILE)],
        input=commands,
        text=True,
        capture_output=True,
        timeout=5,
        check=True,
    )
    return result.stdout


class ShellTests(unittest.TestCase):

    def test_commands_and_quotes(self):
        output = run_shell(
            "ls\n"
            "ls \"file one.txt\" 'file two.txt'\n"
            "cd \"my documents\"\n"
            "exit\n"
        )
        self.assertIn("Команда: ls; аргументы: []", output)
        self.assertIn("['file one.txt', 'file two.txt']", output)
        self.assertIn("Команда: cd; аргументы: ['my documents']", output)

    def test_errors(self):
        output = run_shell('hello\ncd "broken\nexit extra\nls\nexit\n')
        self.assertIn("Неизвестная команда: hello", output)
        self.assertIn("Ошибка ввода:", output)
        self.assertIn("exit не принимает аргументы", output)
        self.assertIn("Команда: ls", output)

    def test_empty_input(self):
        output = run_shell("\n   \nexit\n")
        self.assertNotIn("Неизвестная команда", output)
        self.assertNotIn("Ошибка", output)

    def test_exit(self):
        output = run_shell("exit\nhello\n")
        self.assertIn("Эмулятор завершён.", output)
        self.assertNotIn("Неизвестная команда: hello", output)

    def test_eof(self):
        output = run_shell("")
        self.assertIn("Эмулятор завершён.", output)


if __name__ == "__main__":
    unittest.main()
