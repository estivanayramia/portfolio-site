export const CARD_PREVIEW_VERSION = '2026-03-29-v4';
export const CARD_PREVIEW_OUTPUT_DIR = '/assets/img/generated/card-previews';

export const PROJECT_CARD_PREVIEWS = [
  {
    id: 'project-portfolio',
    category: 'Web Development',
    title: 'This Website',
    description: 'Hand-coded with PWA support, service workers, Lighthouse 90+ scores.',
    link: '/projects/portfolio',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/projects-portfolio-cover.webp`,
    generation: {
      type: 'screenshot',
      treatment: 'web-build-cover',
      routePath: '/EN/projects/portfolio.html',
      selectors: ['main', 'section.page-hero']
    }
  },
  {
    id: 'project-isa-grimes',
    category: 'Interview Project',
    title: 'Isa Grimes Interview',
    description: 'A real conversation about your 20s, people skills, leadership, favoritism, support systems, and why the fastest route is not always the right one.',
    link: '/projects/isa-grimes-interview',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/projects-isa-grimes-cover.webp`,
    generation: {
      type: 'screenshot',
      treatment: 'conversation-quote',
      quote: 'What leadership sounds like once life stops being theoretical.',
      routePath: '/EN/projects/isa-grimes-interview.html',
      selectors: ['main', 'section.page-hero']
    }
  },
  {
    id: 'project-loreal-maps',
    category: 'Campaign Strategy',
    title: "L'Oréal Cell BioPrint",
    description: 'MAPS campaign deck mapping personas across the funnel.',
    link: '/projects/loreal-maps-campaign',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/projects-loreal-pdf-cover.webp`,
    generation: {
      type: 'pdf',
      treatment: 'document-poster',
      source: '/assets/img/Portolio-Media/Portfolio-Media/projects-/loreal-maps-retail-playbook.pdf'
    }
  },
  {
    id: 'project-franklin-templeton',
    category: 'Content Strategy',
    title: 'Franklin Templeton',
    description: 'Dual-language investment content strategy for English and Arabic audiences.',
    link: '/projects/franklin-templeton-concept',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/projects-franklin-pdf-cover.webp`,
    generation: {
      type: 'pdf',
      treatment: 'document-poster',
      source: '/assets/img/Portolio-Media/Portfolio-Media/projects-/franklin-templeton-concept.pdf'
    }
  },
  {
    id: 'project-endpoint-linkedin',
    category: 'Retargeting',
    title: 'EndPoint LinkedIn Campaign',
    description: '15-page deck outlining Phase 2A and 2B retargeting strategy.',
    link: '/projects/endpoint-linkedin-campaign',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/projects-endpoint-linkedin-pdf-cover.webp`,
    generation: {
      type: 'pdf',
      treatment: 'document-poster',
      source: '/assets/img/Portolio-Media/Portfolio-Media/projects-/endpoint-linkedin-campaign.pdf'
    }
  },
  {
    id: 'project-elosity-video',
    category: 'Video Concept',
    title: 'Endpoint Elosity Launch',
    description: 'Motion storyboard and voiceover script for LinkedIn autoplay.',
    link: '/projects/endpoint-elosity-video',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/projects-endpoint-elosity-cover.webp`,
    generation: {
      type: 'screenshot',
      treatment: 'motion-storyboard',
      routePath: '/EN/projects/endpoint-elosity-video.html',
      selectors: ['main', 'section.page-hero']
    }
  },
  {
    id: 'project-endpoint-competitive',
    category: 'Strategy',
    title: 'Taking Down Endpoint',
    description: 'Almac + 4G Clinical positioning strategy against Endpoint.',
    link: '/projects/endpoint-competitive-playbook',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/projects-endpoint-competitive-pdf-cover.webp`,
    generation: {
      type: 'pdf',
      treatment: 'document-poster',
      source: '/assets/img/Portolio-Media/Portfolio-Media/projects-/endpoint-competitive-playbook.pdf'
    }
  }
];

export const ABOUT_CARD_PREVIEWS = [
  {
    id: 'about-values',
    category: 'Philosophy',
    title: 'Core Values',
    description: 'Curiosity, execution, growth through discomfort. The principles that shape how I approach problems.',
    link: '/about/values',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/about-values-cover.webp`,
    generation: {
      type: 'screenshot',
      treatment: 'chapter-opener-cover',
      routePath: '/EN/about/values.html',
      selectors: ['main', 'section.page-hero']
    }
  },
  {
    id: 'about-background',
    category: 'Identity',
    title: 'Background',
    description: 'Chaldean heritage, four languages, family history, and the context I come from.',
    link: '/about/background',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/about-background-collage.webp`,
    generation: {
      type: 'collage',
      treatment: 'identity-led-composition',
      sources: [
        '/assets/img/Portolio-Media/Portfolio-Media/Estivan_and_Alen_in_Iraq.webp',
        '/assets/img/headshot.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/me-/IMG_3447.webp'
      ]
    }
  },
  {
    id: 'about-working-with-me',
    category: 'Professional',
    title: 'Working With Me',
    description: 'Clear communication, follow-through, and what people can expect if we work together.',
    link: '/about/working-with-me',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/about-working-with-me-cover.webp`,
    generation: {
      type: 'screenshot',
      treatment: 'chapter-opener-cover',
      routePath: '/EN/about/working-with-me.html',
      selectors: ['main', 'section.page-hero']
    }
  },
  {
    id: 'about-gym',
    category: 'Physical',
    title: 'Gym & Strength Training',
    description: 'Building discipline through progressive overload. Tracking PRs, optimizing recovery.',
    link: '/hobbies/gym',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/hobbies-gym-collage.webp`,
    generation: {
      type: 'collage',
      treatment: 'hero-detail-triptych',
      sources: [
        '/assets/img/Portolio-Media/Portfolio-Media/gym-/beach_in_pb.jpg',
        '/assets/img/Portolio-Media/Portfolio-Media/gym-/hip_thrust_pr.jpg',
        '/assets/img/Portolio-Media/Portfolio-Media/gym-/sitting_on_curling_bench.png'
      ]
    }
  },
  {
    id: 'about-photography',
    category: 'Creative',
    title: 'Photography',
    description: 'iPhone shots that tell stories. No DSLR needed, just good lighting and better timing.',
    link: '/hobbies/photography',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/hobbies-photography-collage.webp`,
    generation: {
      type: 'collage',
      treatment: 'photography-contact-sheet',
      sources: [
        '/assets/img/Portolio-Media/Portfolio-Media/photography-/IMG_0799.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/photography-/IMG_2957.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/photography-/IMG_3473.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/photography-/IMG_3402.webp'
      ]
    }
  },
  {
    id: 'about-car',
    category: 'Mechanical',
    title: 'Car Enthusiasm',
    description: 'First car, first freedom. About ownership, maintenance, pride of keeping something running clean.',
    link: '/hobbies/car',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/hobbies-car-collage.webp`,
    generation: {
      type: 'collage',
      treatment: 'hero-detail-triptych',
      sources: [
        '/assets/img/Portolio-Media/Portfolio-Media/car-/car_by_ocean.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/car-/me_and_car.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/car-/car_front.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/car-/car_by_sunset.webp'
      ]
    }
  },
  {
    id: 'about-cooking',
    category: 'Culinary',
    title: 'Cooking',
    description: 'Steak, pasta, everything in between. Not a chef; just someone who refuses to eat mediocre food.',
    link: '/hobbies/cooking',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/hobbies-cooking-collage.webp`,
    generation: {
      type: 'collage',
      treatment: 'hero-detail-triptych',
      sources: [
        '/assets/img/Portolio-Media/Portfolio-Media/cooking-/avocado_steak_eggs_smoothie.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/cooking-/steaks.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/cooking-/chicken_alfredo_pasta.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/cooking-/vodka_pasta.webp'
      ]
    }
  },
  {
    id: 'about-whispers',
    category: 'Reflective',
    title: 'Whispers (Sticky Notes)',
    description: 'Random thoughts on sticky notes. Ideas, observations, reminders. Mental clutter organized.',
    link: '/hobbies/whispers',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/hobbies-whispers-collage.webp`,
    generation: {
      type: 'collage',
      treatment: 'reflective-note-cover',
      sources: [
        '/assets/img/Portolio-Media/Portfolio-Media/whispers-/Note 10.jpg',
        '/assets/img/Portolio-Media/Portfolio-Media/whispers-/Note 24.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/whispers-/Note 38.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/whispers-/Note 41.webp'
      ]
    }
  },
  {
    id: 'about-reading',
    category: 'Intellectual',
    title: 'Reading',
    description: 'Books are compressed experience. Cheapest way to access decades of wisdom.',
    link: '/hobbies/reading',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/hobbies-reading-collage.webp`,
    generation: {
      type: 'collage',
      treatment: 'reading-editorial',
      sources: [
        '/assets/img/Portolio-Media/Portfolio-Media/reading-/reading_by_beach.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/reading-/dead_kindle_3.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/reading-/Advice_From_Aristotle.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/reading-/How_To_Win_Friends_and_Influence_People_Dale_Carnegie.webp'
      ]
    }
  },
  {
    id: 'about-me',
    category: 'Personal',
    title: 'Me',
    description: 'Personal snapshots that capture identity, growth, and the moments behind the work.',
    link: '/hobbies/me',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/hobbies-me-collage.webp`,
    generation: {
      type: 'collage',
      treatment: 'hero-detail-triptych',
      sources: [
        '/assets/img/Portolio-Media/Portfolio-Media/me-/IMG_0551.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/me-/IMG_1411.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/me-/IMG_3447.webp',
        '/assets/img/Portolio-Media/Portfolio-Media/me-/IMG_8895.webp'
      ]
    }
  },
  {
    id: 'about-games',
    category: 'Strategy',
    title: 'Games',
    description: 'Chess, strategy games, competitive thinking. Because even hobbies teach systems.',
    link: '/hobbies-games',
    previewImage: `${CARD_PREVIEW_OUTPUT_DIR}/hobbies-games-cover.webp`,
    generation: {
      type: 'screenshot',
      treatment: 'chapter-opener-cover',
      routePath: '/EN/hobbies-games.html',
      selectors: ['main', '#arcade-featured-carousel']
    }
  }
];

export const CARD_PREVIEW_MANIFEST = {
  version: CARD_PREVIEW_VERSION,
  outputDir: CARD_PREVIEW_OUTPUT_DIR,
  projectCards: PROJECT_CARD_PREVIEWS,
  aboutCards: ABOUT_CARD_PREVIEWS
};
