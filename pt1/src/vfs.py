import base64
import json


def load_vfs(path):
    if path is None:
        return {}

    with open(path, encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError("Корень VFS должен быть объектом JSON.")

    return read_folder(data)


def read_folder(folder):
    result = {}
    for name, value in folder.items():
        if name in ("", ".", "..") or "/" in name or "\0" in name:
            raise ValueError(f"Недопустимое имя в VFS: {name!r}")
        if isinstance(value, dict):
            result[name] = read_folder(value)
        elif isinstance(value, str):
            result[name] = base64.b64decode(value, validate=True)
        else:
            raise ValueError(f"Неверное содержимое файла: {name}")
    return result
