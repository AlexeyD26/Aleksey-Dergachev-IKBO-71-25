import { loadConfig } from './config.js';

function main() {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === '--help') {
    console.log('Запуск: node src/index.js [путь к config.yaml]');
    return;
  }

  if (args.length > 1) {
    throw new Error('Нужно указать только один путь к YAML-файлу.');
  }

  const config = loadConfig(args[0] ?? 'config.yaml');
  for (const [key, value] of Object.entries(config)) {
    console.log(`${key}: ${JSON.stringify(value)}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Ошибка: ${error.message}`);
  process.exitCode = 1;
}
