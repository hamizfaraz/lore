import { authHooks } from '../../lib/auth';
import { logger } from '../../lib/logger';
import { defineModule } from '../../lib/module';
import { ensureWallet } from '../keepsakes/service';
import { jobs } from './jobs';
import routes from './routes';
import { ensurePersonalAccount } from './service';

export default defineModule({
  name: 'users',
  owner: 'C1',
  routes,
  jobs,
  setup: () => {
    authHooks.onUserCreated.push(async (u) => {
      await ensurePersonalAccount(u);
      await ensureWallet(u.id).catch((err) => logger.warn({ err }, 'keepsake wallet'));
    });
  },
});
