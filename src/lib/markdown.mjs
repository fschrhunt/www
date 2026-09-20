/**
 * Draw text-only links in Markdown and MDX with the site's CSS-animated underline
 * and arrow. Links with formatted labels stay plain.
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
          children,
        }],
      });
    },
  },
};
