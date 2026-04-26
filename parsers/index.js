import { parseRss } from './rss.js';
import { parseReddit } from './reddit.js';
import { parseNypdHtml } from './nypd-html.js';
import { parseCitizen } from './citizen.js';

export async function runParser(source) {
  switch (source.type) {
    case 'rss':
    case 'scraper':
      return parseRss(source);
    case 'reddit':
      return parseReddit(source);
    case 'nypd_html':
      return parseNypdHtml(source);
    case 'citizen':
      return parseCitizen(source);
    case 'nitter':
      throw new Error('Nitter parser not implemented yet');
    default:
      throw new Error(`Unknown source type: ${source.type}`);
  }
}
