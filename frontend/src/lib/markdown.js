const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

/** Renders the small Markdown subset the reports use. All input is escaped before any tag is added. */
export function renderMarkdown(src) {
  const out = [];
  let list = null;
  let inCode = false;
  let code = [];
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const open = (tag) => {
    if (list !== tag) {
      close();
      out.push(`<${tag}>`);
      list = tag;
    }
  };
  const flushCode = () => {
    out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
    code = [];
  };

  for (const line of src.split('\n')) {
    let m;
    if (line.trim().startsWith('```')) {
      if (inCode) flushCode();
      else close();
      inCode = !inCode;
    } else if (inCode) code.push(line);
    else if ((m = line.match(/^#{1,6}\s+(.*)/))) {
      close();
      out.push(`<h3>${inline(m[1])}</h3>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
      open('ul');
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)/))) {
      open('ol');
      out.push(`<li value="${m[1]}">${inline(m[2])}</li>`);
    } else if (!line.trim()) close();
    else {
      close();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inCode) flushCode();
  close();
  return out.join('');
}
