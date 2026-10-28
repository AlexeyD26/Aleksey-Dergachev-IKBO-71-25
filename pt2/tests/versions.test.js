import assert from 'node:assert/strict';
import { test } from 'node:test';
import { satisfies } from 'semver';
import { cargoRange, selectVersion } from '../src/versions.js';

for (const [requirement, version, expected] of [
  ['1.2.3', '1.9.0', true],
  ['1.2.3', '2.0.0', false],
  ['1.2', '1.9.0', true],
  ['1', '2.0.0', false],
  ['0.2.3', '0.2.9', true],
  ['0.2.3', '0.3.0', false],
  ['0.2', '0.2.9', true],
  ['0.0.3', '0.0.4', false],
  ['0.0', '0.0.9', true],
  ['0.0', '0.1.0', false],
  ['0', '0.9.0', true],
  ['^1.2.3', '1.9.0', true],
  ['~1.2.3', '1.3.0', false],
  ['~1.2', '1.2.9', true],
  ['~1', '1.9.0', true],
  ['*', '7.0.0', true],
  ['1.*', '1.9.0', true],
  ['1.2.*', '1.3.0', false],
  ['>= 1.2, < 1.5', '1.4.9', true],
  ['>= 1.2, < 1.5', '1.5.0', false],
  ['> 1', '1.9.0', false],
  ['> 1', '2.0.0', true],
  ['<= 1.2', '1.2.9', true],
  ['= 1.2.3', '1.2.4', false],
  ['=1.2', '1.2.9', true],
  ['^1', '1.9.0-beta.1', false],
  ['1.0.0-alpha', '1.0.0-beta', true],
  ['1.0.0-alpha', '1.0.1-beta', false],
  ['1.0.0-alpha', '1.2.0', true],
  ['=1.2.3', '1.2.3+build.1', true],
]) {
  test(`${requirement}: ${version} -> ${expected}`, () => {
    assert.equal(satisfies(version, cargoRange(requirement)), expected);
  });
}

const entries = [
  { name: 'demo', vers: '1.0.0' },
  { name: 'demo', vers: '1.2.0' },
  { name: 'demo', vers: '1.3.0', yanked: true },
  { name: 'demo', vers: '1.4.0-beta' },
  { name: 'demo', vers: '2.0.0' },
];

test('Выбирается максимальная подходящая версия без yanked', () => {
  assert.equal(selectVersion(entries, 'demo', '^1', false).vers, '1.2.0');
});

test('Корневая версия фиксирована, а не выбирается по диапазону', () => {
  assert.equal(selectVersion(entries, 'demo', '1.0.0', true).vers, '1.0.0');
});

test('Явно указанную отозванную версию можно проанализировать', () => {
  assert.equal(selectVersion(entries, 'demo', '1.3.0', true).vers, '1.3.0');
});

test('Если все подходящие версии отозваны, данные остаются доступны', () => {
  const entry = selectVersion(entries, 'demo', '=1.3.0', false);
  assert.equal(entry.vers, '1.3.0');
  assert.equal(entry.yanked, true);
});

test('Пустой результат выбора вызывает ошибку', () => {
  assert.throws(() => selectVersion(entries, 'demo', '^3', false),
    /Нет версии demo/);
});

for (const requirement of ['', 'hello', '1 || 2', '>=1,']) {
  test(`Ошибочное ограничение ${JSON.stringify(requirement)}`, () => {
    assert.throws(() => cargoRange(requirement), /Некорректное ограничение/);
  });
}
