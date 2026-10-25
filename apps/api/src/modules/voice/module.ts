import { defineModule } from '../../lib/module';
import { jobs } from './jobs';
import { attachVoiceLiveProxy } from './live';
import routes from './routes';

export default defineModule({
  name: 'voice',
  owner: 'C2',
  routes,
  jobs,
  attach: ({ http }) => attachVoiceLiveProxy(http),
});
