import { loadConfig } from './config.js';
import { buildGraph } from './graph.js';
import { findReverseDependencies } from './reverse.js';
import { saveVisualization } from './visualization.js';

const HELP_ARGUMENT_COUNT = 1;
const MAX_CONFIG_PATHS = 1;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === HELP_ARGUMENT_COUNT && args[0] === '--help') {
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
  let reverseTarget = null;
  if (remaining.includes('--reverse')) {
    const position = remaining.indexOf('--reverse');
    reverseTarget = remaining[position + 1];
    if (!reverseTarget?.trim() || reverseTarget.startsWith('--')) {
      throw new Error('После --reverse укажите пакет.');
    }
    remaining.splice(position, 2);
  }
  const unknown = remaining.find((arg) => arg.startsWith('--'));
  if (unknown) throw new Error(`Неизвестная опция: ${unknown}`);
  if (remaining.length > MAX_CONFIG_PATHS) {
    throw new Error('Нужно указать только один путь к YAML-файлу.');
  }
  return { configPath: remaining[0] ?? 'config.yaml', reverseTarget };
}

function printGraph(config, graph) {
  const name = config.test_mode
    ? config.package
    : `${config.package}@${config.version}`;
  console.log(`Граф зависимостей ${name}:`);
  if (!graph.size) {
    console.log('Пакет исключён фильтром.');
    return;
  }

  for (const [node, dependencies] of graph) {
    const targets = dependencies.length
      ? dependencies.join(', ')
      : '(нет зависимостей)';
    console.log(`${node} -> ${targets}`);
  }
}

function printReverse(result) {
  console.log(`Обратные зависимости ${result.target}:`);
  if (!result.packages.length) {
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
