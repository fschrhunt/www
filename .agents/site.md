# The site we are making

The homepage is a personal letter with things to explore. Readers should meet
Fischer, understand what he is making, and find something worth reading. Product
pages explain; notes should have a thought of their own. Individual pages can
have their own art direction. The homepage is not a template for everything.

## Voice

Direct, personal, occasionally dry. Humor comes from a real detail, a small
contradiction, or an honest admission. Fischer spent time getting a favicon and
a hover arrow right. That is better material than a generic joke about coffee.
Let the joke end without explaining it. Some paragraphs should just say things.

Notes currently use lowercase conversational prose. Names and product spellings
still matter. Product pages prioritize what the software does. Contact and
error messages prioritize helping someone finish. Those surfaces do not need
identical levels of informality.

The current welcome note and README are tone samples, not a joke library.
Future notes need new material. Do not keep making the favicon do all the work.
Do not invent memories, opinions, users, results, or release dates for Fischer.
Use the conversation, repository, and verified project material as evidence.

## Creative range

Fischer explicitly wants room for ambitious, unexpected page design. Do not
shrink an interesting idea to the existing letter layout for convenience. A page
can use a different palette, large typography, a full-width composition, custom
illustration, a playful interaction, or a different reading rhythm. Choose a
coherent direction for the subject and develop it far enough to judge it.

[Shed's Taste page](https://shedsgns.me/taste) is a useful example of this freedom:
its oversized headline, pink-and-red palette, and pixel graphics depart from
her quiet homepage. Treat that as permission to find a page's own expression,
not a new pink template to repeat.

The relationship between our pages can come from Fischer's voice, care with
details, and a clear way home. It need not come from identical columns, fonts,
or a floating hub on every route. Keep the accepted homepage intact unless the
task includes it; explore freely within the page being designed.

## Current homepage character

Soft monochrome, local Inter, small readable type, a consistent reading edge,
and breathing room between ideas. The current letter is 540px wide, with
14px body text and 22–25px line heights. Read `src/app/globals.css` for actual
values; these are a starting point, not a prohibition on a better composition.

Keep the supplied portrait and its hover tilt unless asked to change them.
The small serif pronunciation beside Fischer's name is intentional. The footer
credit is quiet, with the turning mark opposite it. The floating hub belongs to
the site, while Contact has its own conversation layout.

Current interaction decisions:

- A normal arrow cursor throughout.
- The current pages share one entrance treatment with a short stagger. A new
  creative direction can include its own purposeful motion or interaction.
  Design its reading and reduced-motion states as carefully as its moving state.
- Text links stay still. The underline draws and the separate 11px arrow
  appears. Scramble symbols must fit inside the original label width.
- Reduced motion keeps all content and controls usable.

Shed is the primary reference for the existing link interaction. Benji is a
reference for personal character and small details. References inform decisions;
they do not replace our own art direction. Inspect the relevant live behavior when asked to
match it; do not reconstruct it from memory. Preserve the visible credit.
Borrow visual mechanisms without importing someone else's biography or prose.

## Truth and implementation

Read `README` for routes and run commands. Read existing components before
making a parallel version of them. Product rows open local pages. Public source
links belong on those pages; Diffuse's source remains private. Repository
creation dates are not launch dates. Reverify product claims if they may have
changed. Illustrations must be distinguishable from real product captures.

The contact page prepares an email draft. It does not send anything itself.
Do not imply otherwise. Safari favicon behavior still needs native verification;
a Chromium preference check does not establish Safari support.
