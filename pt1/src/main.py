import shlex
import sys
from pathlib import Path

from config import read_args, show_config


def execute_command(line, source=""):
    try:
        parts = shlex.split(line)
    except ValueError as error:
        print(f"{source}Ошибка ввода: {error}")
        return False

    if not parts:
        return False

    command = parts[0]
    arguments = parts[1:]

    if command == "exit":
        if arguments:
            print(f"{source}Ошибка: exit не принимает аргументы.")
            return False
        return True

    if command in ("ls", "cd"):
        print(f"Команда: {command}; аргументы: {arguments}")
    else:
        print(f"{source}Неизвестная команда: {command}")
    return False


def run_script(path, vfs_name):
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    for number, line in enumerate(lines, 1):
        print(f"{vfs_name}> {line}")
        if execute_command(line, f"Строка {number}: "):
            return True
    return False


def run_repl(vfs_name):
    while True:
        try:
            line = input(f"{vfs_name}> ")
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if execute_command(line):
            break


def main():
    args = read_args()
    show_config(args)
    vfs_name = Path(args.vfs).stem if args.vfs else "my-vfs"

    if args.script:
        try:
            finished = run_script(args.script, vfs_name)
        except (OSError, UnicodeError) as error:
            print(f"Ошибка чтения стартового скрипта: {error}")
            return 1
        if finished:
            print("Эмулятор завершён.")
            return 0

    run_repl(vfs_name)
    print("Эмулятор завершён.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
