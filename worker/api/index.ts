import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from '../types';

import articles from './routes/articles';
import digest   from './routes/digest';
import sources  from './routes/sources';
import scraper  from './routes/scraper';

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors());

app.route('/api/articles', articles);
app.route('/api/digest',   digest);
app.route('/api/sources',  sources);
app.route('/api',          scraper); // scraper routes keep their full paths (/api/scraper-configs, /api/scraper-profile/test)

export default app;
