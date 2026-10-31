import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const PROJECT_DIR = fileURLToPath(new URL('..', import.meta.url));
const MMDC = join(PROJECT_DIR,
  'node_modules', '@mermaid-js', 'mermaid-cli', 'src', 'cli.js');

export function createMermaid(graph) {
  const ids = new Map();
  const lines = ['flowchart TD'];
  for (const node of graph.keys()) {
    const id = `n${ids.size}`;
    ids.set(node, id);
    lines.push(`  ${id}["${escapeLabel(node)}"]`);
  }
  if (graph.size === 0) lines.push('  empty["Пакет исключён фильтром"]');
  for (const [node, dependencies] of graph) {
    for (const dependency of dependencies) {
      lines.push(`  ${ids.get(node)} --> ${ids.get(dependency)}`);
    }
  }
  return lines.join('\n') + '\n';
}

function escapeLabel(label) {
  return label.replaceAll('#', '#35;').replaceAll('&', '#38;')
    .replaceAll('"', '#quot;').replaceAll('<', '#60;')
    .replaceAll('>', '#62;').replaceAll('\n', ' ');
}

export async function saveVisualization(graph, config, configPath) {
  const folder = dirname(resolve(configPath));
  const pngPath = resolve(folder, config.output);
  const mermaidPath = pngPath.replace(/\.png$/i, '.mmd');
  const inputs = [resolve(configPath)];
  if (config.test_mode) inputs.push(resolve(folder, config.repository));
  if (inputs.includes(pngPath) || inputs.includes(mermaidPath)) {
    throw new Error('Выходные файлы не должны совпадать с входными.');
  }
  writeFileSync(mermaidPath, createMermaid(graph));
  try {
    await execute(process.execPath, [MMDC,
      '-i', mermaidPath, '-o', pngPath, '-q', '-b', 'white', '-s', '2',
    ], { cwd: PROJECT_DIR, timeout: 60000 });
  } catch (error) {
    const message = error.stderr?.trim().split('\n')[0] || error.message;
    throw new Error(`Не удалось создать PNG: ${message}`);
  }
  return { mermaidPath, pngPath };
}
