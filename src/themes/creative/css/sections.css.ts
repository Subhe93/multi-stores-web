// The builders' motion stylesheets as one string, in a fixed order. Owned by
// the integrator: builders edit only their own slot file.

import { CARDS_CSS } from './cards.css';
import { CHROME_CSS } from './chrome.css';
import { FLOW_CSS } from './flow.css';
import { HERO_CSS } from './hero.css';
import { MEDIA_CSS } from './media.css';
import { PAGE_CSS } from './page.css';
import { PRODUCT_CSS } from './product.css';
import { STORY_CSS } from './story.css';

export const SECTIONS_CSS: string = [
  HERO_CSS,
  CARDS_CSS,
  MEDIA_CSS,
  CHROME_CSS,
  PRODUCT_CSS,
  STORY_CSS,
  PAGE_CSS,
  FLOW_CSS,
].join('');
