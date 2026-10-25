import { defineModule } from '../../lib/module';
import { jobs } from './jobs';
import routes from './routes';

export default defineModule({
  name: 'persona',
  owner: 'C2',
  routes,
  jobs,
  repeatables: [{ name: 'persona.tick', everyMs: 120_000 }],
});
