import { defineModule } from '../../lib/module';
import { jobs } from './jobs';
import routes from './routes';

export default defineModule({ name: 'media', owner: 'C1', routes, jobs });
