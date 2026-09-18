import { parseKey } from './dates';

export interface Quote {
  text: string;
  author: string;
}

// Real, sourced quotes on habits, patience and growing things. Popular lines with doubtful attributions
// (the "Aristotle" excellence quote, most "Confucius" and "Lao Tzu" memes) are left out or credited correctly.
export const QUOTES: Quote[] = [
  { text: 'Every action you take is a vote for the type of person you wish to become.', author: 'James Clear' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Habits are the compound interest of self-improvement.', author: 'James Clear' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { text: 'Drop by drop is the water pot filled.', author: 'The Dhammapada' },
  { text: 'Adopt the pace of nature: her secret is patience.', author: 'Ralph Waldo Emerson' },
  { text: 'He who plants a tree plants a hope.', author: 'Lucy Larcom' },
  { text: 'Mighty oaks from little acorns grow.', author: 'Proverb' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Proverb' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Tao Te Ching' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'What you do every day matters more than what you do once in a while.', author: 'Gretchen Rubin' },
  { text: 'Small deeds done are better than great deeds planned.', author: 'Peter Marshall' },
  { text: 'All things are difficult before they are easy.', author: 'Thomas Fuller' },
  { text: 'Habit is a second nature.', author: 'Cicero' },
  { text: 'Plant your garden and decorate your own soul, instead of waiting for someone to bring you flowers.', author: 'Veronica A. Shoffstall' },
  { text: 'Rome was not built in a day.', author: 'Proverb' },
];

/** The quote for a given day: the same all day, a different one tomorrow, every quote before any repeats. */
export function quoteFor(day: string): Quote {
  const n = Math.round(parseKey(day).getTime() / 86_400_000);
  // Stepping by a stride coprime to the list length visits every quote in a shuffled-looking order.
  return QUOTES[(((n * 7) % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
