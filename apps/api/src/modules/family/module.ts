import { defineModule } from '../../lib/module';
import { jobs } from './jobs';
import routes from './routes';

export default defineModule({ name: 'family', owner: 'C2', routes, jobs });
