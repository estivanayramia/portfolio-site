function normalizeLink(value) {
  if (!value) return '';

  let normalized = String(value).trim();
  if (!normalized) return '';

  try {
    const parsed = new URL(normalized, 'https://www.estivanayramia.com');
    normalized = parsed.pathname;
  } catch {
    // Keep original value when URL parsing fails.
  }

  normalized = normalized.replace(/\/index\.html$/i, '/');
  normalized = normalized.replace(/[#?].*$/, '');
  normalized = normalized.replace(/\/+$/, '');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized === '') normalized = '/';

  return normalized;
}

function createPreviewLookup(cards) {
  const lookup = new Map();
  cards.forEach((card) => {
    const key = normalizeLink(card.link);
    if (!key) return;
    lookup.set(key, card);
  });
  return lookup;
}

function setTextContent(node, value) {
  if (!node || typeof value !== 'string') return;
  if (node.textContent !== value) node.textContent = value;
}

function ensurePreviewImageNode(container, cardData) {
  if (!container) return null;

  let image = container.querySelector('img.card-image');
  if (!image) {
    image = document.createElement('img');
    image.className = 'card-image';
    image.loading = 'lazy';
    image.decoding = 'async';

    container.replaceChildren(image);
  }

  image.src = cardData.previewImage;
  image.alt = `${cardData.title} preview`;

  container.style.background = `url('${cardData.previewImage}') center / cover no-repeat`;
  container.style.backgroundImage = `url('${cardData.previewImage}')`;
  container.style.backgroundPosition = 'center';
  container.style.backgroundSize = 'cover';
  container.style.backgroundRepeat = 'no-repeat';

  return image;
}

function applyToCoverflowCard(cardNode, cardData) {
  const titleNode = cardNode.querySelector('.card-title');
  const categoryNode = cardNode.querySelector('.card-category');
  const descriptionNode = cardNode.querySelector('.card-description');
  const linkNode = cardNode.querySelector('.card-link, a[href]');
  const backgroundNode = cardNode.querySelector('.card-bg');

  setTextContent(titleNode, cardData.title);
  setTextContent(categoryNode, cardData.category);
  setTextContent(descriptionNode, cardData.description);

  if (linkNode) {
    linkNode.setAttribute('href', cardData.link);
  }

  ensurePreviewImageNode(backgroundNode, cardData);

  cardNode.dataset.title = cardData.title;
  cardNode.dataset.previewImage = cardData.previewImage;
  cardNode.dataset.previewLink = cardData.link;
  cardNode.dataset.cardId = cardData.id;
}

function applyToLegacyGridCard(cardNode, cardData) {
  const linkNode = cardNode.querySelector('a[href]');
  if (!linkNode) return;

  const titleNode = cardNode.querySelector('h2, h3');
  const descriptionNode = cardNode.querySelector('p');
  const mediaNode = cardNode.querySelector('.aspect-video, .card-image-container, .card-bg');

  setTextContent(titleNode, cardData.title);
  setTextContent(descriptionNode, cardData.description);

  linkNode.setAttribute('href', cardData.link);

  if (mediaNode) {
    mediaNode.style.backgroundImage = `url('${cardData.previewImage}')`;
    mediaNode.style.backgroundPosition = 'center';
    mediaNode.style.backgroundSize = 'cover';
    mediaNode.style.backgroundRepeat = 'no-repeat';

    let image = mediaNode.querySelector('img.card-image');
    if (!image) {
      image = document.createElement('img');
      image.className = 'card-image';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.style.width = '100%';
      image.style.height = '100%';
      image.style.objectFit = 'cover';

      mediaNode.replaceChildren(image);
    }

    image.src = cardData.previewImage;
    image.alt = `${cardData.title} preview`;
  }

  cardNode.dataset.previewImage = cardData.previewImage;
  cardNode.dataset.cardId = cardData.id;
}

function findCardDataFromNode(node, previewLookup) {
  const linkNode = node.querySelector('.card-link, a[href]');
  const href = linkNode ? linkNode.getAttribute('href') : node.getAttribute('data-link');
  const key = normalizeLink(href);
  if (!key) return null;

  return previewLookup.get(key) || null;
}

export function hydrateCardPreviewSurface(rootNode, cards) {
  if (!rootNode || !Array.isArray(cards) || cards.length === 0) return;

  const previewLookup = createPreviewLookup(cards);

  const coverflowCards = Array.from(rootNode.querySelectorAll('.coverflow-card'));
  coverflowCards.forEach((cardNode) => {
    const cardData = findCardDataFromNode(cardNode, previewLookup);
    if (!cardData) return;
    applyToCoverflowCard(cardNode, cardData);
  });

  const legacyCards = Array.from(rootNode.querySelectorAll('section.hidden article, .project-card, [data-preview-card]'));
  legacyCards.forEach((cardNode) => {
    if (cardNode.classList.contains('coverflow-card')) return;
    const cardData = findCardDataFromNode(cardNode, previewLookup);
    if (!cardData) return;
    applyToLegacyGridCard(cardNode, cardData);
  });
}

export function hydrateDocumentCardPreviews(cards) {
  hydrateCardPreviewSurface(document, cards);
}
