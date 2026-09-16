/**
 * Draw text-only links in Markdown and MDX as the site's scramble link, the way
 * the MDX `a` component did: `<a class="text-link">` around a label and an empty
 * overlay the scramble script fills. Links with formatted labels stay plain.
 */
export const contentLinks = {
  name: "content-links",
  element: {
    filter: ["a"],
    visit(node, ctx) {
      const children = node.children || [];
      if (children.length !== 1 || children[0].type !== "text") return;
      const className = ["text-link", ...[].concat(node.properties?.className || [])];
      ctx.replaceNode(node, {
        type: "element",
        tagName: "a",
        properties: { ...node.properties, className },
        children: [{
          type: "element",
          tagName: "span",
          properties: { className: ["link-label"] },
          children: [
            { type: "element", tagName: "span", properties: {}, children: [children[0]] },
            { type: "element", tagName: "span", properties: { className: ["link-scramble"], ariaHidden: "true" }, children: [] },
          ],
        }],
      });
    },
  },
};
