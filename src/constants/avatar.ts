export const AVATAR_EMOJI = {
  fox: '🦊',
  bear: '🐻',
  panda: '🐼',
  koala: '🐨',
  tiger: '🐯',
  lion: '🦁',
  frog: '🐸',
  monkey: '🐵',
  penguin: '🐧',
  owl: '🦉',
  octopus: '🐙',
  unicorn: '🦄',
  peach: '🍑',
  orange: '🍊',
  lemon: '🍋',
  watermelon: '🍉',
  avocado: '🥑',
  cherries: '🍒',
  weightlifter: '🏋️',
  'boxing-glove': '🥊',
  cyclist: '🚴',
  runner: '🏃',
  lightning: '⚡',
  fire: '🔥',
} as const;

export type AvatarEmojiId = keyof typeof AVATAR_EMOJI;

export const AVATAR_EMOJI_IDS = Object.keys(AVATAR_EMOJI) as AvatarEmojiId[];

export const AVATAR_COLORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];
