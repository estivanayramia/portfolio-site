import { ABOUT_CARD_PREVIEWS } from '../../assets/js/data/card-preview-manifest.mjs';

const toLegacyAboutShape = (card) => ({
  id: card.id,
  category: card.category,
  title: card.title,
  subtitle: card.category,
  preview: card.description,
  previewImage: card.previewImage,
  icon: '',
  link: card.link,
  type: card.link.startsWith('/about/') ? 'internal' : 'hobby'
});

const aboutSections = ABOUT_CARD_PREVIEWS.map(toLegacyAboutShape);

export { aboutSections };
export default aboutSections;

if (typeof window !== 'undefined' && window.document) {
  window.aboutSectionsData = aboutSections;
}
