# Сравнение с Cargo

Проверено 31 октября 2026 года: Cargo 1.99.1,
Mermaid CLI 12.0.0, Node.js 26.12.1.

Программа сама получает данные из индекса Cargo.
Cargo используется отдельно, только для проверки результата.

## Три примера визуализации

```sh
./run.sh examples/adler2.yaml
./run.sh examples/cfg-if.yaml
./run.sh examples/tinyvec-macros.yaml
```

Рядом с каждым YAML появляются PNG и исходный текст Mermaid (`.mmd`).
Они исключены из Git и создаются повторно этими командами.

| Пакет | Вершины нашего графа | Рёбра |
| --- | --- | --- |
| `adler2@2.0.1` | `adler2@2.0.1`, `rustc-std-workspace-core@1.0.1` | Одна связь между ними. |
| `cfg-if@1.0.4` | `cfg-if@1.0.4`, `rustc-std-workspace-core@1.0.1` | Одна связь между ними. |
| `tinyvec_macros@0.1.1` | `tinyvec_macros@0.1.1` | Нет зависимостей. |

## Получение результата Cargo

Для повторной проверки нужен установленный Cargo:

```sh
./scripts/compare.sh
```

Если Cargo находится вне PATH, путь передаётся через `CARGO_BIN`.
Скрипт создаёт временные проекты с точными версиями зависимостей,
запускает `cargo tree` и удаляет временные проекты.
Результаты записываются в `examples/cargo-*.txt`.

Для каждого проекта используется команда:

```sh
cargo tree --manifest-path ПУТЬ/Cargo.toml \
  -p ИМЯ@ВЕРСИЯ --target all --edges normal,build,dev --charset ascii
```

Сначала зависимость в тестовом Cargo.toml задаётся так:

```toml
[dependencies]
adler2 = { version = "=2.0.1", features = [] }
```

В дополнительной проверке `adler2` и `cfg-if` включается feature:

```toml
[dependencies]
adler2 = { version = "=2.0.1", features = ["rustc-dep-of-std"] }
```

## Результаты

| Пакет | Cargo с обычными features | Cargo с `rustc-dep-of-std` | Объяснение |
| --- | --- | --- | --- |
| `adler2@2.0.1` | Одна вершина, без зависимостей. | Две вершины, связь с `rustc-std-workspace-core@1.0.1`. | Наша программа включает объявленную optional-зависимость; Cargo включает её при активации feature. |
| `cfg-if@1.0.4` | Одна вершина, без зависимостей. | Две вершины, связь с `rustc-std-workspace-core@1.0.1`. | То же различие в обработке optional-зависимости. |
| `tinyvec_macros@0.1.1` | Одна вершина, без зависимостей. | Дополнительная проверка не требуется. | Результаты совпадают: пакет не объявляет зависимостей. |

Например, Cargo с включённым feature выводит:

```text
adler2 v2.0.1
`-- rustc-std-workspace-core v1.0.1
```

Это те же две вершины и то же ребро, что в нашей PNG-диаграмме.
Исходный вывод команд сохранён в файлах:

- [adler2, обычные features](../examples/cargo-adler2-default.txt).
- [adler2, включённый feature](../examples/cargo-adler2-enabled.txt).
- [cfg-if, обычные features](../examples/cargo-cfg-if-default.txt).
- [cfg-if, включённый feature](../examples/cargo-cfg-if-enabled.txt).
- [tinyvec_macros](../examples/cargo-tinyvec_macros-default.txt).

## Почему графы могут отличаться на других пакетах

Наш граф показывает все объявленные зависимости, включая optional,
dev, build и зависимости других платформ. Версия каждой связи выбирается
отдельно; features, Cargo.lock и согласование версий между ветвями
не вычисляются. Отозванные версии могут присутствовать с пометкой yanked.
Cargo строит результат с учётом своих правил разрешения зависимостей.

Для этих трёх примеров все найденные расхождения объясняются optional
и подтверждены повторным запуском с нужным feature.
Поведение штатного инструмента описано в
[документации cargo tree](https://doc.rust-lang.org/cargo/commands/cargo-tree.html).
