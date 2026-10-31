import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findReverseDependencies } from '../src/reverse.js';

test('Находятся прямые и транзитивные обратные зависимости в порядке DFS',
  () => {
    const graph = new Map([
      ['A', ['B', 'C']], ['B', ['D']], ['D', []], ['C', ['D']],
    ]);
    assert.deepEqual(findReverseDependencies(graph, 'D'), {
      target: 'D', packages: ['B', 'A', 'C'],
    });
  });

test('Пакет без входящих связей даёт пустой список', () => {
  const graph = new Map([['A', ['B']], ['B', []]]);
  assert.deepEqual(findReverseDependencies(graph, 'A').packages, []);
});

test('Цикл не зацикливает поиск, сам выбранный пакет не выводится', () => {
  const graph = new Map([['A', ['B']], ['B', ['C']], ['C', ['A']]]);
  assert.deepEqual(findReverseDependencies(graph, 'A').packages, ['C', 'B']);
});

test('Петля на выбранном пакете не добавляет его самого', () => {
  const graph = new Map([['A', ['A']]]);
  assert.deepEqual(findReverseDependencies(graph, 'A').packages, []);
});

test('Несколько путей и повторные рёбра не дублируют результат', () => {
  const graph = new Map([
    ['A', ['B', 'C']], ['B', ['D', 'D']], ['C', ['D']], ['D', []],
  ]);
  const packages = findReverseDependencies(graph, 'D').packages;
  assert.equal(packages.length, 3);
  assert.deepEqual(new Set(packages), new Set(['A', 'B', 'C']));
});

test('Обычные зависимости выбранного пакета не попадают в ответ', () => {
  const graph = new Map([['A', ['B']], ['B', ['C']], ['C', []], ['D', []]]);
  assert.deepEqual(findReverseDependencies(graph, 'B').packages, ['A']);
});

test('Исходный граф не меняется после поиска', () => {
  const graph = new Map([['A', ['B']], ['B', []]]);
  const before = JSON.stringify([...graph]);
  findReverseDependencies(graph, 'B');
  assert.equal(JSON.stringify([...graph]), before);
});

test('Несуществующий пакет и пустой граф вызывают понятную ошибку', () => {
  for (const graph of [new Map(), new Map([['A', []]])]) {
    assert.throws(() => findReverseDependencies(graph, 'D'),
      /Пакет D не найден в построенном графе/);
  }
});

test('Для единственной версии достаточно имени пакета', () => {
  const graph = new Map([['app@1.0.0', ['lib@2.0.0']], ['lib@2.0.0', []]]);
  assert.deepEqual(findReverseDependencies(graph, 'lib'), {
    target: 'lib@2.0.0', packages: ['app@1.0.0'],
  });
});

test('Разные версии имеют разные обратные зависимости', () => {
  const graph = new Map([
    ['app@1.0.0', ['lib@1.0.0']], ['other@1.0.0', ['lib@2.0.0']],
    ['lib@1.0.0', []], ['lib@2.0.0', []],
  ]);
  assert.deepEqual(findReverseDependencies(graph, 'lib@1.0.0').packages,
    ['app@1.0.0']);
  assert.throws(() => findReverseDependencies(graph, 'lib'),
    /Укажите версию пакета: lib@1.0.0, lib@2.0.0/);
});

test('Отозванную версию можно найти без ручного ввода пометки yanked', () => {
  const graph = new Map([
    ['app@1.0.0', ['lib@1.0.0 [yanked]']], ['lib@1.0.0 [yanked]', []],
  ]);
  assert.deepEqual(findReverseDependencies(graph, 'lib@1.0.0'), {
    target: 'lib@1.0.0 [yanked]', packages: ['app@1.0.0'],
  });
});
