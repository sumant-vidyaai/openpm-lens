import { parse } from 'yaml';
import { validateCard, type MetricCard } from '../../registry/src/card';

// The cards are bundled into the app at build time, so nothing is fetched at runtime.
const files = import.meta.glob('../../registry/metrics/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const cards: MetricCard[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, text]) => {
    const card: unknown = parse(text);
    const errors = validateCard(card);
    if (errors.length > 0) throw new Error(`Invalid card ${path}: ${errors.join('; ')}`);
    return card as MetricCard;
  });
