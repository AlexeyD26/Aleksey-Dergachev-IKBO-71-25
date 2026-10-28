import {
  readIndex, readTestRepository, getTestDependencies, getPackageDependencies,
} from './dependencies.js';
import { selectVersion } from './versions.js';

export function createRepository(config, configPath) {
  const cache = new Map();
  const testRepository = config.test_mode
    ? readTestRepository(config, configPath)
    : null;

  return async function loadPackage(name, requirement, exact) {
    if (config.test_mode) {
      return {
        id: name,
        dependencies: getTestDependencies(testRepository, name),
      };
    }
    const key = name.toLowerCase();
    if (!cache.has(key)) {
      cache.set(key, await readIndex(config.repository, name));
    }
    const entry = selectVersion(cache.get(key), name, requirement, exact);
    return {
      id: `${entry.name}@${entry.vers}${entry.yanked ? ' [yanked]' : ''}`,
      dependencies: getPackageDependencies(entry),
    };
  };
}
