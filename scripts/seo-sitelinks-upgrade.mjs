import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const pages = [
  {
    file: "index.html",
    url: "https://www.estivanayramia.com/",
    pageName: "Estivan Ayramia | Portfolio",
    shortName: "Home",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [{ name: "Home", item: "https://www.estivanayramia.com/" }],
    description:
      "Estivan Ayramia's portfolio hub featuring projects, strategy case studies, operations systems, and practical insights from business and creative work.",
    image: {
      loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp",
      title: "Estivan Ayramia logo",
    },
  },
  {
    file: "EN/index.html",
    url: "https://www.estivanayramia.com/",
    pageName: "Portfolio Home Source | Estivan Ayramia",
    shortName: "Home Source",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [{ name: "Home", item: "https://www.estivanayramia.com/" }],
    description:
      "Source template for the portfolio homepage used in the build workflow for estivanayramia.com.",
    image: {
      loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp",
      title: "Estivan Ayramia logo",
    },
    skipSchema: true,
  },
  {
    file: "EN/about.html",
    url: "https://www.estivanayramia.com/about",
    pageName: "About | Estivan Ayramia",
    shortName: "About",
    type: "ProfilePage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "About", item: "https://www.estivanayramia.com/about" },
    ],
    description:
      "Learn about Estivan Ayramia's background, values, and working philosophy, including the principles that guide execution, growth, and long-term discipline.",
    image: {
      loc: "https://www.estivanayramia.com/assets/img/headshot.webp",
      title: "Headshot of Estivan Ayramia",
    },
  },
  {
    file: "EN/about/background.html",
    url: "https://www.estivanayramia.com/about/background",
    pageName: "Background | Estivan Ayramia",
    shortName: "Background",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "About", item: "https://www.estivanayramia.com/about" },
      { name: "Background", item: "https://www.estivanayramia.com/about/background" },
    ],
    description:
      "Explore Estivan Ayramia's personal and academic background, including formative experiences that shaped his approach to operations, communication, and execution.",
  },
  {
    file: "EN/about/values.html",
    url: "https://www.estivanayramia.com/about/values",
    pageName: "Values | Estivan Ayramia",
    shortName: "Values",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "About", item: "https://www.estivanayramia.com/about" },
      { name: "Values", item: "https://www.estivanayramia.com/about/values" },
    ],
    description:
      "See the core values that drive Estivan Ayramia's decision-making, work ethic, and long-term focus across projects, leadership opportunities, and daily practice.",
  },
  {
    file: "EN/about/working-with-me.html",
    url: "https://www.estivanayramia.com/about/working-with-me",
    pageName: "Working With Me | Estivan Ayramia",
    shortName: "Working With Me",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "About", item: "https://www.estivanayramia.com/about" },
      {
        name: "Working With Me",
        item: "https://www.estivanayramia.com/about/working-with-me",
      },
    ],
    description:
      "Understand how Estivan Ayramia collaborates: communication style, workflow expectations, and the standards used to deliver reliable outcomes with strong momentum.",
  },
  {
    file: "EN/overview.html",
    url: "https://www.estivanayramia.com/overview",
    pageName: "Overview | Estivan Ayramia",
    shortName: "Overview",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Overview", item: "https://www.estivanayramia.com/overview" },
    ],
    description:
      "Get a concise overview of Estivan Ayramia's profile, capabilities, and focus areas, with quick pathways into projects, strategy work, and deeper context.",
  },
  {
    file: "EN/deep-dive.html",
    url: "https://www.estivanayramia.com/deep-dive",
    pageName: "Deep Dive | Estivan Ayramia",
    shortName: "Deep Dive",
    type: "WebPage",
    ogType: "article",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Deep Dive", item: "https://www.estivanayramia.com/deep-dive" },
    ],
    description:
      "Dive into detailed context behind Estivan Ayramia's work, including thought process, execution methods, and lessons learned from complex projects and iterations.",
  },
  {
    file: "EN/projects/index.html",
    url: "https://www.estivanayramia.com/projects/",
    pageName: "Projects | Estivan Ayramia",
    shortName: "Projects",
    type: "CollectionPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Projects", item: "https://www.estivanayramia.com/projects/" },
    ],
    description:
      "Browse selected projects by Estivan Ayramia across strategy, operations, documentation, and systems design, with outcomes, process notes, and execution details.",
    image: {
      loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp",
      title: "Estivan Ayramia projects overview",
    },
  },
  {
    file: "EN/projects/endpoint-competitive-playbook.html",
    url: "https://www.estivanayramia.com/projects/endpoint-competitive-playbook",
    pageName: "Endpoint Competitive Playbook | Estivan Ayramia",
    shortName: "Endpoint Competitive Playbook",
    type: "WebPage",
    ogType: "article",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Projects", item: "https://www.estivanayramia.com/projects/" },
      {
        name: "Endpoint Competitive Playbook",
        item: "https://www.estivanayramia.com/projects/endpoint-competitive-playbook",
      },
    ],
    description:
      "Review the Endpoint Competitive Playbook project: positioning strategy, account planning, and messaging structure designed to improve win probability in enterprise sales.",
    image: {
      loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp",
      title: "Endpoint Competitive Playbook project",
    },
  },
  {
    file: "EN/projects/conflict.html",
    url: "https://www.estivanayramia.com/projects/conflict",
    pageName: "Conflict Strategy Case | Estivan Ayramia",
    shortName: "Conflict Strategy Case",
    type: "WebPage",
    ogType: "article",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Projects", item: "https://www.estivanayramia.com/projects/" },
      { name: "Conflict", item: "https://www.estivanayramia.com/projects/conflict" },
    ],
    description:
      "Explore the Conflict strategy case from Estivan Ayramia's portfolio, including framing, analysis, and practical recommendations for high-stakes decision environments.",
  },
  {
    file: "EN/projects/franklin-templeton-concept.html",
    url: "https://www.estivanayramia.com/projects/franklin-templeton-concept",
    pageName: "Franklin Templeton Concept | Estivan Ayramia",
    shortName: "Franklin Templeton Concept",
    type: "WebPage",
    ogType: "article",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Projects", item: "https://www.estivanayramia.com/projects/" },
      {
        name: "Franklin Templeton Concept",
        item: "https://www.estivanayramia.com/projects/franklin-templeton-concept",
      },
    ],
    description:
      "See the Franklin Templeton concept project by Estivan Ayramia, focused on strategic communication, concept development, and practical business storytelling.",
  },
  {
    file: "EN/projects/endpoint-linkedin-campaign.html",
    url: "https://www.estivanayramia.com/projects/endpoint-linkedin-campaign",
    pageName: "Endpoint LinkedIn Campaign | Estivan Ayramia",
    shortName: "Endpoint LinkedIn Campaign",
    type: "WebPage",
    ogType: "article",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Projects", item: "https://www.estivanayramia.com/projects/" },
      {
        name: "Endpoint LinkedIn Campaign",
        item: "https://www.estivanayramia.com/projects/endpoint-linkedin-campaign",
      },
    ],
    description:
      "Analyze the Endpoint LinkedIn Campaign project: audience targeting, campaign structure, and messaging decisions used to support measurable engagement outcomes.",
  },
  {
    file: "EN/projects/loreal-maps-campaign.html",
    url: "https://www.estivanayramia.com/projects/loreal-maps-campaign",
    pageName: "Loreal Maps Campaign | Estivan Ayramia",
    shortName: "Loreal Maps Campaign",
    type: "WebPage",
    ogType: "article",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Projects", item: "https://www.estivanayramia.com/projects/" },
      {
        name: "Loreal Maps Campaign",
        item: "https://www.estivanayramia.com/projects/loreal-maps-campaign",
      },
    ],
    description:
      "Read the Loreal MAPS campaign case by Estivan Ayramia, covering strategic mapping, positioning choices, and how campaign planning aligned with brand goals.",
  },
  {
    file: "EN/projects/endpoint-elosity-video.html",
    url: "https://www.estivanayramia.com/projects/endpoint-elosity-video",
    pageName: "Endpoint Elosity Video | Estivan Ayramia",
    shortName: "Endpoint Elosity Video",
    type: "WebPage",
    ogType: "article",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Projects", item: "https://www.estivanayramia.com/projects/" },
      {
        name: "Endpoint Elosity Video",
        item: "https://www.estivanayramia.com/projects/endpoint-elosity-video",
      },
    ],
    description:
      "Discover the Endpoint Elosity Video project by Estivan Ayramia, including creative direction, narrative structure, and production choices tied to campaign intent.",
  },
  {
    file: "EN/projects/portfolio.html",
    url: "https://www.estivanayramia.com/projects/portfolio",
    pageName: "Portfolio Build | Estivan Ayramia",
    shortName: "Portfolio Build",
    type: "WebPage",
    ogType: "article",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Projects", item: "https://www.estivanayramia.com/projects/" },
      { name: "Portfolio", item: "https://www.estivanayramia.com/projects/portfolio" },
    ],
    description:
      "See how this portfolio was designed and built by Estivan Ayramia, from information architecture and performance tuning to accessibility and maintainable systems.",
  },
  {
    file: "EN/hobbies/index.html",
    url: "https://www.estivanayramia.com/hobbies/",
    pageName: "Hobbies | Estivan Ayramia",
    shortName: "Hobbies",
    type: "CollectionPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies", item: "https://www.estivanayramia.com/hobbies/" },
    ],
    description:
      "Explore Estivan Ayramia's hobbies, from fitness and photography to reading and creative notes, and see how these interests support discipline and perspective.",
  },
  {
    file: "EN/hobbies/car.html",
    url: "https://www.estivanayramia.com/hobbies/car",
    pageName: "Car Enthusiasm | Estivan Ayramia",
    shortName: "Car",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies", item: "https://www.estivanayramia.com/hobbies/" },
      { name: "Car", item: "https://www.estivanayramia.com/hobbies/car" },
    ],
    description:
      "Read about Estivan Ayramia's car enthusiasm, including maintenance mindset, ownership lessons, and the discipline developed through practical mechanical care.",
  },
  {
    file: "EN/hobbies/cooking.html",
    url: "https://www.estivanayramia.com/hobbies/cooking",
    pageName: "Cooking | Estivan Ayramia",
    shortName: "Cooking",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies", item: "https://www.estivanayramia.com/hobbies/" },
      { name: "Cooking", item: "https://www.estivanayramia.com/hobbies/cooking" },
    ],
    description:
      "See how cooking fits into Estivan Ayramia's routine, balancing creativity and consistency while building patience, process awareness, and attention to detail.",
  },
  {
    file: "EN/hobbies/gym.html",
    url: "https://www.estivanayramia.com/hobbies/gym",
    pageName: "Gym Training | Estivan Ayramia",
    shortName: "Gym",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies", item: "https://www.estivanayramia.com/hobbies/" },
      { name: "Gym", item: "https://www.estivanayramia.com/hobbies/gym" },
    ],
    description:
      "Learn about Estivan Ayramia's gym and strength training approach, emphasizing consistency, progressive improvement, and the mindset required for long-term growth.",
  },
  {
    file: "EN/hobbies/me.html",
    url: "https://www.estivanayramia.com/hobbies/me",
    pageName: "Me | Estivan Ayramia",
    shortName: "Me",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies", item: "https://www.estivanayramia.com/hobbies/" },
      { name: "Me", item: "https://www.estivanayramia.com/hobbies/me" },
    ],
    description:
      "Get a personal snapshot from Estivan Ayramia, highlighting interests and reflections that complement professional work with authenticity and grounded perspective.",
  },
  {
    file: "EN/hobbies/photography.html",
    url: "https://www.estivanayramia.com/hobbies/photography",
    pageName: "Photography | Estivan Ayramia",
    shortName: "Photography",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies", item: "https://www.estivanayramia.com/hobbies/" },
      { name: "Photography", item: "https://www.estivanayramia.com/hobbies/photography" },
    ],
    description:
      "Explore Estivan Ayramia's photography hobby and visual storytelling approach, from composition choices to everyday moments captured with intentional framing.",
  },
  {
    file: "EN/hobbies/reading.html",
    url: "https://www.estivanayramia.com/hobbies/reading",
    pageName: "Reading | Estivan Ayramia",
    shortName: "Reading",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies", item: "https://www.estivanayramia.com/hobbies/" },
      { name: "Reading", item: "https://www.estivanayramia.com/hobbies/reading" },
    ],
    description:
      "Discover how reading supports Estivan Ayramia's thinking, helping connect ideas across business, personal development, and practical decision-making.",
  },
  {
    file: "EN/hobbies/whispers.html",
    url: "https://www.estivanayramia.com/hobbies/whispers",
    pageName: "Whispers Notes | Estivan Ayramia",
    shortName: "Whispers",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies", item: "https://www.estivanayramia.com/hobbies/" },
      { name: "Whispers", item: "https://www.estivanayramia.com/hobbies/whispers" },
    ],
    description:
      "Browse Whispers, a collection of concise notes and reflections by Estivan Ayramia that capture ideas, lessons, and perspective across everyday life.",
  },
  {
    file: "EN/hobbies-games.html",
    url: "https://www.estivanayramia.com/hobbies-games",
    pageName: "Hobbies Games | Estivan Ayramia",
    shortName: "Hobbies Games",
    type: "CollectionPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies Games", item: "https://www.estivanayramia.com/hobbies-games" },
    ],
    description:
      "Play browser-based arcade games by Estivan Ayramia, including classics and original mini-games designed for quick interaction, challenge, and fun.",
  },
  {
    file: "EN/contact.html",
    url: "https://www.estivanayramia.com/contact",
    pageName: "Contact | Estivan Ayramia",
    shortName: "Contact",
    type: "ContactPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Contact", item: "https://www.estivanayramia.com/contact" },
    ],
    description:
      "Contact Estivan Ayramia for collaboration, project discussion, or professional opportunities through the official contact page and preferred channels.",
  },
  {
    file: "EN/privacy.html",
    url: "https://www.estivanayramia.com/privacy",
    pageName: "Privacy Policy | Estivan Ayramia",
    shortName: "Privacy",
    type: "WebPage",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Privacy", item: "https://www.estivanayramia.com/privacy" },
    ],
    description:
      "Review the privacy policy for estivanayramia.com, including data handling, analytics context, and the principles used to protect visitor information.",
  },
];

const gameFiles = [
  "EN/hobbies-games/1024-moves.html",
  "EN/hobbies-games/2048.html",
  "EN/hobbies-games/block-breaker.html",
  "EN/hobbies-games/nano-wirebot.html",
  "EN/hobbies-games/off-the-line.html",
  "EN/hobbies-games/oh-flip.html",
  "EN/hobbies-games/onoff.html",
  "EN/hobbies-games/pizza-undelivery.html",
  "EN/hobbies-games/racer.html",
  "EN/hobbies-games/snake.html",
  "EN/hobbies-games/space-invaders.html",
  "EN/hobbies-games/the-matr13k.html",
  "EN/hobbies-games/triangle-back-to-home.html",
  "EN/hobbies-games/xx142-b2exe.html",
];

for (const file of gameFiles) {
  const slug = file.split("/").pop().replace(/\.html$/, "");
  const name = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace("Xx142 B2exe", "XX142 B2EXE")
    .replace("The Matr13k", "The MATR13K")
    .replace("Onoff", "OnOff")
    .replace("1024 Moves", "1024 Moves")
    .replace("2048", "2048");

  pages.push({
    file,
    url: `https://www.estivanayramia.com/hobbies-games/${slug}`,
    pageName: `${name} Game | Estivan Ayramia`,
    shortName: name,
    type: "SoftwareApplication",
    ogType: "website",
    breadcrumb: [
      { name: "Home", item: "https://www.estivanayramia.com/" },
      { name: "Hobbies Games", item: "https://www.estivanayramia.com/hobbies-games" },
      { name, item: `https://www.estivanayramia.com/hobbies-games/${slug}` },
    ],
    description: `Play ${name}, a browser game in Estivan Ayramia's arcade collection, built for quick sessions, responsive controls, and engaging gameplay loops.`,
  });
}

const pageByFile = new Map(pages.map((page) => [page.file, page]));

function replaceOrInsert(text, pattern, replacement, insertBefore = "</head>") {
  if (pattern.test(text)) {
    return text.replace(pattern, replacement);
  }
  return text.replace(insertBefore, `${replacement}\n${insertBefore}`);
}

function buildPageGraph(page) {
  const graph = [];

  if (page.file === "index.html") {
    graph.push(
      {
        "@type": "WebSite",
        "@id": "https://www.estivanayramia.com/#website",
        url: "https://www.estivanayramia.com/",
        name: "Estivan Ayramia",
        description: page.description,
        publisher: {
          "@type": "Person",
          name: "Estivan Ayramia",
          url: "https://www.estivanayramia.com/",
        },
        inLanguage: "en",
      },
      {
        "@type": "Person",
        "@id": "https://www.estivanayramia.com/#person",
        name: "Estivan Ayramia",
        url: "https://www.estivanayramia.com/",
        jobTitle: "Business Administration Graduate",
        alumniOf: {
          "@type": "CollegeOrUniversity",
          name: "San Diego State University",
          sameAs: "https://www.sdsu.edu/",
        },
        knowsLanguage: ["en", "es", "ar", "syc"],
        knowsAbout: [
          "Operations systems",
          "Process documentation",
          "Campaign strategy",
          "Portfolio development",
        ],
        sameAs: [
          "https://www.linkedin.com/in/estivanayramia/",
          "https://github.com/estivanayramia/",
        ],
      }
    );
  }

  const pageNode = {
    "@type": page.type === "SoftwareApplication" ? ["WebPage", "SoftwareApplication"] : page.type,
    "@id": `${page.url}#webpage`,
    url: page.url,
    name: page.pageName,
    description: page.description,
    isPartOf: "https://www.estivanayramia.com/",
    about: "https://www.estivanayramia.com/#person",
    inLanguage: "en",
  };

  if (page.type === "SoftwareApplication") {
    pageNode.applicationCategory = "GameApplication";
    pageNode.operatingSystem = "Web Browser";
    pageNode.isAccessibleForFree = true;
    pageNode.offers = { "@type": "Offer", price: "0", priceCurrency: "USD" };
  }

  if (page.image?.loc) {
    pageNode.primaryImageOfPage = page.image.loc;
    pageNode.image = page.image.loc;
  }

  graph.push(pageNode);

  graph.push({
    "@type": "BreadcrumbList",
    "@id": `${page.url}#breadcrumb`,
    itemListElement: page.breadcrumb.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  });

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function updatePage(page) {
  const absolutePath = path.join(repoRoot, page.file);
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  let source = fs.readFileSync(absolutePath, "utf8");

  source = source.replace(/\r\n/g, "\n");

  source = replaceOrInsert(
    source,
    /<title>[\s\S]*?<\/title>/i,
    `    <title>${page.pageName}</title>`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+name=["']description["'][^>]*>/i,
    `    <meta name="description" content="${page.description}">`
  );

  source = replaceOrInsert(
    source,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `    <link rel="canonical" href="${page.url}">`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+property=["']og:type["'][^>]*>/i,
    `    <meta property="og:type" content="${page.ogType}">`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `    <meta property="og:title" content="${page.pageName}">`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `    <meta property="og:description" content="${page.description}">`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `    <meta property="og:url" content="${page.url}">`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+name=["']twitter:title["'][^>]*>/i,
    `    <meta name="twitter:title" content="${page.pageName}">`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+name=["']twitter:description["'][^>]*>/i,
    `    <meta name="twitter:description" content="${page.description}">`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+name=["']twitter:card["'][^>]*>/i,
    "    <meta name=\"twitter:card\" content=\"summary_large_image\">"
  );

  const ogImage = page.image?.loc || "https://www.estivanayramia.com/assets/img/logo-ea.webp";
  source = replaceOrInsert(
    source,
    /<meta\s+property=["']og:image["'][^>]*>/i,
    `    <meta property="og:image" content="${ogImage}">`
  );

  source = replaceOrInsert(
    source,
    /<meta\s+name=["']twitter:image["'][^>]*>/i,
    `    <meta name="twitter:image" content="${ogImage}">`
  );

  source = source.replace(/\s*<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>\s*/gi, "\n");

  if (!page.skipSchema) {
    const jsonLd = buildPageGraph(page);
    const block = `\n    <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n")}\n    </script>\n`;

    source = source.replace("</head>", `${block}</head>`);
  }

  fs.writeFileSync(absolutePath, source.replace(/\n/g, "\r\n"));
}

for (const page of pages) {
  updatePage(page);
}

const sitemapPath = path.join(repoRoot, "sitemap.xml");
let sitemap = fs.readFileSync(sitemapPath, "utf8").replace(/\r\n/g, "\n");

if (!sitemap.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')) {
  sitemap = sitemap.replace(
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"\n        xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\">"
  );
}

const imageEntries = new Map([
  ["https://www.estivanayramia.com/", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Estivan Ayramia logo" }],
  ["https://www.estivanayramia.com/about", { loc: "https://www.estivanayramia.com/assets/img/headshot.webp", title: "Headshot of Estivan Ayramia" }],
  ["https://www.estivanayramia.com/projects/", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Estivan Ayramia projects overview" }],
  ["https://www.estivanayramia.com/projects/endpoint-competitive-playbook", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Endpoint Competitive Playbook project" }],
  ["https://www.estivanayramia.com/projects/conflict", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Conflict strategy case project" }],
  ["https://www.estivanayramia.com/projects/franklin-templeton-concept", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Franklin Templeton concept project" }],
  ["https://www.estivanayramia.com/projects/endpoint-linkedin-campaign", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Endpoint LinkedIn campaign project" }],
  ["https://www.estivanayramia.com/projects/loreal-maps-campaign", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Loreal MAPS campaign project" }],
  ["https://www.estivanayramia.com/projects/endpoint-elosity-video", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Endpoint Elosity video project" }],
  ["https://www.estivanayramia.com/projects/portfolio", { loc: "https://www.estivanayramia.com/assets/img/logo-ea.webp", title: "Portfolio build project" }],
]);

sitemap = sitemap.replace(/<url>[\s\S]*?<\/url>/g, (urlBlock) => {
  const locMatch = urlBlock.match(/<loc>([^<]+)<\/loc>/);
  if (!locMatch) {
    return urlBlock;
  }
  const loc = locMatch[1].trim();
  const image = imageEntries.get(loc);
  if (!image) {
    return urlBlock;
  }
  if (urlBlock.includes("<image:image>")) {
    return urlBlock;
  }

  const imageXml = `\n    <image:image>\n      <image:loc>${image.loc}</image:loc>\n      <image:title>${image.title}</image:title>\n    </image:image>`;
  return urlBlock.replace("  </url>", `${imageXml}\n  </url>`);
});

fs.writeFileSync(sitemapPath, sitemap.replace(/\n/g, "\r\n"));

console.log(`Updated ${pages.length} pages and sitemap.xml`);