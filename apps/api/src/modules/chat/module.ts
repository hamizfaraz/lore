import { defineModule } from '../../lib/module';
import { jobs } from './jobs';
import routes from './routes';

export default defineModule({ name: 'chat', owner: 'C1', routes, jobs });
