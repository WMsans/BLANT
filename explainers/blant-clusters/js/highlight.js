// Line-at-a-time highlighter for this bash script and the awk programs embedded in it.
// Single quotes switch between bash and awk across many lines, so they are coloured as
// punctuation rather than treated as string delimiters; everything else is per line.
(function () {
  'use strict';
  const KW = new Set(('if then else elif fi for while do done case esac in function return break continue next exit ' +
    'delete BEGIN END local source shift wait print printf getline').split(' '));
  const CMD = new Set(('echo awk hawk sort cut grep sed mktemp dirname basename cp cat eval trap set ' +
    'die warn usage not newlines parse').split(' '));
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const span = (c, s) => `<span class="t-${c}">${esc(s)}</span>`;

  function highlight(line) {
    let out = '', i = 0;
    const n = line.length;
    while (i < n) {
      const ch = line[i], rest = line.slice(i);
      let m;
      // comments: '#' at line start or after whitespace / ; { (not $# and not inside a word)
      if (ch === '#' && (i === 0 || /[\s;{(]/.test(line[i - 1]))) { out += span('cm', rest); break; }
      if (ch === '"') { // double-quoted string, with $vars inside
        let j = i + 1;
        while (j < n && line[j] !== '"') j += line[j] === '\\' ? 2 : 1;
        const body = line.slice(i, Math.min(j + 1, n));
        out += '<span class="t-str">' + esc(body).replace(/\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9#@*?$])/g, '<span class="t-var">$&</span>') + '</span>';
        i = j + 1; continue;
      }
      if (ch === "'") {
        if ((m = /^'\$[A-Za-z_][A-Za-z0-9_]*'/.exec(rest))) { out += span('ivar', m[0]); i += m[0].length; continue; }
        out += span('q', ch); i++; continue;
      }
      if ((m = /^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9#@*?$])/.exec(rest))) { out += span('var', m[0]); i += m[0].length; continue; }
      if ((m = /^`/.exec(rest))) { out += span('q', ch); i++; continue; }
      if ((m = /^[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?\b/.exec(rest)) && !/[A-Za-z_]/.test(line[i - 1] || '')) { out += span('num', m[0]); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest))) {
        const w = m[0], after = line.slice(i + w.length);
        const prev = line[i - 1] || '';
        let c = 'id';
        if (prev === '-' && /[\s]/.test(line[i - 2] || ' ')) c = 'flag';
        else if (KW.has(w)) c = 'kw';
        else if (/^\s*\(/.test(after) || CMD.has(w)) c = 'fn';
        else if (/^[A-Z][A-Z0-9_]+$/.test(w) && w.length > 1) c = 'const';
        else if (/^\s*\[/.test(after)) c = 'arr';
        out += span(c, w); i += w.length; continue;
      }
      if ((m = /^(\+\+|--|\+=|-=|\*=|\/=|==|!=|<=|>=|&&|\|\||>>|[=<>!+\-*\/%|&^~?:])/.exec(rest))) {
        if (m[0] === '-' && /^-[A-Za-z]/.test(rest) && /\s/.test(line[i - 1] || ' ')) { out += span('flag', '-'); i++; continue; }
        out += span('op', m[0]); i += m[0].length; continue;
      }
      if (/[()[\]{};,]/.test(ch)) { out += span('p', ch); i++; continue; }
      out += esc(ch); i++;
    }
    return out;
  }
  window.HL = { highlight };
})();
