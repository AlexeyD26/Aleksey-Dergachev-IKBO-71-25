import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { buildGraph } from '../src/graph.js';

const folder = mkdtempSync(join(tmpdir(), 'cargo-deps-graph-'));
const configPath = join(folder, 'settings.yaml');
const config = {
  package: 'A', version: '1.0.0', test_mode: true,
  repository: 'repository.json', filter: '',
};
after(() => rmSync(folder, { recursive: true, force: true }));

async function testGraph(repository, options = {}) {
  writeFileSync(join(folder, config.repository), JSON.stringify(repository));
  return buildGraph({ ...config, ...options }, configPath);
}

test('DFS идёт в глубину; общая зависимость сохраняет оба входящих ребра',
  async () => {
    const graph = await testGraph({ A: ['B', 'C'], B: ['D'], C: ['D'], D: [] });
    assert.deepEqual([...graph], [
      ['A', ['B', 'C']], ['B', ['D']], ['D', []], ['C', ['D']],
    ]);
  });

test('Цикл не зацикливает обход, замыкающее ребро сохраняется', async () => {
  const graph = await testGraph({ A: ['B'], B: ['C'], C: ['A'] });
  assert.deepEqual([...graph], [['A', ['B']], ['B', ['C']], ['C', ['A']]]);
});

test('Петля на самом пакете обрабатывается', async () => {
  assert.deepEqual([...await testGraph({ A: ['A'] })], [['A', ['A']]]);
});

test('Повторяющиеся рёбра не дублируются', async () => {
  const graph = await testGraph({ A: ['B', 'B'], B: [] });
  assert.deepEqual([...graph], [['A', ['B']], ['B', []]]);
});

test('Недостижимые пакеты не попадают в граф', async () => {
  assert.deepEqual([...await testGraph({ A: [], B: ['C'], C: [] })],
    [['A', []]]);
});

test('Фильтр исключает вершину и обход через неё', async () => {
  const graph = await testGraph({ A: ['B', 'C'], B: ['D'], C: [], D: [] },
    { filter: 'B' });
  assert.deepEqual([...graph], [['A', ['C']], ['C', []]]);
});

test('Общая зависимость доступна через оставшуюся ветвь', async () => {
  const graph = await testGraph({ A: ['B', 'C'], B: ['D'], C: ['D'], D: [] },
    { filter: 'B' });
  assert.deepEqual([...graph], [['A', ['C']], ['C', ['D']], ['D', []]]);
});

test('Фильтр может исключить корень', async () => {
  assert.equal((await testGraph({ A: ['B'], B: [] }, { filter: 'A' })).size,
    0);
});

test('Отсутствующая вершина вызывает понятную ошибку', async () => {
  await assert.rejects(testGraph({ A: ['B'] }), /Пакет B не найден/);
});

function indexEntry(name, vers, deps = []) {
  return { name, vers, deps };
}

function mockIndex(t, packages) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const name = url.pathname.split('/').at(-1);
    requests.push(name);
    assert.ok(packages[name], `Неожиданный запрос ${name}`);
    const text = packages[name].map((entry) => JSON.stringify(entry));
    return new Response(text.join('\n'));
  });
  return requests;
}

const realConfig = {
  ...config, package: 'demo', version: '2.0.0', test_mode: false,
  repository: 'https://example.com/index',
};

test('Разные версии одного пакета различаются; индекс скачивается раз',
  async (t) => {
    const requests = mockIndex(t, {
      demo: [indexEntry('demo', '2.0.0', [
        { name: 'alpha', req: '^1' }, { name: 'alias', package: 'beta',
          req: '^1', optional: true, kind: 'build', target: 'cfg(windows)' },
      ])],
      alpha: [indexEntry('alpha', '1.0.0', [{ name: 'shared', req: '^1' }])],
      beta: [indexEntry('beta', '1.0.0', [{ name: 'shared', req: '^2' }])],
      shared: [indexEntry('shared', '1.5.0'), indexEntry('shared', '2.1.0')],
    });
    const graph = await buildGraph(realConfig);
    assert.deepEqual([...graph], [
      ['demo@2.0.0', ['alpha@1.0.0', 'beta@1.0.0']],
      ['alpha@1.0.0', ['shared@1.5.0']], ['shared@1.5.0', []],
      ['beta@1.0.0', ['shared@2.1.0']], ['shared@2.1.0', []],
    ]);
    assert.deepEqual(requests, ['demo', 'alpha', 'shared', 'beta']);
  });

test('Исключённый пакет не скачивается, проверяется подстрока имени',
  async (t) => {
    const requests = mockIndex(t, {
      demo: [indexEntry('demo', '2.0.0', [
        { name: 'skip-library', req: '^1' },
      ])],
    });
    const graph = await buildGraph({ ...realConfig, filter: 'skip' });
    assert.deepEqual([...graph], [['demo@2.0.0', []]]);
    assert.deepEqual(requests, ['demo']);
  });

test('Циклические данные индекса завершаются без повторных запросов',
  async (t) => {
    const requests = mockIndex(t, {
      demo: [indexEntry('demo', '2.0.0', [{ name: 'child', req: '^1' }])],
      child: [indexEntry('child', '1.0.0', [{ name: 'demo', req: '=2.0.0' }])],
    });
    const graph = await buildGraph(realConfig);
    assert.deepEqual(graph.get('child@1.0.0'), ['demo@2.0.0']);
    assert.equal(graph.size, 2);
    assert.deepEqual(requests, ['demo', 'child']);
  });

test('Отозванная версия явно помечается в графе', async (t) => {
  mockIndex(t, {
    demo: [indexEntry('demo', '2.0.0', [{ name: 'child', req: '^1' }])],
    child: [{ ...indexEntry('child', '1.0.0'), yanked: true }],
  });
  const graph = await buildGraph(realConfig);
  assert.deepEqual([...graph], [
    ['demo@2.0.0', ['child@1.0.0 [yanked]']],
    ['child@1.0.0 [yanked]', []],
  ]);
});

test('Другой реестр не подменяется текущим незаметно', async (t) => {
  const requests = mockIndex(t, {
    demo: [indexEntry('demo', '2.0.0', [{
      name: 'child', req: '^1', registry: 'https://other.example/index',
    }])],
  });
  await assert.rejects(buildGraph(realConfig), /Другой реестр/);
  assert.deepEqual(requests, ['demo']);
});
