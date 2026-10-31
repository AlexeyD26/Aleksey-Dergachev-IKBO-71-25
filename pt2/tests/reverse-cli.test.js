import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { stringify } from 'yaml';

const project = fileURLToPath(new URL('../', import.meta.url));
const cli = join(project, 'src/index.js');
const folder = mkdtempSync(join(tmpdir(), 'cargo-deps-reverse-'));
after(() => rmSync(folder, { recursive: true, force: true }));

function runCli(args, cwd = project) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd, encoding: 'utf8',
  });
}

test('CLI выводит обратные зависимости тестового пакета', () => {
  const result = runCli(['examples/test-config.yaml', '--reverse', 'D']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'Обратные зависимости D:\n- B\n- A\n- C\n');
  assert.equal(result.stderr, '');
});

test('CLI корректно завершает поиск в циклическом репозитории', () => {
  const result = runCli(['examples/cycle-config.yaml', '--reverse', 'A']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'Обратные зависимости A:\n- C\n- B\n');
});

test('CLI учитывает фильтр перед поиском обратных зависимостей', () => {
  const result = runCli(['examples/filter-config.yaml', '--reverse', 'D']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'Обратные зависимости D:\n- C\n- A\n');
});

test('CLI сообщает, что обратных зависимостей нет', () => {
  const result = runCli(['examples/test-config.yaml', '--reverse', 'A']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Обратных зависимостей нет/);
});

test('CLI сообщает об отсутствующем или исключённом пакете', () => {
  for (const target of ['B', 'Z']) {
    const result = runCli(['examples/filter-config.yaml', '--reverse', target]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /не найден в построенном графе/);
  }
});

test('Режим обратных зависимостей работает с config.yaml по умолчанию', () => {
  writeFileSync(join(folder, 'repository.json'), '{"A": ["B"], "B": []}');
  writeFileSync(join(folder, 'config.yaml'), stringify({
    package: 'A', repository: 'repository.json', test_mode: true,
    version: '1.0.0', output: 'graph.png', filter: '',
  }));
  const result = runCli(['--reverse', 'B'], folder);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'Обратные зависимости B:\n- A\n');
});

for (const args of [
  ['--reverse'], ['--reverse', ''], ['--reverse', '--help'],
  ['--unknown'], ['one.yaml', 'two.yaml'],
  ['--reverse', 'A', '--reverse', 'B'],
]) {
  test(`CLI отклоняет неверные аргументы: ${JSON.stringify(args)}`, () => {
    const result = runCli(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Ошибка:/);
    assert.doesNotMatch(result.stderr, /Не удалось прочитать файл настроек/);
  });
}
