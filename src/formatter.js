const { maxMessageLength } = require("./config");
const { Marked } = require("marked");

/**
 * Convert Markdown to Telegram-compatible HTML.
 * Uses marked with a custom renderer mapping to Telegram's supported HTML subset.
 */
function markdownToHtml(text) {
  if (!text) return text;

  const renderer = {
    heading({ tokens, depth }) {
      const content = this.parser.parseInline(tokens);
      return `<b>${content}</b>\n`;
    },
    paragraph({ tokens }) {
      return this.parser.parseInline(tokens) + "\n\n";
    },
    strong({ tokens }) {
      return `<b>${this.parser.parseInline(tokens)}</b>`;
    },
    em({ tokens }) {
      return `<i>${this.parser.parseInline(tokens)}</i>`;
    },
    del({ tokens }) {
      return `<s>${this.parser.parseInline(tokens)}</s>`;
    },
    codespan({ text }) {
      return `<code>${text}</code>`;
    },
    code({ text, lang }) {
      if (lang) {
        return `<pre><code class="language-${lang}">${text}</code></pre>\n`;
      }
      return `<pre>${text}</pre>\n`;
    },
    blockquote({ tokens }) {
      const body = this.parser.parse(tokens).trim();
      return `<blockquote>${body}</blockquote>\n`;
    },
    link({ href, tokens }) {
      return `<a href="${href}">${this.parser.parseInline(tokens)}</a>`;
    },
    list({ items }) {
      return items.map((item) => this.listitem(item)).join("") + "\n";
    },
    listitem({ tokens }) {
      let content = "";
      for (const token of tokens) {
        if (token.type === "text" && token.tokens) {
          content += this.parser.parseInline(token.tokens);
        } else if (token.type === "list") {
          content += "\n" + this.list(token);
        } else if (token.tokens) {
          content += this.parser.parseInline(token.tokens);
        } else {
          content += token.text || "";
        }
      }
      return `• ${content.trim()}\n`;
    },
    table({ header, rows }) {
      // Collect all cells: header + body rows
      const allRows = [];

      // Parse header row
      const headerCells = header.map((cell) =>
        this.parser.parseInline(cell.tokens).trim()
      );
      allRows.push(headerCells);

      // Parse body rows
      for (const row of rows) {
        allRows.push(
          row.map((cell) => this.parser.parseInline(cell.tokens).trim())
        );
      }

      // Calculate column widths
      const colCount = headerCells.length;
      const widths = Array(colCount).fill(0);
      for (const row of allRows) {
        for (let i = 0; i < row.length; i++) {
          // Strip HTML tags for width calculation
          const plain = row[i].replace(/<[^>]+>/g, "");
          widths[i] = Math.max(widths[i], plain.length);
        }
      }

      // Render rows as fixed-width text
      const pad = (str, w) => {
        const plain = str.replace(/<[^>]+>/g, "");
        return str + " ".repeat(Math.max(0, w - plain.length));
      };
      const sep = widths.map((w) => "-".repeat(w)).join("-+-");

      const lines = [];
      // Header
      lines.push(headerCells.map((c, i) => pad(c, widths[i])).join(" | "));
      lines.push(sep);
      // Body
      for (const row of allRows.slice(1)) {
        lines.push(row.map((c, i) => pad(c, widths[i])).join(" | "));
      }

      return `<pre>${lines.join("\n")}</pre>\n`;
    },
    hr() {
      return "---\n";
    },
    image({ href, text }) {
      return text ? `[${text}]` : "";
    },
    br() {
      return "\n";
    },
    html({ text }) {
      return text;
    },
    text({ text }) {
      return text;
    },
    space() {
      return "";
    },
  };

  const marked = new Marked({ renderer, breaks: false, gfm: true });
  return marked.parse(text).trim();
}

/**
 * Split text into chunks that fit Telegram's message size limit.
 * Tries to break at newlines for readability.
 */
function splitMessage(text) {
  if (text.length <= maxMessageLength) return [text];

  const parts = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxMessageLength) {
      parts.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", maxMessageLength);
    if (splitAt < maxMessageLength * 0.5) splitAt = maxMessageLength;
    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n/, "");
  }

  return parts;
}

/** Truncate text from the front so it fits in one Telegram message. */
function truncate(text) {
  if (text.length <= maxMessageLength) return text;
  return "..." + text.slice(-(maxMessageLength - 3));
}

/** Format tool names into a short status line. */
function toolLine(tools) {
  return tools.length ? `[${tools.join(", ")}]` : "";
}

module.exports = { splitMessage, truncate, toolLine, markdownToHtml };
