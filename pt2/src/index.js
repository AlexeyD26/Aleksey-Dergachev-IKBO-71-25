import { loadConfig } from './config.js';
import { buildGraph } from './graph.js';
import { findReverseDependencies } from './reverse.js';
import { saveVisualization } from './visualization.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === '--help') {
    console.log('Запуск: node src/index.js [config.yaml] [--reverse пакет]');
    return;
  }

  const { configPath, reverseTarget } = readArgs(args);
  const config = loadConfig(configPath);
  const graph = await buildGraph(config, configPath);
  if (reverseTarget !== null) {
    printReverse(findReverseDependencies(graph, reverseTarget));
  } else {
    const files = await saveVisualization(graph, config, configPath);
    printGraph(config, graph);
    console.log(`Mermaid: ${files.mermaidPath}`);
    console.log(`PNG: ${files.pngPath}`);
  }
}

function readArgs(args) {
  const remaining = [...args];
  const position = remaining.indexOf('--reverse');
  let reverseTarget = null;
  if (position !== -1) {
    reverseTarget = remaining[position + 1];
    if (!reverseTarget?.trim() || reverseTarget.startsWith('--')) {
      throw new Error('После --reverse укажите пакет.');
    }
    remaining.splice(position, 2);
  }
  const unknown = remaining.find((arg) => arg.startsWith('--'));
  if (unknown) throw new Error(`Неизвестная опция: ${unknown}`);
  if (remaining.length > 1) {
    throw new Error('Нужно указать только один путь к YAML-файлу.');
  }
  return { configPath: remaining[0] ?? 'config.yaml', reverseTarget };
}

function printGraph(config, graph) {
  const name = config.test_mode
    ? config.package
    : `${config.package}@${config.version}`;
  console.log(`Граф зависимостей ${name}:`);
  if (graph.size === 0) {
    console.log('Пакет исключён фильтром.');
    return;
  }

  for (const [node, dependencies] of graph) {
    const targets = dependencies.length > 0
      ? dependencies.join(', ')
      : '(нет зависимостей)';
    console.log(`${node} -> ${targets}`);
  }
}

function printReverse(result) {
  console.log(`Обратные зависимости ${result.target}:`);
  if (result.packages.length === 0) {
    console.log('Обратных зависимостей нет.');
  }
  for (const name of result.packages) console.log(`- ${name}`);
}

try {
  await main();
} catch (error) {
  console.error(`Ошибка: ${error.message}`);
  process.exitCode = 1;
}
