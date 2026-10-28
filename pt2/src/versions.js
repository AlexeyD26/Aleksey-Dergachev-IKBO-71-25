import { maxSatisfying, valid, validRange } from 'semver';

export function cargoRange(requirement) {
  const parts = requirement.split(',').map((part) => part.trim());
  if (parts.some((part) => !part) || requirement.includes('||')) {
    throw new Error(`Некорректное ограничение версии: ${requirement}`);
  }
  const range = parts.map((part) => {
    if (/^\d/.test(part) && !part.includes('*')) return '^' + part;
    return part;
  }).join(' ');
  if (!validRange(range)) {
    throw new Error(`Некорректное ограничение версии: ${requirement}`);
  }
  return range;
}

export function selectVersion(entries, name, requirement, exact) {
  const versions = entries.filter((entry) =>
    typeof entry?.name === 'string'
    && entry.name.toLowerCase() === name.toLowerCase()
    && valid(entry.vers),
  );
  if (exact) {
    const entry = versions.find((item) => item.vers === requirement);
    if (entry) return entry;
    throw new Error(`Версия ${name}@${requirement} не найдена.`);
  }
  const available = versions.filter((entry) => !entry.yanked);
  const range = cargoRange(requirement);
  for (const candidates of [available, versions]) {
    const version = maxSatisfying(candidates.map((entry) => entry.vers), range);
    if (version) return candidates.find((entry) => entry.vers === version);
  }
  throw new Error(`Нет версии ${name} для ограничения ${requirement}.`);
}
