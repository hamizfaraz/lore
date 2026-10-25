import { defineModule } from '../../lib/module';
import { registerCardResolver } from '../chat/service';
import { jobs } from './jobs';
import routes from './routes';
import { draftCardDTO } from './service';

export default defineModule({
  name: 'groups',
  owner: 'C1',
  routes,
  jobs,
  setup: () => {
    registerCardResolver('draft_card', (refId) => draftCardDTO(refId));
  },
});
