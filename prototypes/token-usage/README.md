# Token usage reference study

One standalone HTML prototype matching the spare composition of
[Ephraim Duncan's token usage page](https://ephraimduncan.com/token-usage).
The rejected three studies have been removed.

Serve this directory on localhost:3110 and open index.html. It uses fictional
daily costs and example model labels, not Fischer's usage. The total's title and the accessible heading
identify the sample data without adding visible copy to the reference layout.

Only the site's curved back arrow and the total appear at rest. Exploring the chart reveals a
vertical guide, date, and daily costs. One-pixel stacked marks have ten-pixel
gaps. The full sample history starts centered and scrolls horizontally at every width.
Trackpad left/right gestures, mouse dragging, mobile swiping in empty space, and Shift-wheel
reveal dates outside the viewport. Vertical wheel input does not move the chart. Within the chart band, horizontal pointer position selects the date. Moving above or below that band hides the guide and details. On mobile, gestures starting over the bars inspect dates without scrolling; gestures starting in empty space retain native horizontal scrolling.

Sound uses millisecond noise transients, not musical tones. The browser requires
a click, tap, or key press to unlock audio. Press M while the chart is focused
to mute or unmute. Left/right arrow keys, Home, and End select dates across the entire history; Escape clears the
selection. Reduced motion removes the guide fade and spring movement.

The back arrow returns to the local website preview on port 3107. This study
stays outside public/ and does not add a production route or usage integration.

The hover rows resolve model families to creator icons through `provider-icons.js`.
All 322 canonical SVGs from `@lobehub/icons-static-svg@1.95.0` are stored in
[icons/](icons/README.md), with their MIT license. CSS masks keep icons transparent
and soft white. Only the requested SVGs load; there is no runtime CDN dependency.
GLM maps to Z.ai, Muse Spark and Llama to Meta, Kimi to Moonshot, MiMo to Xiaomi,
and Hunyuan/Hy models to Hunyuan. OpenCode and other gateways do not determine
the creator icon. Unknown model families get a neutral mark until their author
is identified. Raw model IDs stay intact; display labels remain separate.

Typography follows the reference's computed system sans-serif sizing: 12px total,
14px daily rows, and 13px date. The background is Fischer blue, #3565c5. Text and logos use soft white,
with lighter gray-blue dates, bars, and guide.
The back control uses the contact page's SVG path at 14px, without a visible label.
Its accessible name and 44px hit target remain intact.

Bars use the reference's 300px normalization, reduced for short viewports, against the largest daily
cost, 1px strokes, and 2px gaps between model segments. The full stack is
vertically centered. The selection guide is 380px tall on desktop, shortened to fit short viewports, and 2px wide and uses #cbd5e8,
with a damped spring matching the reference's stiffness and damping.

This page uses its own transparent blue portrait favicon, derived from the existing
site SVG. The shared website favicons are unchanged.
