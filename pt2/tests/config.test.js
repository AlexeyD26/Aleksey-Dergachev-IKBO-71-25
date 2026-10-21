import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { stringify } from 'yaml';
import { loadConfig } from '../src/config.js';

const folder = mkdtempSync(join(tmpdir(), 'cargo-deps-test-'));
const configPath = join(folder, 'config.yaml');
const project = fileURLToPath(new URL('../', import.meta.url));
const cli = join(project, 'src/index.js');
const validConfig = {
  package: 'serde',
  repository: 'https://crates.io',
  test_mode: false,
  version: '1.0.228',
  output: 'graph.png',
  filter: '',
};

after(() => rmSync(folder, { recursive: true, force: true }));

function saveConfig(config) {
  writeFileSync(configPath, stringify(config));
  return configPath;
}

function runCli(args, cwd = project) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('Корректные настройки читаются без изменения значений', () => {
  assert.deepEqual(loadConfig(saveConfig(validConfig)), validConfig);
});

test('Каждый из шести параметров обязателен', () => {
  for (const key of Object.keys(validConfig)) {
    const config = { ...validConfig };
    delete config[key];
    assert.throws(() => loadConfig(saveConfig(config)), {
      message: `Отсутствует параметр: ${key}`,
    });
  }
});

const invalidValues = [
  ['package', '', 'не должен быть пустым'],
  ['package', 'bad name', 'Некорректное имя'],
  ['package', 123, 'должен быть строкой'],
  ['repository', '', 'не должен быть пустым'],
  ['repository', 'not-a-url', 'нужен HTTP'],
  ['repository', 'ftp://example.com', 'нужен HTTP'],
  ['repository', 123, 'должен быть строкой'],
  ['test_mode', 'false', 'должен быть true или false'],
  ['test_mode', 0, 'должен быть true или false'],
  ['version', '', 'не должен быть пустым'],
  ['version', 'latest', 'Некорректная version'],
  ['version', 1, 'должен быть строкой'],
  ['version', '01.0.0', 'Некорректная version'],
  ['version', '1.0.0-01', 'Некорректная version'],
  ['version', '1.0.0-alpha..1', 'Некорректная version'],
  ['output', '', 'не должен быть пустым'],
  ['output', 'graph.jpg', 'расширением .png'],
  ['output', 'missing/graph.png', 'недоступны'],
  ['output', false, 'должен быть строкой'],
  ['filter', null, 'должен быть строкой'],
  ['filter', 123, 'должен быть строкой'],
];

for (const [key, value, message] of invalidValues) {
  test(`Ошибка ${key} = ${JSON.stringify(value)}`, () => {
    const config = { ...validConfig, [key]: value };
    const result = runCli([saveConfig(config)]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes(message), result.stderr);
    assert.ok(!result.stderr.includes('at file:'));
  });
}

test('Номер версии может содержать prerelease и build', () => {
  const config = { ...validConfig, version: '1.2.3-beta.1+build.01' };
  assert.equal(loadConfig(saveConfig(config)).version, config.version);
});

test('Лишний параметр обнаруживается', () => {
  const config = { ...validConfig, typo: true };
  assert.throws(() => loadConfig(saveConfig(config)), /Неизвестный параметр/);
});

for (const text of ['', '- item', 'hello', 'package: [', 'a: 1\na: 2']) {
  test(`Неверная структура или синтаксис YAML: ${JSON.stringify(text)}`, () => {
    writeFileSync(configPath, text);
    assert.throws(() => loadConfig(configPath), /YAML/);
  });
}

test('Несуществующий файл настроек вызывает понятную ошибку', () => {
  const result = runCli([join(folder, 'missing.yaml')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Не удалось прочитать файл настроек/);
});

test('Тестовый файл ищется относительно YAML, а не текущей папки', () => {
  writeFileSync(join(folder, 'repository.json'), '{}');
  const config = {
    ...validConfig,
    package: 'A',
    repository: 'repository.json',
    test_mode: true,
  };
  const result = runCli([saveConfig(config)], tmpdir());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /test_mode: true/);
});

test('Отсутствующий тестовый файл или папка вместо файла отклоняются', () => {
  for (const repository of ['missing.json', '.']) {
    const config = {
      ...validConfig, package: 'A', test_mode: true, repository,
    };
    assert.throws(() => loadConfig(saveConfig(config)), /файл недоступен/);
  }
});

test('В тестовом режиме имя пакета должно быть большой буквой', () => {
  const config = { ...validConfig, test_mode: true };
  assert.throws(() => loadConfig(saveConfig(config)), /тестовом режиме/);
});

test('Папку нельзя использовать как выходной PNG-файл', () => {
  mkdirSync(join(folder, 'directory.png'));
  const config = { ...validConfig, output: 'directory.png' };
  assert.throws(() => loadConfig(saveConfig(config)), /недоступны/);
});

test('CLI выводит ровно шесть прочитанных значений', () => {
  const result = runCli([saveConfig(validConfig)]);
  const expected = Object.entries(validConfig)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n') + '\n';
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
  assert.equal(result.stderr, '');
});

test('Без аргументов используется config.yaml в текущей папке', () => {
  saveConfig(validConfig);
  assert.equal(runCli([], folder).status, 0);
});

test('Справка объясняет запуск, лишние аргументы отклоняются', () => {
  const help = runCli(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Запуск:/);
  assert.equal(runCli(['one.yaml', 'two.yaml']).status, 1);
});

test('Оба примера настроек из проекта проходят проверку', () => {
  for (const file of ['config.yaml', 'examples/test-config.yaml']) {
    assert.doesNotThrow(() => loadConfig(resolve(project, file)));
  }
});
