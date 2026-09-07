---
name: www-design
description: Explore and build expressive www pages with content-specific art direction, typography, layout, and interaction. Also refine existing pages without flattening their character.
---

# Give the page a point of view

Read [the site brief](../../site.md), the target page, and the relevant shared
CSS/components. Start by identifying what the reader came to understand or do.
That determines the composition. A new product does not automatically need the
same figure as the last product.

For a focused change, preserve the surrounding design. When asked to get
creative or build a new page, start with the subject and the experience it could
become. The 540px letter and soft monochrome are homepage decisions, not a ceiling.

Name the page's central idea in a sentence. Then explore genuinely different
ways to express it through composition, scale, material, color, and behavior.
For an open brief, include a direction you would be disappointed not to try.
Do not produce several nearly identical layouts with different accent colors.
Do not choose the safest option before making the alternatives visible.

Prototype enough of the promising directions to expose their strengths and
weaknesses. Use the requested medium: Paper when requested and available,
otherwise working HTML. Show the most consequential part of the experience,
including a representative passage or interaction, not only a hero screenshot.
Make a recommendation with reasons. If choosing between directions requires
Fischer's taste, present concrete work for that choice while continuing any
independent work. Do not impose a review pause on an already chosen direction.

A page may become an oversized editorial spread, a visual notebook, a small
interactive object, or something neither of us has named yet. These are examples,
not a menu. Let the content suggest the form. A product can be understood through
a documented workflow, a real capture, or an honestly labeled illustration.
An essay can use rhythm and typography to change how its argument unfolds.

Carry the chosen idea through the whole page. Develop its opening, body, ending,
navigation, and phone composition. A striking first screen followed by default
paragraphs is unfinished art direction. Keep useful controls legible, make the
way home clear, and build alternatives for keyboard and reduced-motion use.

When matching a reference, inspect the requested state in the browser. Record
only the relevant geometry, timing, and behavior, then compare the implementation
in the same state. For hover, check entry, midway, settled, and pointer exit.
The initial and final screenshots alone can miss a collision during scrambling.
Use the existing `ScrambleLink`, route template, and social hub when they suit
the direction. A distinct page may need a distinct navigation or motion treatment.

Keep implementation scoped and simple without simplifying away the idea.
Reuse code when it serves the design. Add page-scoped styles and components when
the design needs them; do not contort a shared component or recolor other pages
to avoid writing a new one. New dependencies need a concrete benefit.

After the first working version, examine where the concept weakens. Revise the
actual composition, copy, and interaction rather than applying cosmetic polish
to an unresolved idea. Stop when the page carries its direction convincingly
across the relevant states, not merely when it compiles. Do not keep inventing
changes once the intent is fulfilled.

Inspect the result around 390px and a desktop width, plus any breakpoint affected
by the change. Check reading order, line breaks, focus, reduced motion, and
whether fixed UI covers the end of the content. Verify new links and actual
interactions. If browser inspection is unavailable, name that limit instead of
claiming the page is visually verified.
