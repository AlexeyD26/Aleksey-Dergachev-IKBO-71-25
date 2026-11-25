import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parse } from './parser.generated.js';
import { toToml } from './toml.js';

try {
  const { values } = parseArgs({ options: { input: { type: 'string' } } });
  if (!values.input) {
    throw new Error('Укажи путь к файлу через --input.');
  }

  const source = readFileSync(values.input, 'utf8');
  process.stdout.write(toToml(parse(source)));
} catch (error) {
  const location = error.location?.start;
  if (location) {
    console.error(`Строка ${location.line}, столбец ${location.column}.`);
  }
  console.error(error.message);
  process.exitCode = 1;
}
