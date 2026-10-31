import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';
import { stringify } from 'yaml';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../src/index.js', import.meta.url));
const folder = mkdtempSync(join(tmpdir(), 'cargo-deps-cli-'));
const configPath = join(folder, 'config.yaml');
let repository;
let responseStatus = 200;
let requests = [];
let body = '';
const bodies = {};
const server = createServer((request, response) => {
  requests.push(request.url);
  response.writeHead(responseStatus);
  response.end(bodies[request.url] ?? body);
});

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  repository = `http://127.0.0.1:${server.address().port}/index`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(folder, { recursive: true, force: true });
});

function runCli(version = '2.0.0', extraArgs = []) {
  writeFileSync(configPath, stringify({
    package: 'demo', repository, test_mode: false,
    version, output: 'graph.png', filter: 'alpha',
  }));
  requests = [];
  return exec(process.execPath, [cli, configPath, ...extraArgs], {
    cwd: folder,
  });
}

test('CLI получает граф по HTTP, применяет фильтр и обходит в глубину',
  async () => {
  body = JSON.stringify({
    name: 'demo', vers: '2.0.0', deps: [
      { name: 'alpha', req: '^1', kind: null },
      { name: 'test', req: '^2', kind: 'dev' },
      { name: 'cc', req: '^1', kind: 'build' },
      { name: 'alias', package: 'real', req: '=3.0.0', optional: true,
        target: 'cfg(windows)' },
    ],
  });
  for (const [path, name, vers, deps] of [
    ['/index/te/st/test', 'test', '2.1.0', [{ name: 'child', req: '^1' }]],
    ['/index/ch/il/child', 'child', '1.0.0', []],
    ['/index/2/cc', 'cc', '1.0.0', []],
    ['/index/re/al/real', 'real', '3.0.0', []],
  ]) {
    bodies[path] = JSON.stringify({ name, vers, deps });
  }
  const result = await runCli();
  assert.equal(result.stdout, [
    'Граф зависимостей demo@2.0.0:',
    'demo@2.0.0 -> test@2.1.0, cc@1.0.0, real@3.0.0',
    'test@2.1.0 -> child@1.0.0',
    'child@1.0.0 -> (нет зависимостей)',
    'cc@1.0.0 -> (нет зависимостей)',
    'real@3.0.0 -> (нет зависимостей)',
    '',
  ].join('\n'));
  assert.equal(result.stderr, '');
  assert.deepEqual(requests, [
    '/index/de/mo/demo', '/index/te/st/test', '/index/ch/il/child',
    '/index/2/cc', '/index/re/al/real',
  ]);
});

test('CLI ищет обратные зависимости пакета с версией из HTTP-индекса',
  async () => {
    body = JSON.stringify({
      name: 'demo', vers: '2.0.0', deps: [{ name: 'child', req: '^1' }],
    });
    bodies['/index/ch/il/child'] = JSON.stringify({
      name: 'child', vers: '1.0.0', deps: [],
    });
    const result = await runCli('2.0.0', ['--reverse', 'child@1.0.0']);
    assert.equal(result.stdout,
      'Обратные зависимости child@1.0.0:\n- demo@2.0.0\n');
    assert.equal(result.stderr, '');
    assert.deepEqual(requests, ['/index/de/mo/demo', '/index/ch/il/child']);
  });

test('CLI явно сообщает об отсутствии зависимостей', async () => {
  body = JSON.stringify({ name: 'demo', vers: '2.0.0', deps: [] });
  const result = await runCli();
  assert.match(result.stdout, /demo@2.0.0 -> \(нет зависимостей\)/);
});

test('CLI сообщает об отсутствующей версии с кодом 1', async () => {
  await assert.rejects(runCli('9.0.0'), (error) => {
    assert.equal(error.code, 1);
    assert.equal(error.stdout, '');
    assert.match(error.stderr, /^Ошибка: Версия demo@9.0.0 не найдена/);
    return true;
  });
});

test('CLI сообщает об ошибке сервера с кодом 1', async () => {
  responseStatus = 500;
  await assert.rejects(runCli(), (error) => {
    assert.equal(error.code, 1);
    assert.equal(error.stdout, '');
    assert.match(error.stderr, /^Ошибка: Репозиторий вернул HTTP 500/);
    return true;
  });
});
