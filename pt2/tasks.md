### Задание 1

```bash
python3 -m pip show matplotlib
```

Установленная версия — **3.9.4**. В файле `METADATA` разобрал основные поля:

- `Name`, `Version`
- `Summary`, `Author`, `License`
- `Metadata-Version`
- `Project-URL`
- `Requires-Python: >=3.9`
- `Requires-Dist`

Получил исходники напрямую из репозитория без менеджера пакетов:

```bash
git clone --depth 1 --branch v3.9.4 https://github.com/matplotlib/matplotlib.git matplotlib-source
```
