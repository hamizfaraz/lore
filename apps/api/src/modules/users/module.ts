import { authHooks } from '../../lib/auth';
import { defineModule } from '../../lib/module';
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
    });
  },
});
