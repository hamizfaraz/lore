import { defineModule } from '../../lib/module';
import { registerCardResolver } from '../chat/service';
import { jobs } from './jobs';
import routes from './routes';
import { resolveAiImageCard } from './service';

export default defineModule({
  name: 'persona',
  owner: 'C2',
  routes,
  jobs,
  repeatables: [{ name: 'persona.tick', everyMs: 120_000 }],
  setup: () => {
    registerCardResolver('ai_image', async (refId) => resolveAiImageCard(refId));
  },
});
