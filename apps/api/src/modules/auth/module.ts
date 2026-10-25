import { defineModule } from '../../lib/module';
import { jobs } from './jobs';
import rootRoutes from './routes';

export default defineModule({ name: 'auth', owner: 'C1', rootRoutes, jobs });
