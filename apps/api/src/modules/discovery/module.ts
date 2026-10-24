import { defineModule } from '../../lib/module';
import { jobs } from './jobs';
import routes from './routes';

export default defineModule({ name: 'discovery', owner: 'C2', routes, jobs });
