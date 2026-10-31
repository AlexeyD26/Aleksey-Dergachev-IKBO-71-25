import { execFileSync } from 'node:child_process';
import { isUtf8 } from 'node:buffer';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MAX_FILE_LINES = 1000;
const MAX_SHELL_WIDTH = 120;
const FORBIDDEN_FOLDERS = new Set([
  'node_modules', 'coverage', 'dist', 'build', '.idea', '.vscode',
  '__pycache__',
]);
const FORBIDDEN_EXTENSIONS = new Set([
  '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar', '.png', '.jpg', '.jpeg',
  '.gif', '.webp', '.pdf', '.exe', '.dmg', '.so', '.dylib', '.dll',
  '.pyc', '.pyo', '.o', '.a', '.class', '.wasm', '.woff', '.woff2',
]);
const COMMIT_PATTERN = /^[a-z][a-z0-9-]*(\([^)]+\))?!?: \S/;

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function checkStructure() {
  for (const name of ['README.md', '.gitignore']) {
    const path = join(ROOT, name);
    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`Отсутствует файл ${name}`);
    }
  }
  for (const name of ['src', 'tests']) {
    const path = join(ROOT, name);
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      throw new Error(`Отсутствует папка ${name}`);
    }
  }
  const launcher = ['run.sh', 'run.bat', 'Makefile'].some((name) =>
    existsSync(join(ROOT, name)) && statSync(join(ROOT, name)).isFile(),
  );
  if (!launcher) throw new Error('Отсутствует скрипт запуска.');
}

function checkFile(name) {
  if (name.split('/').some((part) => FORBIDDEN_FOLDERS.has(part))
    || FORBIDDEN_EXTENSIONS.has(extname(name).toLowerCase())
    || basename(name) === '.DS_Store') {
    throw new Error(`Недопустимый файл в Git: ${name}`);
  }
  const data = readFileSync(join(ROOT, name));
  if (data.includes(0) || !isUtf8(data)) {
    throw new Error(`Бинарный файл в Git: ${name}`);
  }
  const lines = data.toString('utf8').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (lines.length > MAX_FILE_LINES) {
    throw new Error(`Файл ${name} длиннее ${MAX_FILE_LINES} строк.`);
  }
  if (extname(name) === '.sh'
    && lines.some((line) => line.length > MAX_SHELL_WIDTH)) {
    throw new Error(`Строка shell-скрипта ${name} слишком длинная.`);
  }
}

function checkCommits() {
  const subjects = git(['log', '--format=%s', '--', '.']).trim().split('\n');
  for (const subject of subjects) {
    if (!COMMIT_PATTERN.test(subject)) {
      throw new Error(`Неверный формат коммита: ${subject}`);
    }
  }
}

try {
  checkStructure();
  const files = git(['ls-files', '--cached', '--others', '--exclude-standard',
    '-z', '--', '.']).split('\0').filter(Boolean);
  for (const name of files) checkFile(name);
  checkCommits();
  console.log('Структура, файлы и сообщения коммитов: проверка пройдена.');
} catch (error) {
  console.error(`Ошибка проверки: ${error.message}`);
  process.exitCode = 1;
}
