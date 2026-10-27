import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  getDependencies, getIndexPath, parseDependencies,
} from '../src/dependencies.js';

const config = {
  package: 'demo',
  version: '2.0.0',
  repository: 'https://example.com/index',
  test_mode: false,
};
const dependencies = [
  { name: 'alpha', req: '^1.0', kind: 'normal' },
  { name: 'check', req: '~2.0', kind: 'dev' },
  { name: 'compile', req: '>=1, <3', kind: 'build' },
  {
    name: 'alias',
    package: 'original',
    req: '=3.0.0',
    kind: 'normal',
    optional: true,
    target: 'cfg(windows)',
  },
];
const index = [
  { name: 'demo', vers: '1.0.0', deps: [] },
  { name: 'demo', vers: '2.0.0', deps: dependencies },
].map((entry) => JSON.stringify(entry)).join('\n') + '\n';

const folder = mkdtempSync(join(tmpdir(), 'cargo-deps-data-'));
const configPath = join(folder, 'settings.yaml');
const repositoryPath = join(folder, 'repository.json');
after(() => rmSync(folder, { recursive: true, force: true }));

for (const [name, path] of [
  ['a', '1/a'],
  ['ab', '2/ab'],
  ['AbC', '3/a/abc'],
  ['Demo', 'de/mo/demo'],
  ['serde_derive', 'se/rd/serde_derive'],
]) {
  test(`Путь в индексе для ${name}: ${path}`, () => {
    assert.equal(getIndexPath(name), path);
  });
}

test('Выбирается указанная версия, сохраняются все виды зависимостей', () => {
  assert.deepEqual(parseDependencies(index, 'demo', '2.0.0'), dependencies);
  assert.deepEqual(parseDependencies(index, 'demo', '1.0.0'), []);
});

test('Поддерживаются CRLF и имя пакета в другом регистре', () => {
  const result = parseDependencies(index.replaceAll('\n', '\r\n'),
    'Demo', '2.0.0');
  assert.deepEqual(result, dependencies);
});

test('Неизвестная версия или имя не заменяются другой версией', () => {
  assert.throws(() => parseDependencies(index, 'demo', '3.0.0'),
    /Версия demo@3.0.0 не найдена/);
  assert.throws(() => parseDependencies(index, 'other', '2.0.0'),
    /Версия other@2.0.0 не найдена/);
});

test('Повреждённый JSON обнаруживается', () => {
  assert.throws(() => parseDependencies('{bad', 'demo', '2.0.0'),
    /некорректный JSON/);
});

for (const deps of [null, {}, [null], [{ name: 'alpha' }]]) {
  test(`Некорректный список deps: ${JSON.stringify(deps)}`, () => {
    const text = JSON.stringify({ name: 'demo', vers: '2.0.0', deps });
    assert.throws(() => parseDependencies(text, 'demo', '2.0.0'),
      /Некорректный список зависимостей/);
  });
}

test('Запрос использует URL из настроек и не загружает зависимости',
  async (t) => {
    const request = t.mock.method(globalThis, 'fetch', async (url) => {
      assert.equal(url.href, 'https://example.com/index/de/mo/demo');
      return new Response(index);
    });
    assert.deepEqual(await getDependencies(config), dependencies);
    assert.equal(request.mock.callCount(), 1);
  });

test('Завершающий слеш в URL не меняет адрес запроса', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.href, 'https://example.com/index/de/mo/demo');
    return new Response(index);
  });
  await getDependencies({ ...config, repository: config.repository + '/' });
});

for (const status of [404, 403, 500]) {
  test(`Ошибка HTTP ${status} передаётся пользователю`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
      new Response('Error', { status }));
    await assert.rejects(getDependencies(config),
      new RegExp(`HTTP ${status}`));
  });
}

test('Сетевая ошибка обрабатывается понятно', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  await assert.rejects(getDependencies(config), /Не удалось получить данные/);
});

test('Превышение времени ожидания обрабатывается понятно', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    throw new DOMException('timeout', 'TimeoutError');
  });
  await assert.rejects(getDependencies(config), /не ответил за 10 секунд/);
});

test('Тестовый файл читается без сети, извлекается только первый уровень',
  async (t) => {
    t.mock.method(globalThis, 'fetch', () => {
      throw new Error('Сеть не должна использоваться');
    });
    writeFileSync(repositoryPath,
      JSON.stringify({ A: ['B', 'C'], B: ['D'], C: [], D: [] }));
    const result = await getDependencies({
      ...config, package: 'A', repository: 'repository.json', test_mode: true,
    }, configPath);
    assert.deepEqual(result.map((dep) => dep.name), ['B', 'C']);
  });

for (const data of ['{bad', '{}', '{"A": null}', '{"A": [["B"]]}']) {
  test(`Некорректный тестовый репозиторий: ${data}`, async () => {
    writeFileSync(repositoryPath, data);
    await assert.rejects(getDependencies({
      ...config, package: 'A', repository: 'repository.json', test_mode: true,
    }, configPath));
  });
}
