import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createMermaid, saveVisualization } from '../src/visualization.js';

const folder = mkdtempSync(join(tmpdir(), 'cargo-deps-images-'));
after(() => rmSync(folder, { recursive: true, force: true }));

test('Mermaid сохраняет цикл и отдельную вершину', () => {
  const graph = new Map([['A', ['B']], ['B', ['A']], ['C', []]]);
  const text = createMermaid(graph);
  assert.match(text, /^flowchart TD\n/);
  assert.match(text, /n0\["A"\]/);
  assert.match(text, /n2\["C"\]/);
  assert.match(text, /n0 --> n1/);
  assert.match(text, /n1 --> n0/);
});

test('Версии и yanked находятся в подписях, идентификаторы безопасны', () => {
  const text = createMermaid(new Map([['pkg-name@1.0.0 [yanked]', []]]));
  assert.match(text, /n0\["pkg-name@1\.0\.0 \[yanked\]"\]/);
});

test('Кавычки и HTML-символы в подписях экранируются', () => {
  const text = createMermaid(new Map([['A"<>&#', []]]));
  assert.match(text, /A#quot;#60;#62;#38;#35;/);
});

test('Пустой граф получает явную подпись', () => {
  assert.match(createMermaid(new Map()), /Пакет исключён фильтром/);
});

test('PNG и Mermaid создаются относительно файла настроек', async () => {
  const graph = new Map([['A" [yanked]', ['Б']], ['Б', ['A" [yanked]']]]);
  const files = await saveVisualization(graph, {
    output: 'result.png', test_mode: false,
  }, join(folder, 'settings.yaml'));
  assert.equal(files.pngPath, join(folder, 'result.png'));
  assert.equal(files.mermaidPath, join(folder, 'result.mmd'));
  assert.equal(readFileSync(files.mermaidPath, 'utf8'), createMermaid(graph));
  const png = readFileSync(files.pngPath);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.readUInt32BE(16));
  assert.ok(png.readUInt32BE(20));
});

test('Генерация не перезаписывает файл настроек', async () => {
  const configPath = join(folder, 'settings.mmd');
  writeFileSync(configPath, 'original');
  await assert.rejects(saveVisualization(new Map(), {
    output: 'settings.png', test_mode: false,
  }, configPath), /не должны совпадать/);
  assert.equal(readFileSync(configPath, 'utf8'), 'original');
});

test('Генерация не перезаписывает тестовый репозиторий', async () => {
  const repositoryPath = join(folder, 'repository.mmd');
  writeFileSync(repositoryPath, '{"A": []}');
  await assert.rejects(saveVisualization(new Map(), {
    output: 'repository.png', test_mode: true, repository: 'repository.mmd',
  }, join(folder, 'settings.yaml')), /не должны совпадать/);
  assert.equal(readFileSync(repositoryPath, 'utf8'), '{"A": []}');
});
