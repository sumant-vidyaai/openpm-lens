import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { type MetricCard, validateCard } from './card';

/**
 * Loads every YAML card under a folder (recursively). Node only: used by tests and tooling.
 * The browser app will receive the cards through a build step, not by reading the disk.
 */
export function loadCards(directory: string): { file: string; card: MetricCard }[] {
  const results: { file: string; card: MetricCard }[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.ya?ml$/i.test(entry)) {
        const parsed: unknown = parse(readFileSync(full, 'utf8'));
        const errors = validateCard(parsed);
        if (errors.length > 0) {
          throw new Error(`Invalid metric card ${full}:\n - ${errors.join('\n - ')}`);
        }
        results.push({ file: full, card: parsed as MetricCard });
      }
    }
  };

  walk(directory);
  return results;
}
