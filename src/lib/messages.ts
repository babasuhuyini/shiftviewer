/**
 * Short, warm messages shown when the app opens.
 * Kept respectful and gentle — fine for anyone glancing at the screen.
 * Nothing here is personal data, and nothing is sent anywhere.
 */
export const MESSAGES: readonly string[] = [
  'You make hard days lighter for everyone around you.',
  'Proud of you — today and every day.',
  'Your kindness is someone’s comfort today.',
  'Remember to drink water and take your breaks. You matter too.',
  'Thinking of you, and smiling.',
  'Every shift, you show what quiet strength looks like.',
  'Sending you a warm hug for the day ahead.',
  'The world is a little gentler because you’re in it.',
  'Take a deep breath. You’re doing beautifully.',
  'Your patience and care are a gift to everyone you meet.',
  'Rest well when you can. You deserve every bit of it.',
  'Just a gentle reminder: you are loved.',
  'You bring light to long nights.',
  'May today be as kind to you as you are to others.',
  'You are wonderful at what you do.',
  'Here’s to a calm shift and a lovely day.',
  'Can’t wait to hear about your day.',
  'Your smile makes every day better.',
  'Wishing you strength, peace, and a good cup of tea.',
  'You inspire me more than you know.',
  'Go gently today. You’re doing more than enough.',
  'Every life you care for is better for it.',
  'Thank you for all the care you give — and for being you.',
  'Whatever today brings, you’ve got this.',
  'You deserve the same care you give so freely.',
  'A little sunshine for your day: you are appreciated.',
  'Counting down the hours until I see you.',
  'Your heart is your superpower.',
];

const RECENT_KEY = 'myShifts.recentMessages.v1';
/** How many recent messages to avoid repeating. */
const AVOID = 8;

function readRecent(): number[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: number[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(-AVOID)));
  } catch {
    /* storage unavailable — messages still rotate randomly */
  }
}

/**
 * Pick a message for this app opening, avoiding the last few shown on this device.
 * Called once per page load.
 */
export function pickMessage(random: () => number = Math.random): string {
  const recent = readRecent();
  const pool = MESSAGES.map((_, i) => i).filter((i) => !recent.includes(i));
  const choices = pool.length ? pool : MESSAGES.map((_, i) => i);
  const index = choices[Math.floor(random() * choices.length)];
  writeRecent([...recent, index]);
  return MESSAGES[index];
}

/** "Good morning" / "Good afternoon" / "Good evening" from the device's local time. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Hello, night owl';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
