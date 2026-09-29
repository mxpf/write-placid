# Design guidance

Write Placid uses [Thinkinghaus palette v0.5](https://github.com/mxpf/thinkinghaus-palette/tree/e37b642b6903788cc3ff7cbb522c4644c16fe6fd) as its governing color reference. The exact release is pinned locally as [`thinkinghaus-v0.5.css`](../packages/core/theme/thinkinghaus-v0.5.css) and [`thinkinghaus-v0.5.tokens.json`](../packages/core/theme/thinkinghaus-v0.5.tokens.json); update those files only as part of an explicit palette-version adoption.

The warmed foundation aliases are ivory / neutral 0 `#F4EDDF`, body / neutral 400 `#AFADA6`, taupe / neutral 500 `#9C9281`, and charcoal / neutral 1000 `#1C1811`. Neutral 150 is `#D9D2C6`, neutral 200 is `#D0CBBF`, and neutral 300 is `#BFBCB3`.

Application CSS should consume semantic roles rather than choosing scale colors directly:

- Surfaces use `--th-bg`, `--th-surface`, and `--th-surface-raised`; dividers and controls use the corresponding border roles.
- Text uses `--th-text`, `--th-text-body`, and `--th-text-muted`. `--th-text-faint` is decorative only and must not carry essential copy.
- Links use patina: `#75AEA2` in dark mode and `#1A6A5E` in light mode.
- Focus and warning use ochre: `#B79142` in dark mode and `#785800` in light mode.
- Success uses moss: `#97AA74` in dark mode and `#506624` in light mode.
- Error uses clay: `#D2836C` in dark mode and `#9B4127` in light mode.
- Text accents use the 400 step in dark mode and 600 in light mode. Dedicated solid controls use their own fill/foreground pairing; text accents are not arbitrary button fills.
- Selection uses the palette selection roles. Disabled controls preserve their existing opacity behavior over a valid base role.

The public site and Studio consume the pinned core tokens directly. Trackinghaus and the Drafts authorization document repeat the small set of needed literal values because they ship as independent applications; automated tests keep those values aligned with the pinned reference. Product layout, typography, and behavior remain installation-owned.

Useful visual references are the [palette guide](https://keeping.haus/thinkinghaus-palette/) and [interface guide](https://keeping.haus/thinkinghaus-ui/).
