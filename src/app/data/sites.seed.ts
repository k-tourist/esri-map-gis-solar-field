import type { Site } from '../models/site.model';
import seedFile from './db.json';

export const INITIAL_SITES: Site[] = seedFile.sites as Site[];
