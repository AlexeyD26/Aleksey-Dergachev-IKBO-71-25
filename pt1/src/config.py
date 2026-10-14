import argparse
import xml.etree.ElementTree as ET


def read_args():
    parser = argparse.ArgumentParser(
        description="Эмулятор UNIX-оболочки: вариант 7."
    )

    parser.add_argument("--vfs", help="Путь к файлу VFS.")
    parser.add_argument("--script", help="Путь к стартовому скрипту.")
    parser.add_argument("--config", help="Путь к XML-конфигурации.")

    try:
        return load_config(parser.parse_args())
    except (OSError, ET.ParseError, ValueError, LookupError) as error:
        parser.error(f"Ошибка чтения XML-конфигурации: {error}")


def show_config(args):
    print(f"VFS: {args.vfs}")
    print(f"Стартовый скрипт: {args.script}")
    print(f"Конфигурация: {args.config}")


def load_config(args):
    if args.config is None:
        return args

    root = ET.parse(args.config).getroot()

    if root.tag != "config":
        raise ValueError("Ожидается корневой элемент <config>.")

    if args.vfs is None:
        args.vfs = root.findtext("vfs", "").strip() or None

    if args.script is None:
        args.script = root.findtext("script", "").strip() or None

    return args
