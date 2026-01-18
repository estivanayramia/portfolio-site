


 1 **games.html: fix Savonie thumbnail image behavior**

   * `<img src="/assets/img/savonie-thumb.webp" ...>` does not open/behave correctly.
   * Make it open the correct view as intended, similar to how it works in the index.html, this should be the standard across every single page on the EN part

2 **Space Invaders behavior & difficulty tuning**

the game does not start if i press the arrows on keyboard or screen


 3 **hobbies-games.html: ensure vertical scrollbar progress is present**

   * The page currently has no visible scrollbar.

4 standardize ai chat behavior across the site and all en pages to behave the same way it does on the index.html page, unless in another language page, do not worry about that right now





11. [ ] **Use the new standard AI chat everywhere; remove legacy version**

    * 404 and games pages currently use an outdated chat implementation.
    * Make them use the same widget layout/markup/behavior as overview/about.
    * Delete/replace any instances of the older 404/games-style widget.

12. [ ] **404 page structure should match rest of site**

    * Use the same header, layout, footer, and AI chat as other main pages.
    * Overall: 404 should feel like part of the same system, not a separate design.

13. [ ] **Regular header on the page with the custom header snippet**

    * Replace that custom header block (the one you pasted with logo + theme toggle) with the standardized site header component so it matches other pages.

14. [ ] **games.html: add a Contact button by your name at the bottom**

    * In the bottom section containing your name, add a `Contact` button consistent with the rest of the site styling and behavior.

15. [ ] **Contact.html: add outbound arrow for LinkedIn and GitHub under “Connect”**

    * Add the same outbound-arrow icon used elsewhere to show they’re external redirects.

16. [ ] **Dark mode: tiny arrow SVG should be chocolate brown**

    * That small arrow SVG

      ```html
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ...>
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
      ```

      should use the site’s chocolate brown color in dark mode (via class or stroke color).

17. [ ] **Cooking hobby logo: change to chef-hat style icon**

    * Redesign that logo to visually represent cooking (e.g., chef hat) in the same emoji/line-icon style as other sections.

18. [ ] **Car hobby icon: convert the given SVG into a BMW-style logo**

    * Replace the current car/transport icon SVG with a BMW-themed logo, matching the visual language of your other icons.

19. [ ] **Gym/fitness icon: convert current SVG into a dumbbell**

    * Replace that SVG (currently some abstract shape) with a dumbbell icon in the same style as the others.

20. [ ] **Notes icon: make path look like a sticky note**

    * Modify this path

      ```html
      <path ... d="M11 5H6a2 2 0 ... 8.586-8.586z"></path>
      ```

      so the resulting icon reads visually as a sticky note (folded corner, etc.).

21. [ ] **Chat widget bottom bar (dark mode) hover contrast fix**

    * In dark mode, when you hover the chat controls (💡, input, send button area), the surrounding area becomes beige and low-contrast.
    * Change the surrounding/underlay to chocolate brown so everything remains readable and aligned with the palette.

22. [ ] **AI chat: ensure vertical scrollbar in messages area always works**

    * On some pages, the chat’s message area scrollbar is missing or not interactive.
    * Make sure the messages container consistently shows scroll when content overflows on all pages.

23. [ ] **AI chat suggestions bar (#chat-chips): always scrollable on desktop and mobile**

    * For this element:

      ```html
      <div id="chat-chips" class="... overflow-x-auto whitespace-nowrap ...">
      ```
    * Ensure the horizontal scrollbar (or touch-scroll) is always available and responsive on both desktop and mobile.

24. [ ] **Suggestions toggle button (💡) must show/hide suggestions reliably**

    * Button:

      ```html
      <button type="button" id="suggestions-btn" ... aria-pressed="false">💡</button>
      ```
    * Clicking it should always toggle the visibility of `#chat-chips`, and keep `aria-pressed` in sync across all pages.

25. [ ] **Suggestions close button (×) must always hide suggestions**

    * Button:

      ```html
      <button class="chip-close-btn" ...>×</button>
      ```
    * Clicking it should:

      * Hide `#chat-chips`.
      * Update the state so the 💡 toggle knows they’re hidden.
      * Work consistently across all pages.

26. [ ] **Suggestion chips hover style: keep text legible in light mode**

    * For buttons like:

      ```html
      <button class="chip-btn ... hover:bg-[#212842] hover:text-white ...">Do you work remotely?</button>
      ```
    * Currently, hover uses full indigo and may make text hard to read / blend.
    * Adjust hover styles so there is enough contrast and the text never “disappears”.

27. [ ] **Global color-system consistency**

    * Use only:

      * the chosen chocolate brown
      * the chosen beige
      * the chosen indigo
      * the chosen grey text/subscript color
      * plus white/black where appropriate
    * Remove slight variations (off-by-a-bit hex values) so the palette is clean and consistent site-wide.

28. [ ] **Sarcastic hobbies-games intro: punch up the humor**

    * Rewrite this line to be even more funny/sarcastic, keeping the same attitude:

      > "Oh wow, how incredibly thoughtful of people to want to discover my hobbies through interactive games instead of, you know, just reading about them like normal humans. Because nothing says 'get to know me' like frantically mashing buttons to avoid virtual death! What a brilliant innovation! 🎮💀✨"

29. [ ] **Mobile contact form: stop Formspree redirect and avoid network error**

    * On mobile, submitting the contact form causes a network error and you don’t get the post-submit “game” experience.
    * Prevent the default Formspree redirect on mobile (and ideally everywhere) and handle submission via JS so the behavior matches desktop and the game triggers correctly.

30. [ ] **games.html: bottom section with your name should match global layout AND include Contact**

    * Combine:

      * Ensure layout at the bottom matches your global design patterns.
      * Include a Contact button next to your name following your standard button style.

---

If you want, next step I can take this list and for each item write:

* What code to touch (file/selector/function)
* How to test it (exact interaction / viewport / mode)
* What “success” looks like vs what you should report back if it’s still off.

