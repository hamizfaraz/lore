export type SeedTarget = { url: string; label: string; production: boolean };

function option(name: string, args: string[]): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function privateHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/** Resolve an explicitly selected target without ever returning credentials in its printable label. */
export function seedTarget(
  args = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): SeedTarget {
  const raw = option('database', args) ?? environment.LORE_SEED_DATABASE_URL;
  if (!raw) {
    throw new Error(
      'Select a database with --database=postgres://…/lore or LORE_SEED_DATABASE_URL. DATABASE_URL is intentionally ignored.',
    );
  }
  if (option('confirm', args) !== 'lore-demo') {
    throw new Error('Refusing to seed without --confirm=lore-demo');
  }
  const parsed = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
    throw new Error('The seed target must be PostgreSQL');
  const database = parsed.pathname.replace(/^\//, '');
  if (!database || ['postgres', 'template0', 'template1'].includes(database)) {
    throw new Error('Choose a dedicated, named LORE database—not a default PostgreSQL database');
  }
  const production = !privateHost(parsed.hostname);
  if (production) {
    const allowed = args.includes('--allow-production');
    const ack = environment.LORE_PRODUCTION_SEED_ACK;
    if (!allowed || ack !== `${parsed.hostname}/${database}`) {
      throw new Error(
        `Remote target ${parsed.hostname}/${database} requires --allow-production and LORE_PRODUCTION_SEED_ACK=${parsed.hostname}/${database}`,
      );
    }
  }
  return { url: parsed.toString(), label: `${parsed.hostname}/${database}`, production };
}
