# RadialCarousel

Apple-level 3D “radial” carousel with progressive enhancement:

- **No JS:** horizontal scroll-snap list (touch + trackpad friendly)
- **JS + desktop:** 3D orbital layout (GPU transforms only)

## Files

- `assets/js/carousel/RadialCarousel.js` (source, ES module)
- `assets/js/carousel/RadialCarousel.min.js` (production bundle)
- `assets/js/carousel/carousel-utils.js` (shared utils)
- `assets/css/carousel/radial-carousel.css` (source)
- `assets/css/carousel/radial-carousel.min.css` (production)
- `assets/css/carousel/carousel-themes.css` (theme variables)

## Markup contract

```html
<section
  class="carousel-radial"
  data-carousel-radial
  data-carousel-radius="450"
  aria-label="Project carousel"
>
  <div class="carousel-radial__viewport" role="region" aria-label="Projects">
    <ul class="carousel-radial__track" role="list">
      <li class="carousel-radial__item" role="listitem" data-index="0">
        <article class="carousel-radial__card">
          <h3 class="carousel-radial__title">Item Title</h3>
          <p class="carousel-radial__description">Short description</p>
          <a class="carousel-radial__link" href="/item/detail">Learn More →</a>
        </article>
      </li>
    </ul>
  </div>

  <div class="carousel-radial__controls" aria-live="polite">
    <button class="carousel-radial__btn carousel-radial__btn--prev" type="button" aria-label="Previous">
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
    </button>

    <span class="carousel-radial__status" role="status" aria-atomic="true">Item 1 of N</span>

    <button class="carousel-radial__btn carousel-radial__btn--next" type="button" aria-label="Next">
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  </div>

  <div class="carousel-radial__indicators" role="tablist" aria-label="Carousel navigation"></div>
</section>
```

## Page wiring

```html
<link rel="stylesheet" href="/assets/css/carousel/carousel-themes.min.css" />
<link rel="stylesheet" href="/assets/css/carousel/radial-carousel.min.css" />
<script type="module" src="/assets/js/carousel/RadialCarousel.min.js"></script>
```

The module auto-initializes all `[data-carousel-radial]` on `DOMContentLoaded`.

## Data attributes

- `data-carousel-radius="450"`: 3D orbit radius (px)
- `data-carousel-rotation-speed="600"`: transition duration (ms)
- `data-carousel-min-items="4"`: minimum items required for 3D enhancement
- `data-carousel-autorotate="1"` / `data-carousel-autorotate-ms="4500"`: auto-rotate when visible
- `data-carousel-enable-touch="1"`: drag-to-rotate on desktop (3D mode only)
- `data-carousel-match-path="1"`: sets initial active item by matching the first `a[href]` inside each item to `location.pathname`
- `data-carousel-click-to-center="1"`: clicking a non-active item rotates it to center
- `data-carousel-link-aware="1"`: link clicks on non-active items rotate instead of navigating
- `data-carousel-start-index="0"`: explicit initial index

## Accessibility

- Baseline mode keeps all items interactive for natural browsing.
- 3D mode uses an “active-only” interaction model (non-active items set `aria-hidden` and `inert` when supported).
- Keyboard: **ArrowLeft/ArrowRight**, **Home/End**
- Live status: `.carousel-radial__status` updates on selection.

## Events

The carousel dispatches a `carouselrotate` event on the root element:

```js
el.addEventListener('carouselrotate', (e) => {
  console.log(e.detail.index, e.detail.item);
});
```

