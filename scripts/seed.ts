import { createDb } from '../packages/db/src/index';
import { seedDemo } from './demo-seed';
import { seedTarget } from './seed-safety';

const started = Date.now();
const target = seedTarget();
const connection = createDb(target.url, { max: 1 });
try {
  const summary = await seedDemo(connection.db);
  console.log(
    JSON.stringify({ ok: true, target: target.label, elapsedMs: Date.now() - started, ...summary }, null, 2),
  );
} finally {
  await connection.sql.end({ timeout: 5 });
}
