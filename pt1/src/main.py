import shlex


def execute_command(line):
    """Обрабатывает команду. Возвращает True, если нужно выйти."""
    try:
        parts = shlex.split(line)
    except ValueError as error:
        print(f"Ошибка ввода: {error}")
        return False

    if not parts:
        return False

    command = parts[0]
    arguments = parts[1:]

    if command == "exit":
        if arguments:
            print("Ошибка: exit не принимает аргументы.")
            return False
        return True

    if command in ("ls", "cd"):
        print(f"Команда: {command}; аргументы: {arguments}")
    else:
        print(f"Неизвестная команда: {command}")

    return False


def main():
    """Запускает цикл ввода и обработки команд."""
    vfs_name = "my-vfs"

    while True:
        try:
            line = input(f"{vfs_name}> ")
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if execute_command(line):
            break

    print("Эмулятор завершён.")


if __name__ == "__main__":
    main()
