# Design QA — responsive article layout

## Visual truth

- Source: the supplied intermediate-width screenshot of `https://thinking.haus/the-wrong-right-move.html`.
- Source viewport evidence: 2098 × 1938 device pixels, normalized to a 1007 × 936 content comparison.
- Implementation evidence: the Write Placid demo at 1007 × 936 CSS pixels with the shared article-layout stylesheet active.
- Comparison: `artifacts/design-qa/comparison-intermediate.png`.

## State and scope

- Dark article page with the first large image aligned near the top of the viewport.
- Compared article rail, prose measure, 112.5% image bleed, right viewport margin, and footer alignment.
- Typography, color, content, header behavior, and image treatment were intentionally left unchanged.

## Responsive verification

- Checked widths: 375, 767, 768, 900, 1024, 1199, 1200, 1440, and 1920 CSS pixels.
- Mobile remains a full-width article column inside 24px page margins.
- Intermediate widths open the brand rail smoothly while allowing the article to use the available right track.
- The 112.5% image bleed retains at least a 24px right viewport margin.
- The article footer matches the prose measure.
- No horizontal overflow was observed at any checked width.
- No browser console errors were observed.

## Findings

- No actionable P0, P1, or P2 visual issues remain.
- The wider intermediate composition is the intended correction; the source and implementation crops otherwise preserve the same visual system.

## Primary interactions

- Responsive viewport transitions and ordinary article scrolling were verified.
- No interactive controls changed in this implementation.

Final result: passed
