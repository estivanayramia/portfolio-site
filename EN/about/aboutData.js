/**
 * About Section Data - 10 Cards for Carousel
 * 
 * Structure: 3 About Pages + 6 Hobbies + 1 Games
 * Each card links to its respective comprehensive page
 * 
 * Research Citations:
 * - Content organization: Nielsen Norman Group UX patterns for progressive disclosure
 * - Card design: Material Design 3 card component specs
 */

const aboutSections = [
  // ===== ABOUT PAGES (3) =====
  {
    id: 'values',
    category: 'Philosophy',
    title: 'Core Values',
    subtitle: 'What drives the work',
    preview: 'The standards I actually try to live by, and the stuff I learned the hard way.',
    icon: '⚖️',
    link: '/about/values',
    type: 'internal'
  },
  {
    id: 'background',
    category: 'Identity',
    title: 'Background',
    subtitle: 'Baghdad → El Cajon',
    preview: 'Chaldean, Iraqi-American, four languages, family history, and the context I come from.',
    icon: '🏠',
    link: '/about/background',
    type: 'internal'
  },
  {
    id: 'working-with-me',
    category: 'Professional',
    title: 'Working With Me',
    subtitle: 'How I operate',
    preview: 'Clear communication, follow-through, and what people can expect if we work together.',
    icon: '🤝',
    link: '/about/working-with-me',
    type: 'internal'
  },
  
  // ===== HOBBIES (6) =====
  {
    id: 'hobby-gym',
    category: 'Physical',
    title: 'Gym & Strength Training',
    subtitle: 'Discipline through progressive overload',
    preview: 'Training, PRs, and showing up even when I do not feel like it.',
    icon: '💪',
    link: '/hobbies/gym',
    type: 'hobby'
  },
  {
    id: 'hobby-photography',
    category: 'Creative',
    title: 'Photography',
    subtitle: 'Capturing moments',
    preview: 'iPhone shots that tell stories. No DSLR needed, just good lighting and better timing.',
    icon: '📸',
    link: '/hobbies/photography',
    type: 'hobby'
  },
  {
    id: 'hobby-car',
    category: 'Mechanical',
    title: 'Car Enthusiasm',
    subtitle: 'BMW project',
    preview: 'First car, first freedom. Not about speed; about ownership, maintenance, pride of keeping something running clean.',
    icon: '🚗',
    link: '/hobbies/car',
    type: 'hobby'
  },
  {
    id: 'hobby-cooking',
    category: 'Culinary',
    title: 'Cooking',
    subtitle: 'No mediocre meals',
    preview: 'Steak, pasta, everything in between. Not a chef; just someone who refuses to eat mediocre food.',
    icon: '🍳',
    link: '/hobbies/cooking',
    type: 'hobby'
  },
  {
    id: 'hobby-whispers',
    category: 'Reflective',
    title: 'Whispers (Sticky Notes)',
    subtitle: 'Low-tech brain dump',
    preview: 'Random thoughts on sticky notes. Ideas, observations, reminders. Mental clutter organized.',
    icon: '📝',
    link: '/hobbies/whispers',
    type: 'hobby'
  },
  {
    id: 'hobby-reading',
    category: 'Intellectual',
    title: 'Reading',
    subtitle: 'Compressed wisdom',
    preview: 'Books are compressed experience. Cheapest way to access decades of wisdom without making same mistakes.',
    icon: '📚',
    link: '/hobbies/reading',
    type: 'hobby'
  },
  
  // ===== GAMES (1 - LAST) =====
  {
    id: 'hobby-games',
    category: 'Strategy',
    title: 'Games',
    subtitle: 'If I\'m boring you...',
    preview: 'Chess, strategy games, and the part of me that likes figuring people out.',
    icon: '🎮',
    link: '/hobbies-games',
    type: 'hobby'
  }
];

// Export for module use (Node.js/CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = aboutSections;
}

// Export for ES6 modules
if (typeof exports !== 'undefined') {
  exports.aboutSections = aboutSections;
}

// Also expose globally for browser use
if (typeof window !== 'undefined' && window.document) {
  window.aboutSectionsData = aboutSections;
}
