/**
 * sophmark.js
 * A fast, full-featured Markdown parser and compiler.
 * @version 1.1.0
 * @author arcosoph
 *
 * UMD build — works with:
 *   - <script src="sophmark.js">  (Browser global: window.sophmark)
 *   - const sophmark = require('sophmark')  (CommonJS / Node.js)
 *   - import sophmark from './sophmark.js'  (ES Module bundlers)
 */
(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    // CommonJS (Node.js)
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD (RequireJS)
    define('sophmark', factory);
  } else {
    // Browser global
    global.sophmark = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {

/**
 * sophmark.js
 * A fast, full-featured Markdown parser and compiler.
 * @version 1.0.0
 * @author arcosoph
 */

// ─────────────────────────────────────────────
//  DEFAULT CONFIGURATION
// ─────────────────────────────────────────────

function createDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null,
  };
}

let globalConfig = createDefaults();

function applyConfig(cfg) {
  globalConfig = cfg;
}

// ─────────────────────────────────────────────
//  REGEX HELPERS
// ─────────────────────────────────────────────

const NOOP_EXEC = { exec: () => null };

function buildRegex(source, flags = "") {
  const src = typeof source === "string" ? source : source.source;
  const builder = {
    replace(pattern, replacement) {
      const rep =
        typeof replacement === "string" ? replacement : replacement.source;
      return buildRegex(src.replace(pattern, rep.replace(/\((?!\?)/g, "(?:")), flags);
    },
    getRegex() {
      return new RegExp(src, flags);
    },
  };
  return builder;
}

// ─────────────────────────────────────────────
//  SHARED PATTERNS
// ─────────────────────────────────────────────

const pat = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode:
    /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode:
    /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull) =>
    new RegExp(`^( {0,3}${bull})((?:[\t ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: (indent) =>
    new RegExp(
      `^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`
    ),
  hrRegex: (indent) =>
    new RegExp(
      `^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`
    ),
  fencesBeginRegex: (indent) =>
    new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) =>
    new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) =>
    new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i"),
};

// ─────────────────────────────────────────────
//  BLOCK-LEVEL GRAMMAR
// ─────────────────────────────────────────────

const _newline     = /^(?:[ \t]*(?:\n|$))+/;
const _indentCode  = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const _fences      = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
const _hr          = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
const _heading     = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
const _bullet      = /(?:[*+-]|\d{1,9}[.)])/;
const _lheadingRaw = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;

const _lheading = buildRegex(_lheadingRaw)
  .replace(/bull/g, _bullet)
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
  .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
  .replace(/blockquote/g, / {0,3}>/)
  .replace(/heading/g, / {0,3}#{1,6}/)
  .replace(/html/g, / {0,3}<[^\n>]+>\n/)
  .replace(/\|table/g, "")
  .getRegex();

const _lheadingGfm = buildRegex(_lheadingRaw)
  .replace(/bull/g, _bullet)
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
  .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
  .replace(/blockquote/g, / {0,3}>/)
  .replace(/heading/g, / {0,3}#{1,6}/)
  .replace(/html/g, / {0,3}<[^\n>]+>\n/)
  .replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/)
  .getRegex();

const _paragraph   = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
const _blockText   = /^[^\n]+/;
const _labelPart   = /(?!\s*\])(?:\\.|[^\[\]\\])+/;

const _def = buildRegex(
  /^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/
)
  .replace("label", _labelPart)
  .replace(
    "title",
    /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/
  )
  .getRegex();

const _listItem = buildRegex(
  /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/
)
  .replace(/bull/g, _bullet)
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
  .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
  .replace(/blockquote/g, / {0,3}>/)
  .replace(/heading/g, / {0,3}#{1,6}/)
  .replace(/html/g, / {0,3}<[^\n>]+>\n/)
  .replace(/\|table/g, "")
  .getRegex();

const _listBullet = buildRegex(
  /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/
)
  .replace(/bull/g, _bullet)
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
  .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
  .replace(/blockquote/g, / {0,3}>/)
  .replace(/heading/g, / {0,3}#{1,6}/)
  .replace(/html/g, / {0,3}<[^\n>]+>\n/)
  .replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/)
  .getRegex();

const _listRule = buildRegex(/^(?!bull)((?:[	 ][^\\n]*)?(?:\\n|$))/)
  .replace(/bull/g, _bullet)
  .getRegex();

const _blockList = buildRegex(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/)
  .replace(/bull/g, _bullet)
  .getRegex();

const HTML_TAGS =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
const _htmlComment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;

const _blockHtml = buildRegex(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$))",
  "i"
)
  .replace("comment", _htmlComment)
  .replace("tag", HTML_TAGS)
  .replace(
    "attribute",
    / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/
  )
  .getRegex();

const _blockParagraph = buildRegex(_paragraph)
  .replace("hr", _hr)
  .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
  .replace("|lheading", "")
  .replace("|table", "")
  .replace("blockquote", " {0,3}>")
  .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
  .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
  .replace(
    "html",
    "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)"
  )
  .replace("tag", HTML_TAGS)
  .getRegex();

const _blockquote = buildRegex(
  /^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/
)
  .replace("paragraph", _blockParagraph)
  .getRegex();

const _tableDelim = buildRegex(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
)
  .replace("hr", _hr)
  .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
  .replace("blockquote", " {0,3}>")
  .replace("code", "(?: {4}| {0,3}\t)[^\\n]")
  .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
  .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
  .replace(
    "html",
    "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)"
  )
  .replace("tag", HTML_TAGS)
  .getRegex();

// Grammar rule sets
const blockGrammar = {
  normal: {
    blockquote: _blockquote,
    code: _indentCode,
    def: _def,
    fences: _fences,
    heading: _heading,
    hr: _hr,
    html: _blockHtml,
    lheading: _lheading,
    list: _blockList,
    newline: _newline,
    paragraph: _blockParagraph,
    table: NOOP_EXEC,
    text: _blockText,
  },
};

const _gfmParagraph = buildRegex(_paragraph)
  .replace("hr", _hr)
  .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
  .replace("|lheading", "")
  .replace("table", _tableDelim)
  .replace("blockquote", " {0,3}>")
  .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
  .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
  .replace(
    "html",
    "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)"
  )
  .replace("tag", HTML_TAGS)
  .getRegex();

blockGrammar.gfm = {
  ...blockGrammar.normal,
  lheading: _lheadingGfm,
  table: _tableDelim,
  paragraph: _gfmParagraph,
};

blockGrammar.pedantic = {
  ...blockGrammar.normal,
  html: buildRegex(
    "^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:\"[^\"]*\"|'[^']*'|\\s[^'\"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))"
  )
    .replace("comment", _htmlComment)
    .replace(
      /tag/g,
      "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b"
    )
    .getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: NOOP_EXEC,
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: buildRegex(_paragraph)
    .replace("hr", _hr)
    .replace("heading", ` *#{1,6} *[^\n]`)
    .replace("lheading", _lheading)
    .replace("|table", "")
    .replace("blockquote", " {0,3}>")
    .replace("|fences", "")
    .replace("|list", "")
    .replace("|html", "")
    .replace("|tag", "")
    .getRegex(),
};

// ─────────────────────────────────────────────
//  INLINE-LEVEL GRAMMAR
// ─────────────────────────────────────────────

const _escape          = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const _inlineCode      = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const _inlineBr        = /^( {2,}|\\)\n(?!\s*$)/;
const _inlineText      = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
const _punct           = /[\p{P}\p{S}]/u;
const _punctSpace      = /[\s\p{P}\p{S}]/u;
const _notPunctSpace   = /[^\s\p{P}\p{S}]/u;
const _tildePunct      = /(?!~)[\p{P}\p{S}]/u;
const _tildePunctSpace = /(?!~)[\s\p{P}\p{S}]/u;
const _notTilde        = /(?:[^\s\p{P}\p{S}]|~)/u;
const _blockSkip       = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
const _punctZeroWidth  = buildRegex(/^((?![*_])punctSpace)/, "u")
  .replace(/punctSpace/g, _punctSpace)
  .getRegex();

const _emDelimRaw =
  "^(?:\\*+(?:((?!\\*)punct)|[^\\s*]))|^_+(?:((?!_)punct)|([^\\s_]))";
const _emStrongLDelim = buildRegex(_emDelimRaw, "u")
  .replace(/punct/g, _punct)
  .getRegex();
const _emStrongLDelimTilde = buildRegex(_emDelimRaw, "u")
  .replace(/punct/g, _tildePunct)
  .getRegex();

const _rDelimAstRaw =
  "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
const _emStrongRDelimAst = buildRegex(_rDelimAstRaw, "gu")
  .replace(/notPunctSpace/g, _notPunctSpace)
  .replace(/punctSpace/g, _punctSpace)
  .replace(/punct/g, _punct)
  .getRegex();
const _emStrongRDelimAstTilde = buildRegex(_rDelimAstRaw, "gu")
  .replace(/notPunctSpace/g, _notTilde)
  .replace(/punctSpace/g, _tildePunctSpace)
  .replace(/punct/g, _tildePunct)
  .getRegex();

const _rDelimUndRaw =
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)";
const _emStrongRDelimUnd = buildRegex(_rDelimUndRaw, "gu")
  .replace(/notPunctSpace/g, _notPunctSpace)
  .replace(/punctSpace/g, _punctSpace)
  .replace(/punct/g, _punct)
  .getRegex();

const _anyPunct = buildRegex(/\\(punct)/, "gu").replace(/punct/g, _punct).getRegex();
const _autolink = buildRegex(
  /^<(scheme:[^\s\x00-\x1f<>]*|email)>/
)
  .replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/)
  .replace(
    "email",
    /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/
  )
  .getRegex();

const _htmlComment2 = buildRegex(_htmlComment)
  .replace("(?:-->|$)", "-->")
  .getRegex();
const _inlineTag = buildRegex(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
)
  .replace("comment", _htmlComment2)
  .replace(
    "attribute",
    /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/
  )
  .getRegex();

const _labelInline =
  /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
const _inlineLink = buildRegex(
  /^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/
)
  .replace("label", _labelInline)
  .replace(
    "href",
    /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/
  )
  .replace(
    "title",
    /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/
  )
  .getRegex();

const _inlineReflink = buildRegex(/^!?\[(label)\]\[(ref)\]/)
  .replace("label", _labelInline)
  .replace("ref", _labelPart)
  .getRegex();

const _inlineNolink = buildRegex(/^!?\[(ref)\](?:\[\])?/)
  .replace("ref", _labelPart)
  .getRegex();

const _inlineReflinkSearch = buildRegex("reflink|nolink(?!\\()", "g")
  .replace("reflink", _inlineReflink)
  .replace("nolink", _inlineNolink)
  .getRegex();

const inlineGrammar = {
  normal: {
    _backpedal: NOOP_EXEC,
    anyPunctuation: _anyPunct,
    autolink: _autolink,
    blockSkip: _blockSkip,
    br: _inlineBr,
    code: _inlineCode,
    del: NOOP_EXEC,
    emStrongLDelim: _emStrongLDelim,
    emStrongRDelimAst: _emStrongRDelimAst,
    emStrongRDelimUnd: _emStrongRDelimUnd,
    escape: _escape,
    link: _inlineLink,
    nolink: _inlineNolink,
    punctuation: _punctZeroWidth,
    reflink: _inlineReflink,
    reflinkSearch: _inlineReflinkSearch,
    tag: _inlineTag,
    text: _inlineText,
    url: NOOP_EXEC,
  },
};

inlineGrammar.pedantic = {
  ...inlineGrammar.normal,
  link: buildRegex(/^!?\[(label)\]\((.*?)\)/)
    .replace("label", _labelInline)
    .getRegex(),
  reflink: buildRegex(/^!?\[(label)\]\s*\[([^\]]*)\]/)
    .replace("label", _labelInline)
    .getRegex(),
};

inlineGrammar.gfm = {
  ...inlineGrammar.normal,
  emStrongRDelimAst: _emStrongRDelimAstTilde,
  emStrongLDelim: _emStrongLDelimTilde,
  url: buildRegex(
    /^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,
    "i"
  )
    .replace(
      "email",
      /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/
    )
    .getRegex(),
  _backpedal:
    /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/,
};

inlineGrammar.breaks = {
  ...inlineGrammar.gfm,
  br: buildRegex(_inlineBr).replace("{2,}", "*").getRegex(),
  text: buildRegex(inlineGrammar.gfm.text)
    .replace("\\b_", "\\b_| {2,}\\n")
    .replace(/\{2,\}/g, "*")
    .getRegex(),
};

// ─────────────────────────────────────────────
//  MATH SUPPORT  (block: $$…$$  inline: $…$)
// ─────────────────────────────────────────────

// Stash math expressions before the Markdown parser touches them,
// then restore them as KaTeX/MathJax-ready <span>/<div> elements.
function mathPreprocess(src) {
  const stash = [];
  const codeStash = [];

  // Step 1: protect fenced code blocks (``` or ~~~) and inline code spans (`...`)
  // so math inside code is never processed.
  src = src.replace(/(^|\n)([ \t]*)(`{3,}|~{3,})([\s\S]*?)(\3)/g, (match) => {
    const idx = codeStash.length;
    codeStash.push(match);
    return `\x01CODE${idx}\x01`;
  });
  src = src.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (match) => {
    const idx = codeStash.length;
    codeStash.push(match);
    return `\x01CODE${idx}\x01`;
  });

  // Step 2: replace math outside code regions
  // Block math  $$…$$  (may span multiple lines)
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const idx = stash.length;
    stash.push({ type: "block", tex: tex.trim() });
    return `\x02MATH${idx}\x03`;
  });
  // Inline math  $…$  (single line, non-empty, not $$)
  src = src.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_, tex) => {
    const idx = stash.length;
    stash.push({ type: "inline", tex: tex.trim() });
    return `\x02MATH${idx}\x03`;
  });

  // Step 3: restore protected code regions
  src = src.replace(/\x01CODE(\d+)\x01/g, (_, i) => codeStash[+i]);

  return { src, stash };
}

function mathPostprocess(html, stash) {
  return html.replace(/\x02MATH(\d+)\x03/g, (_, i) => {
    const { type, tex } = stash[+i];
    const escaped = tex.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (type === "block")
      return `<div class="math math-block">\\[${escaped}\\]</div>`;
    return `<span class="math math-inline">\\(${escaped}\\)</span>`;
  });
}

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(str, encode = false) {
  if (encode) {
    if (pat.escapeTest.test(str))
      return str.replace(pat.escapeReplace, (c) => HTML_ESCAPE_MAP[c]);
  } else if (pat.escapeTestNoEncode.test(str))
    return str.replace(pat.escapeReplaceNoEncode, (c) => HTML_ESCAPE_MAP[c]);
  return str;
}

function sanitizeHref(href) {
  try {
    href = encodeURI(href).replace(pat.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}

function splitTableCells(line, count) {
  const normalized = line.replace(pat.findPipe, (_, idx, src) => {
    let escaped = false;
    let pos = idx;
    while (--pos >= 0 && src[pos] === "\\") escaped = !escaped;
    return escaped ? "|" : " |";
  });
  const cells = normalized.split(pat.splitPipe);
  if (cells[0].trim() === "") cells.shift();
  if (cells.length > 0 && !cells.at(-1)?.trim()) cells.pop();
  if (count) {
    if (cells.length > count) cells.splice(count);
    else while (cells.length < count) cells.push("");
  }
  return cells.map((c) => c.trim().replace(pat.slashPipe, "|"));
}

function trimEnd(str, char, invert = false) {
  const len = str.length;
  let end = 0;
  while (end < len) {
    const ch = str.charAt(len - end - 1);
    if (ch === char && !invert) end++;
    else if (ch !== char && invert) end++;
    else break;
  }
  return str.slice(0, len - end);
}

function findClosingBracket(str, pair) {
  if (str.indexOf(pair[1]) === -1) return -1;
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") { i++; continue; }
    if (str[i] === pair[0]) depth++;
    else if (str[i] === pair[1]) {
      depth--;
      if (depth < 0) return i;
    }
  }
  return depth > 0 ? -2 : -1;
}

function buildLinkToken(cap, link, raw, lex, rules) {
  const href = link.href;
  const title = link.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  lex.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text,
    tokens: lex.inlineTokens(text),
  };
  lex.state.inLink = false;
  return token;
}

function compensateIndent(raw, text, rules) {
  const m = raw.match(rules.other.indentCodeCompensation);
  if (!m) return text;
  const indent = m[1];
  return text
    .split("\n")
    .map((line) => {
      const space = line.match(rules.other.beginningSpace);
      if (!space) return line;
      const [sp] = space;
      return sp.length >= indent.length ? line.slice(indent.length) : line;
    })
    .join("\n");
}

// ─────────────────────────────────────────────
//  TOKENIZER
// ─────────────────────────────────────────────

class SophTokenizer {
  constructor(options) {
    this.options = options || globalConfig;
  }

  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) return { type: "space", raw: cap[0] };
  }

  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: this.options.pedantic ? text : trimEnd(text, "\n"),
      };
    }
  }

  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      return {
        type: "code",
        raw,
        lang: cap[2]
          ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1")
          : cap[2],
        text: compensateIndent(raw, cap[3] || "", this.rules),
      };
    }
  }

  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const stripped = trimEnd(text, "#");
        if (
          this.options.pedantic ||
          !stripped ||
          this.rules.other.endingSpaceChar.test(stripped)
        )
          text = stripped.trim();
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text),
      };
    }
  }

  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) return { type: "hr", raw: trimEnd(cap[0], "\n") };
  }

  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (!cap) return;
    let lines = trimEnd(cap[0], "\n").split("\n");
    let rawStr = "";
    let textStr = "";
    const tokens = [];
    while (lines.length > 0) {
      let consumeAll = false;
      const chunk = [];
      let i;
      for (i = 0; i < lines.length; i++) {
        if (this.rules.other.blockquoteStart.test(lines[i])) {
          chunk.push(lines[i]);
          consumeAll = true;
        } else if (!consumeAll) chunk.push(lines[i]);
        else break;
      }
      lines = lines.slice(i);
      const chunkRaw = chunk.join("\n");
      const chunkText = chunkRaw
        .replace(this.rules.other.blockquoteSetextReplace, "\n    $1")
        .replace(this.rules.other.blockquoteSetextReplace2, "");
      rawStr = rawStr ? `${rawStr}\n${chunkRaw}` : chunkRaw;
      textStr = textStr ? `${textStr}\n${chunkText}` : chunkText;
      const prevTop = this.lexer.state.top;
      this.lexer.state.top = true;
      this.lexer.blockTokens(chunkText, tokens, true);
      this.lexer.state.top = prevTop;
      if (lines.length === 0) break;
      const last = tokens.at(-1);
      if (last?.type === "code") break;
      if (last?.type === "blockquote") {
        const combined = last.raw + "\n" + lines.join("\n");
        const reparsed = this.blockquote(combined);
        tokens[tokens.length - 1] = reparsed;
        rawStr = rawStr.slice(0, rawStr.length - last.raw.length) + reparsed.raw;
        textStr = textStr.slice(0, textStr.length - last.text.length) + reparsed.text;
        break;
      } else if (last?.type === "list") {
        const combined = last.raw + "\n" + lines.join("\n");
        const reparsed = this.list(combined);
        tokens[tokens.length - 1] = reparsed;
        rawStr = rawStr.slice(0, rawStr.length - last.raw.length) + reparsed.raw;
        textStr = textStr.slice(0, textStr.length - last.raw.length) + reparsed.raw;
        lines = combined.slice(tokens.at(-1).raw.length).split("\n");
        continue;
      }
    }
    return { type: "blockquote", raw: rawStr, tokens, text: textStr };
  }

  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (!cap) return;
    let bull = cap[1].trim();
    const isOrdered = bull.length > 1;
    const list = {
      type: "list",
      raw: "",
      ordered: isOrdered,
      start: isOrdered ? +bull.slice(0, -1) : "",
      loose: false,
      items: [],
    };
    bull = isOrdered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
    if (this.options.pedantic && !isOrdered) bull = "[*+-]";
    const itemRegex = this.rules.other.listItemRegex(bull);
    let prevBlank = false;
    while (src) {
      let endItem = false;
      let rawItem = "";
      let itemBody = "";
      if (!(cap = itemRegex.exec(src)) || this.rules.block.hr.test(src)) break;
      rawItem = cap[0];
      src = src.slice(rawItem.length);
      let firstLine = cap[2]
        .split("\n", 1)[0]
        .replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
      const nextLine = src.split("\n", 1)[0];
      const blankFirst = !firstLine.trim();
      let indent = 0;
      if (this.options.pedantic) {
        indent = 2;
        itemBody = firstLine.trimStart();
      } else if (blankFirst) {
        indent = cap[1].length + 1;
      } else {
        indent = cap[2].search(this.rules.other.nonSpaceChar);
        indent = indent > 4 ? 1 : indent;
        itemBody = firstLine.slice(indent);
        indent += cap[1].length;
      }
      if (blankFirst && this.rules.other.blankLine.test(nextLine)) {
        rawItem += nextLine + "\n";
        src = src.slice(nextLine.length + 1);
        endItem = true;
      }
      if (!endItem) {
        const nextBull = this.rules.other.nextBulletRegex(indent);
        const hrRe = this.rules.other.hrRegex(indent);
        const fenceRe = this.rules.other.fencesBeginRegex(indent);
        const headRe = this.rules.other.headingBeginRegex(indent);
        const htmlRe = this.rules.other.htmlBeginRegex(indent);
        while (src) {
          const rawLine = src.split("\n", 1)[0];
          let line = rawLine;
          if (this.options.pedantic) {
            line = line.replace(this.rules.other.listReplaceNesting, "  ");
          } else {
            line = line.replace(this.rules.other.tabCharGlobal, "    ");
          }
          if (
            fenceRe.test(rawLine) ||
            headRe.test(rawLine) ||
            htmlRe.test(rawLine) ||
            nextBull.test(rawLine) ||
            hrRe.test(rawLine)
          ) break;
          if (line.search(this.rules.other.nonSpaceChar) >= indent || !rawLine.trim())
            itemBody += "\n" + line.slice(indent);
          else {
            if (blankFirst || firstLine.replace(pat.tabCharGlobal, "    ").search(pat.nonSpaceChar) >= 4 ||
                fenceRe.test(firstLine) || headRe.test(firstLine) || hrRe.test(firstLine))
              break;
            itemBody += "\n" + rawLine;
          }
          if (!blankFirst && !rawLine.trim()) prevBlank = true; else prevBlank = false; // track blanks
          rawItem += rawLine + "\n";
          src = src.slice(rawLine.length + 1);
          firstLine = line.slice(indent);
        }
      }
      if (!list.loose && prevBlank) list.loose = true;
      else if (!list.loose && this.rules.other.doubleBlankLine.test(rawItem)) prevBlank = true;
      let task = null;
      let checked;
      if (this.options.gfm) {
        task = this.rules.other.listIsTask.exec(itemBody);
        if (task) {
          checked = task[0] !== "[ ] ";
          itemBody = itemBody.replace(this.rules.other.listReplaceTask, "");
        }
      }
      list.items.push({
        type: "list_item",
        raw: rawItem,
        task: !!task,
        checked,
        loose: false,
        text: itemBody,
        tokens: [],
      });
      list.raw += rawItem;
    }
    const lastItem = list.items.at(-1);
    if (lastItem) {
      lastItem.raw = lastItem.raw.trimEnd();
      lastItem.text = lastItem.text.trimEnd();
    } else return;
    list.raw = list.raw.trimEnd();
    for (let i = 0; i < list.items.length; i++) {
      this.lexer.state.top = false;
      list.items[i].tokens = this.lexer.blockTokens(list.items[i].text, []);
      if (!list.loose) {
        const spaces = list.items[i].tokens.filter((t) => t.type === "space");
        const hasBlank = spaces.length > 0 && spaces.some((t) => this.rules.other.anyLine.test(t.raw));
        list.loose = hasBlank;
      }
    }
    if (list.loose)
      for (const item of list.items) item.loose = true;
    return list;
  }

  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap)
      return {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0],
      };
  }

  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2]
        ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1")
        : "";
      const title = cap[3]
        ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1")
        : cap[3];
      return { type: "def", tag, raw: cap[0], href, title };
    }
  }

  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap || !this.rules.other.tableDelimiter.test(cap[2])) return;
    const headers = splitTableCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim()
      ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n")
      : [];
    const table = { type: "table", raw: cap[0], header: [], align: [], rows: [] };
    if (headers.length !== aligns.length) return;
    for (const a of aligns) {
      if (this.rules.other.tableAlignRight.test(a)) table.align.push("right");
      else if (this.rules.other.tableAlignCenter.test(a)) table.align.push("center");
      else if (this.rules.other.tableAlignLeft.test(a)) table.align.push("left");
      else table.align.push(null);
    }
    for (let i = 0; i < headers.length; i++)
      table.header.push({ text: headers[i], tokens: this.lexer.inline(headers[i]), header: true, align: table.align[i] });
    for (const row of rows)
      table.rows.push(
        splitTableCells(row, table.header.length).map((cell, j) => ({
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: table.align[j],
        }))
      );
    return table;
  }

  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap)
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1]),
      };
  }

  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return { type: "paragraph", raw: cap[0], text, tokens: this.lexer.inline(text) };
    }
  }

  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap)
      return { type: "text", raw: cap[0], text: cap[0], tokens: this.lexer.inline(cap[0]) };
  }

  // ── Inline tokenizers ──────────────────────

  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) return { type: "escape", raw: cap[0], text: cap[1] };
  }

  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (!cap) return;
    if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0]))
      this.lexer.state.inLink = true;
    else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0]))
      this.lexer.state.inLink = false;
    if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0]))
      this.lexer.state.inRawBlock = true;
    else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0]))
      this.lexer.state.inRawBlock = false;
    return {
      type: "html",
      raw: cap[0],
      inLink: this.lexer.state.inLink,
      inRawBlock: this.lexer.state.inRawBlock,
      block: false,
      text: cap[0],
    };
  }

  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (!cap) return;
    let href = cap[2].trim();
    if (!this.options.pedantic && this.rules.other.startAngleBracket.test(href)) {
      if (!this.rules.other.endAngleBracket.test(href)) return;
      const stripped = trimEnd(href.slice(0, -1), "\\");
      if ((href.length - stripped.length) % 2 === 0) return;
    } else {
      const close = findClosingBracket(cap[2], "()");
      if (close === -2) return;
      if (close > -1) {
        const end = (cap[0].indexOf("!") === 0 ? 5 : 4) + cap[1].length + close;
        cap[2] = cap[2].slice(0, close);
        cap[0] = cap[0].slice(0, end).trim();
        cap[3] = "";
      }
    }
    let hrefOut = cap[2];
    let title = "";
    if (this.options.pedantic) {
      const m = this.rules.other.pedanticHrefTitle.exec(hrefOut);
      if (m) { hrefOut = m[1]; title = m[3]; }
    } else {
      title = cap[3] ? cap[3].slice(1, -1) : "";
    }
    hrefOut = hrefOut.trim();
    if (this.rules.other.startAngleBracket.test(hrefOut))
      hrefOut = this.options.pedantic && !this.rules.other.endAngleBracket.test(href)
        ? hrefOut.slice(1)
        : hrefOut.slice(1, -1);
    return buildLinkToken(
      cap,
      {
        href: hrefOut && hrefOut.replace(this.rules.inline.anyPunctuation, "$1"),
        title: title && title.replace(this.rules.inline.anyPunctuation, "$1"),
      },
      cap[0],
      this.lexer,
      this.rules
    );
  }

  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const key = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link = links[key.toLowerCase()];
      if (!link) {
        const ch = cap[0].charAt(0);
        return { type: "text", raw: ch, text: ch };
      }
      return buildLinkToken(cap, link, cap[0], this.lexer, this.rules);
    }
  }

  emStrong(src, maskedSrc, prevChar = "") {
    let cap = this.rules.inline.emStrongLDelim.exec(src);
    if (!cap || (cap[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric))) return;
    if (!(cap[1] || cap[2] || "") || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const count = [...cap[0]].length - 1;
      let remaining = count;
      let bonusPunct = 0;
      const rDelim = cap[0][0] === "*"
        ? this.rules.inline.emStrongRDelimAst
        : this.rules.inline.emStrongRDelimUnd;
      rDelim.lastIndex = 0;
      let mSrc = maskedSrc.slice(-1 * src.length + remaining);
      while ((cap = rDelim.exec(mSrc)) !== null) {
        const found = cap[1] || cap[2] || cap[3] || cap[4] || cap[5] || cap[6];
        if (!found) continue;
        const fLen = [...found].length;
        if (cap[3] || cap[4]) { remaining += fLen; continue; }
        else if ((cap[5] || cap[6]) && count % 3 && !((count + fLen) % 3)) { bonusPunct += fLen; continue; }
        remaining -= fLen;
        if (remaining > 0) continue;
        const take = Math.min(fLen, fLen + remaining + bonusPunct);
        const firstLen = [...cap[0]][0].length;
        const raw = src.slice(0, count + cap.index + firstLen + take);
        if (Math.min(count, take) % 2) {
          const inner = raw.slice(1, -1);
          return { type: "em", raw, text: inner, tokens: this.lexer.inlineTokens(inner) };
        }
        const inner = raw.slice(2, -2);
        return { type: "strong", raw, text: inner, tokens: this.lexer.inlineTokens(inner) };
      }
    }
  }

  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpace = this.rules.other.nonSpaceChar.test(text);
      const hasEdgeSpaces = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpace && hasEdgeSpaces) text = text.slice(1, -1);
      return { type: "codespan", raw: cap[0], text };
    }
  }

  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) return { type: "br", raw: cap[0] };
  }

  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap)
      return { type: "del", raw: cap[0], text: cap[2], tokens: this.lexer.inlineTokens(cap[2]) };
  }

  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      const text = cap[1];
      const href = cap[2] === "@" ? "mailto:" + text : text;
      return { type: "link", raw: cap[0], text, href, tokens: [{ type: "text", raw: text, text }] };
    }
  }

  url(src) {
    let cap;
    if ((cap = this.rules.inline.url.exec(src))) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prev;
        do {
          prev = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prev !== cap[0]);
        text = cap[0];
        href = cap[1] === "www." ? "http://" + cap[0] : cap[0];
      }
      return { type: "link", raw: cap[0], text, href, tokens: [{ type: "text", raw: text, text }] };
    }
  }

  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap)
      return { type: "text", raw: cap[0], text: cap[0], escaped: this.lexer.state.inRawBlock };
  }
}

// ─────────────────────────────────────────────
//  LEXER
// ─────────────────────────────────────────────

class SophLexer {
  constructor(options) {
    this.tokens = [];
    this.tokens.links = Object.create(null);
    this.options = options || globalConfig;
    this.options.tokenizer = this.options.tokenizer || new SophTokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = { inLink: false, inRawBlock: false, top: true };

    const rules = { other: pat, block: blockGrammar.normal, inline: inlineGrammar.normal };
    if (this.options.pedantic) {
      rules.block = blockGrammar.pedantic;
      rules.inline = inlineGrammar.pedantic;
    } else if (this.options.gfm) {
      rules.block = blockGrammar.gfm;
      rules.inline = this.options.breaks ? inlineGrammar.breaks : inlineGrammar.gfm;
    }
    this.tokenizer.rules = rules;
  }

  static get rules() {
    return { block: blockGrammar, inline: inlineGrammar };
  }

  static lex(src, options) {
    return new SophLexer(options).lex(src);
  }

  static lexInline(src, options) {
    return new SophLexer(options).inlineTokens(src);
  }

  lex(src) {
    src = src.replace(pat.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const { src: s, tokens: t } = this.inlineQueue[i];
      this.inlineTokens(s, t);
    }
    this.inlineQueue = [];
    return this.tokens;
  }

  blockTokens(src, tokens = [], inBlockquote = false) {
    if (this.options.pedantic)
      src = src.replace(pat.tabCharGlobal, "    ").replace(pat.spaceLine, "");

    while (src) {
      let token;
      if (this.options.extensions?.block?.some((ext) => {
        if ((token = ext.call({ lexer: this }, src, tokens))) {
          src = src.slice(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) continue;

      if ((token = this.tokenizer.space(src))) {
        src = src.slice(token.raw.length);
        const last = tokens.at(-1);
        if (token.raw.length === 1 && last) last.raw += "\n";
        else tokens.push(token);
        continue;
      }
      if ((token = this.tokenizer.code(src))) {
        src = src.slice(token.raw.length);
        const last = tokens.at(-1);
        if (last?.type === "paragraph" || last?.type === "text") {
          last.raw += "\n" + token.raw;
          last.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = last.text;
        } else tokens.push(token);
        continue;
      }
      for (const method of ["fences","heading","hr","blockquote","list","html"]) {
        if ((token = this.tokenizer[method](src))) {
          src = src.slice(token.raw.length);
          tokens.push(token);
          break;
        }
      }
      if (token) continue;
      if ((token = this.tokenizer.def(src))) {
        src = src.slice(token.raw.length);
        const last = tokens.at(-1);
        if (last?.type === "paragraph" || last?.type === "text") {
          last.raw += "\n" + token.raw;
          last.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = last.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = { href: token.href, title: token.title };
        }
        continue;
      }
      if ((token = this.tokenizer.table(src))) {
        src = src.slice(token.raw.length);
        tokens.push(token);
        continue;
      }
      if ((token = this.tokenizer.lheading(src))) {
        src = src.slice(token.raw.length);
        tokens.push(token);
        continue;
      }

      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let closest = Infinity;
        const tail = src.slice(1);
        let idx;
        this.options.extensions.startBlock.forEach((fn) => {
          idx = fn.call({ lexer: this }, tail);
          if (typeof idx === "number" && idx >= 0) closest = Math.min(closest, idx);
        });
        if (closest < Infinity && closest >= 0) cutSrc = src.slice(0, closest + 1);
      }

      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const last = tokens.at(-1);
        if (inBlockquote && last?.type === "paragraph") {
          last.raw += "\n" + token.raw;
          last.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = last.text;
        } else tokens.push(token);
        inBlockquote = cutSrc.length !== src.length;
        src = src.slice(token.raw.length);
        continue;
      }
      if ((token = this.tokenizer.text(src))) {
        src = src.slice(token.raw.length);
        const last = tokens.at(-1);
        if (last?.type === "text") {
          last.raw += "\n" + token.raw;
          last.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = last.text;
        } else tokens.push(token);
        continue;
      }
      if (src) {
        const msg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) { console.error(msg); break; }
        else throw new Error(msg);
      }
    }
    this.state.top = true;
    return tokens;
  }

  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }

  inlineTokens(src, tokens = []) {
    let masked = src;
    let cap;

    if (this.tokens.links) {
      const keys = Object.keys(this.tokens.links);
      if (keys.length > 0) {
        while ((cap = this.tokenizer.rules.inline.reflinkSearch.exec(masked)) !== null) {
          if (keys.includes(cap[0].slice(cap[0].lastIndexOf("[") + 1, -1)))
            masked = masked.slice(0, cap.index) + "[" + "a".repeat(cap[0].length - 2) + "]" + masked.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
        }
      }
    }
    while ((cap = this.tokenizer.rules.inline.anyPunctuation.exec(masked)) !== null)
      masked = masked.slice(0, cap.index) + "++" + masked.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    while ((cap = this.tokenizer.rules.inline.blockSkip.exec(masked)) !== null)
      masked = masked.slice(0, cap.index) + "[" + "a".repeat(cap[0].length - 2) + "]" + masked.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);

    let keepPrev = false;
    let prevChar = "";

    while (src) {
      if (!keepPrev) prevChar = "";
      keepPrev = false;
      let token;

      if (this.options.extensions?.inline?.some((ext) => {
        if ((token = ext.call({ lexer: this }, src, tokens))) {
          src = src.slice(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) continue;

      for (const method of ["escape","tag","link"]) {
        if ((token = this.tokenizer[method](src))) {
          src = src.slice(token.raw.length);
          tokens.push(token);
          break;
        }
      }
      if (token) continue;

      if ((token = this.tokenizer.reflink(src, this.tokens.links))) {
        src = src.slice(token.raw.length);
        const last = tokens.at(-1);
        if (token.type === "text" && last?.type === "text") {
          last.raw += token.raw;
          last.text += token.text;
        } else tokens.push(token);
        continue;
      }

      for (const method of ["emStrong","codespan","br","del","autolink"]) {
        if (method === "emStrong") token = this.tokenizer.emStrong(src, masked, prevChar);
        else token = this.tokenizer[method](src);
        if (token) {
          src = src.slice(token.raw.length);
          tokens.push(token);
          break;
        }
      }
      if (token) continue;

      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.slice(token.raw.length);
        tokens.push(token);
        continue;
      }

      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let closest = Infinity;
        const tail = src.slice(1);
        let idx;
        this.options.extensions.startInline.forEach((fn) => {
          idx = fn.call({ lexer: this }, tail);
          if (typeof idx === "number" && idx >= 0) closest = Math.min(closest, idx);
        });
        if (closest < Infinity && closest >= 0) cutSrc = src.slice(0, closest + 1);
      }

      if ((token = this.tokenizer.inlineText(cutSrc))) {
        src = src.slice(token.raw.length);
        if (token.raw.slice(-1) !== "_") prevChar = token.raw.slice(-1);
        keepPrev = true;
        const last = tokens.at(-1);
        if (last?.type === "text") {
          last.raw += token.raw;
          last.text += token.text;
        } else tokens.push(token);
        continue;
      }

      if (src) {
        const msg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) { console.error(msg); break; }
        else throw new Error(msg);
      }
    }
    return tokens;
  }
}

// ─────────────────────────────────────────────
//  RENDERER
// ─────────────────────────────────────────────

class SophRenderer {
  constructor(options) {
    this.options = options || globalConfig;
  }

  space() { return ""; }

  code({ text, lang, escaped }) {
    const langClass = (lang || "").match(pat.notSpaceStart)?.[0];
    const body = text.replace(pat.endingNewline, "") + "\n";
    if (langClass)
      return `<pre><code class="language-${escapeHtml(langClass)}">${escaped ? body : escapeHtml(body, true)}</code></pre>\n`;
    return `<pre><code>${escaped ? body : escapeHtml(body, true)}</code></pre>\n`;
  }

  blockquote({ tokens }) {
    return `<blockquote>\n${this.parser.parse(tokens)}</blockquote>\n`;
  }

  html({ text }) { return text; }

  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
  }

  hr() { return `<hr>\n`; }

  list(token) {
    const tag = token.ordered ? "ol" : "ul";
    const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
    const body = token.items.map((item) => this.listitem(item)).join("");
    return `<${tag}${start}>\n${body}</${tag}>\n`;
  }

  listitem(item) {
    let body = "";
    if (item.task) {
      const check = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = check + " " + item.tokens[0].text;
          if (item.tokens[0].tokens?.[0]?.type === "text") {
            item.tokens[0].tokens[0].text = check + " " + escapeHtml(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({ type: "text", raw: check + " ", text: check + " ", escaped: true });
        }
      } else body += check + " ";
    }
    body += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${body}</li>\n`;
  }

  checkbox({ checked }) {
    return `<input ${checked ? 'checked="" ' : ""}disabled="" type="checkbox">`;
  }

  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>\n`;
  }

  table(token) {
    // ── Complex table: colspan via ">" cell, rowspan via "^" cell ──
    // Build a grid to track occupied cells for rowspan
    const allRows = token.rows;
    const colCount = token.header.length;

    // Render header
    let head = "";
    for (const cell of token.header) head += this.tablecell(cell);

    // Build body with colspan/rowspan support
    // occupied[r][c] = true means cell is already covered by a rowspan above
    const occupied = [];
    const rowHtmls = [];
    for (let r = 0; r < allRows.length; r++) {
      occupied[r] = occupied[r] || [];
      const row = allRows[r];
      let rowHtml = "";
      let colIdx = 0; // logical column in the output grid
      for (let c = 0; c < row.length; c++) {
        // skip occupied slots
        while (occupied[r][colIdx]) colIdx++;
        const cell = row[c];
        const rawText = cell.text.trim();

        // ">" means merge with the cell to the left (colspan)
        if (rawText === ">") { colIdx++; continue; }

        // "^" means merge with the cell above (rowspan)
        if (rawText === "^") { colIdx++; continue; }

        // Count colspan: how many consecutive ">" cells follow
        let colspan = 1;
        for (let k = c + 1; k < row.length; k++) {
          if (row[k].text.trim() === ">") colspan++;
          else break;
        }

        // Count rowspan: how many consecutive "^" cells appear below in same col
        let rowspan = 1;
        for (let k = r + 1; k < allRows.length; k++) {
          // find the cell at the same logical column in that row
          let logCol = 0, found = false;
          for (let j = 0; j < allRows[k].length; j++) {
            while ((occupied[k] || [])[logCol]) logCol++;
            if (logCol === colIdx) {
              if (allRows[k][j].text.trim() === "^") { rowspan++; found = true; }
              break;
            }
            logCol++;
          }
          if (!found) break;
        }

        // Mark occupied cells for rowspan
        for (let dr = 1; dr < rowspan; dr++) {
          occupied[r + dr] = occupied[r + dr] || [];
          for (let dc = 0; dc < colspan; dc++) occupied[r + dr][colIdx + dc] = true;
        }

        const inner = this.parser.parseInline(cell.tokens);
        const tag = "td";
        const alignAttr = cell.align ? ` align="${cell.align}"` : "";
        const colspanAttr = colspan > 1 ? ` colspan="${colspan}"` : "";
        const rowspanAttr = rowspan > 1 ? ` rowspan="${rowspan}"` : "";
        rowHtml += `<${tag}${alignAttr}${colspanAttr}${rowspanAttr}>${inner}</${tag}>\n`;
        colIdx += colspan;
      }
      rowHtmls.push(rowHtml);
    }

    let body = rowHtmls.map((h) => `<tr>\n${h}</tr>\n`).join("");
    if (body) body = `<tbody>${body}</tbody>`;
    return `<table>\n<thead>\n${this.tablerow({ text: head })}</thead>\n${body}</table>\n`;
  }

  tablerow({ text }) { return `<tr>\n${text}</tr>\n`; }

  tablecell(cell) {
    const inner = this.parser.parseInline(cell.tokens);
    const tag = cell.header ? "th" : "td";
    return (cell.align ? `<${tag} align="${cell.align}">` : `<${tag}>`) + inner + `</${tag}>\n`;
  }

  strong({ tokens }) { return `<strong>${this.parser.parseInline(tokens)}</strong>`; }
  em({ tokens }) { return `<em>${this.parser.parseInline(tokens)}</em>`; }
  codespan({ text }) { return `<code>${escapeHtml(text, true)}</code>`; }
  br() { return "<br>"; }
  del({ tokens }) { return `<del>${this.parser.parseInline(tokens)}</del>`; }

  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const safe = sanitizeHref(href);
    if (!safe) return text;
    let out = `<a href="${safe}"`;
    if (title) out += ` title="${escapeHtml(title)}"`;
    return out + `>${text}</a>`;
  }

  image({ href, title, text, tokens }) {
    if (tokens) text = this.parser.parseInline(tokens, this.parser.textRenderer);
    const safe = sanitizeHref(href);
    if (!safe) return escapeHtml(text);
    let out = `<img src="${safe}" alt="${text}"`;
    if (title) out += ` title="${escapeHtml(title)}"`;
    return out + ">";
  }

  text(token) {
    if ("tokens" in token && token.tokens) return this.parser.parseInline(token.tokens);
    if ("escaped" in token && token.escaped) return token.text;
    return escapeHtml(token.text);
  }
}

// ─────────────────────────────────────────────
//  PLAIN TEXT RENDERER
// ─────────────────────────────────────────────

class SophTextRenderer {
  strong({ text }) { return text; }
  em({ text }) { return text; }
  codespan({ text }) { return text; }
  del({ text }) { return text; }
  html({ text }) { return text; }
  text({ text }) { return text; }
  link({ text }) { return "" + text; }
  image({ text }) { return "" + text; }
  br() { return ""; }
}

// ─────────────────────────────────────────────
//  PARSER
// ─────────────────────────────────────────────

class SophParser {
  constructor(options) {
    this.options = options || globalConfig;
    this.options.renderer = this.options.renderer || new SophRenderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new SophTextRenderer();
  }

  static parse(tokens, options) {
    return new SophParser(options).parse(tokens);
  }

  static parseInline(tokens, options) {
    return new SophParser(options).parseInline(tokens);
  }

  parse(tokens, top = true) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (this.options.extensions?.renderers?.[token.type]) {
        const result = this.options.extensions.renderers[token.type].call({ parser: this }, token);
        if (result !== false || !["space","hr","heading","code","table","blockquote","list","html","paragraph","text"].includes(token.type)) {
          out += result || "";
          continue;
        }
      }

      switch (token.type) {
        case "space": out += this.renderer.space(token); continue;
        case "hr": out += this.renderer.hr(token); continue;
        case "heading": out += this.renderer.heading(token); continue;
        case "code": out += this.renderer.code(token); continue;
        case "table": out += this.renderer.table(token); continue;
        case "blockquote": out += this.renderer.blockquote(token); continue;
        case "list": out += this.renderer.list(token); continue;
        case "html": out += this.renderer.html(token); continue;
        case "paragraph": out += this.renderer.paragraph(token); continue;
        case "text": {
          let body = this.renderer.text(token);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            body += "\n" + this.renderer.text(tokens[++i]);
          }
          out += top
            ? this.renderer.paragraph({ type: "paragraph", raw: body, text: body, tokens: [{ type: "text", raw: body, text: body, escaped: true }] })
            : body;
          continue;
        }
        default: {
          const msg = `Token with "${token.type}" type was not found.`;
          if (this.options.silent) { console.error(msg); return ""; }
          throw new Error(msg);
        }
      }
    }
    return out;
  }

  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (const token of tokens) {
      if (this.options.extensions?.renderers?.[token.type]) {
        const result = this.options.extensions.renderers[token.type].call({ parser: this }, token);
        if (result !== false || !["escape","html","link","image","strong","em","codespan","br","del","text"].includes(token.type)) {
          out += result || "";
          continue;
        }
      }
      switch (token.type) {
        case "escape": out += renderer.text(token); break;
        case "html": out += renderer.html(token); break;
        case "link": out += renderer.link(token); break;
        case "image": out += renderer.image(token); break;
        case "strong": out += renderer.strong(token); break;
        case "em": out += renderer.em(token); break;
        case "codespan": out += renderer.codespan(token); break;
        case "br": out += renderer.br(token); break;
        case "del": out += renderer.del(token); break;
        case "text": out += renderer.text(token); break;
        default: {
          const msg = `Token with "${token.type}" type was not found.`;
          if (this.options.silent) { console.error(msg); return ""; }
          throw new Error(msg);
        }
      }
    }
    return out;
  }
}

// ─────────────────────────────────────────────
//  HOOKS
// ─────────────────────────────────────────────

class SophHooks {
  constructor(options) {
    this.options = options || globalConfig;
  }

  static passThroughHooks = new Set(["preprocess", "postprocess", "processAllTokens"]);

  preprocess(src) { return src; }
  postprocess(html) { return html; }
  processAllTokens(tokens) { return tokens; }
  provideLexer() { return this.block ? SophLexer.lex : SophLexer.lexInline; }
  provideParser() { return this.block ? SophParser.parse : SophParser.parseInline; }
}

// ─────────────────────────────────────────────
//  MAIN ENGINE
// ─────────────────────────────────────────────

class SophMark {
  constructor(...extensions) {
    this.defaults = createDefaults();
    this.options = this.setOptions.bind(this);
    this.parse = this._parseMarkdown(true);
    this.parseInline = this._parseMarkdown(false);
    this.Parser = SophParser;
    this.Renderer = SophRenderer;
    this.TextRenderer = SophTextRenderer;
    this.Lexer = SophLexer;
    this.Tokenizer = SophTokenizer;
    this.Hooks = SophHooks;
    if (extensions.length) this.use(...extensions);
  }

  walkTokens(tokens, fn) {
    let results = [];
    for (const token of tokens) {
      results = results.concat(fn.call(this, token));
      switch (token.type) {
        case "table": {
          for (const cell of token.header)
            results = results.concat(this.walkTokens(cell.tokens, fn));
          for (const row of token.rows)
            for (const cell of row)
              results = results.concat(this.walkTokens(cell.tokens, fn));
          break;
        }
        case "list":
          results = results.concat(this.walkTokens(token.items, fn));
          break;
        default:
          if (this.defaults.extensions?.childTokens?.[token.type]) {
            this.defaults.extensions.childTokens[token.type].forEach((key) => {
              const children = token[key].flat(Infinity);
              results = results.concat(this.walkTokens(children, fn));
            });
          } else if (token.tokens) {
            results = results.concat(this.walkTokens(token.tokens, fn));
          }
      }
    }
    return results;
  }

  use(...extensions) {
    const extBase = this.defaults.extensions || { renderers: {}, childTokens: {} };
    extensions.forEach((ext) => {
      const merged = { ...ext };
      merged.async = this.defaults.async || merged.async || false;

      if (ext.extensions) {
        ext.extensions.forEach((e) => {
          if (!e.name) throw new Error("extension name required");
          if ("renderer" in e) {
            const prev = extBase.renderers[e.name];
            extBase.renderers[e.name] = prev
              ? function (...args) {
                  const r = e.renderer.apply(this, args);
                  return r === false ? prev.apply(this, args) : r;
                }
              : e.renderer;
          }
          if ("tokenizer" in e) {
            if (!e.level || !["block", "inline"].includes(e.level))
              throw new Error("extension level must be 'block' or 'inline'");
            const lvl = extBase[e.level];
            lvl ? lvl.unshift(e.tokenizer) : (extBase[e.level] = [e.tokenizer]);
            if (e.start) {
              const startArr = e.level === "block" ? "startBlock" : "startInline";
              extBase[startArr] ? extBase[startArr].push(e.start) : (extBase[startArr] = [e.start]);
            }
          }
          if ("childTokens" in e && e.childTokens)
            extBase.childTokens[e.name] = e.childTokens;
        });
        merged.extensions = extBase;
      }

      if (ext.renderer) {
        const baseRenderer = this.defaults.renderer || new SophRenderer(this.defaults);
        for (const key in ext.renderer) {
          if (!(key in baseRenderer)) throw new Error(`renderer '${key}' does not exist`);
          if (["options", "parser"].includes(key)) continue;
          const prev = baseRenderer[key];
          const override = ext.renderer[key];
          baseRenderer[key] = (...args) => {
            const r = override.apply(baseRenderer, args);
            return (r === false ? prev.apply(baseRenderer, args) : r) || "";
          };
        }
        merged.renderer = baseRenderer;
      }

      if (ext.tokenizer) {
        const baseTok = this.defaults.tokenizer || new SophTokenizer(this.defaults);
        for (const key in ext.tokenizer) {
          if (!(key in baseTok)) throw new Error(`tokenizer '${key}' does not exist`);
          if (["options", "rules", "lexer"].includes(key)) continue;
          const prev = baseTok[key];
          const override = ext.tokenizer[key];
          baseTok[key] = (...args) => {
            const r = override.apply(baseTok, args);
            return r === false ? prev.apply(baseTok, args) : r;
          };
        }
        merged.tokenizer = baseTok;
      }

      if (ext.hooks) {
        const baseHooks = this.defaults.hooks || new SophHooks();
        for (const key in ext.hooks) {
          if (!(key in baseHooks)) throw new Error(`hook '${key}' does not exist`);
          if (["options", "block"].includes(key)) continue;
          const prev = baseHooks[key];
          const override = ext.hooks[key];
          if (SophHooks.passThroughHooks.has(key)) {
            baseHooks[key] = (arg) => {
              if (this.defaults.async)
                return Promise.resolve(override.call(baseHooks, arg)).then((v) => prev.call(baseHooks, v));
              return prev.call(baseHooks, override.call(baseHooks, arg));
            };
          } else {
            baseHooks[key] = (...args) => {
              const r = override.apply(baseHooks, args);
              return r === false ? prev.apply(baseHooks, args) : r;
            };
          }
        }
        merged.hooks = baseHooks;
      }

      if (ext.walkTokens) {
        const prevWalk = this.defaults.walkTokens;
        const newWalk = ext.walkTokens;
        merged.walkTokens = function (token) {
          let res = [];
          res.push(newWalk.call(this, token));
          if (prevWalk) res = res.concat(prevWalk.call(this, token));
          return res;
        };
      }

      this.defaults = { ...this.defaults, ...merged };
    });
    return this;
  }

  setOptions(opts) {
    this.defaults = { ...this.defaults, ...opts };
    return this;
  }

  lexer(src, options) {
    return SophLexer.lex(src, options ?? this.defaults);
  }

  parser(tokens, options) {
    return SophParser.parse(tokens, options ?? this.defaults);
  }

  _parseMarkdown(block) {
    return (src, options) => {
      const merged = { ...this.defaults, ...options };
      const onError = this._onError(!!merged.silent, !!merged.async);

      if (this.defaults.async === true && options?.async === false)
        return onError(new Error("sophmark(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof src === "undefined" || src === null)
        return onError(new Error("sophmark(): input parameter is undefined or null"));
      if (typeof src !== "string")
        return onError(new Error("sophmark(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));

      if (merged.hooks) { merged.hooks.options = merged; merged.hooks.block = block; }

      const lexFn = merged.hooks ? merged.hooks.provideLexer() : block ? SophLexer.lex : SophLexer.lexInline;
      const parseFn = merged.hooks ? merged.hooks.provideParser() : block ? SophParser.parse : SophParser.parseInline;

      if (merged.async) {
        return Promise.resolve(merged.hooks ? merged.hooks.preprocess(src) : src)
          .then((s) => { const m = mathPreprocess(s); merged._mathStash = m.stash; return m.src; })
          .then((s) => lexFn(s, merged))
          .then((t) => merged.hooks ? merged.hooks.processAllTokens(t) : t)
          .then((t) => merged.walkTokens ? Promise.all(this.walkTokens(t, merged.walkTokens)).then(() => t) : t)
          .then((t) => parseFn(t, merged))
          .then((h) => merged.hooks ? merged.hooks.postprocess(h) : h)
          .then((h) => mathPostprocess(h, merged._mathStash || []))
          .catch(onError);
      }

      try {
        if (merged.hooks) src = merged.hooks.preprocess(src);
        const mathResult = mathPreprocess(src);
        src = mathResult.src;
        let tokens = lexFn(src, merged);
        if (merged.hooks) tokens = merged.hooks.processAllTokens(tokens);
        if (merged.walkTokens) this.walkTokens(tokens, merged.walkTokens);
        let html = parseFn(tokens, merged);
        if (merged.hooks) html = merged.hooks.postprocess(html);
        html = mathPostprocess(html, mathResult.stash);
        return html;
      } catch (e) {
        return onError(e);
      }
    };
  }

  _onError(silent, async) {
    return (err) => {
      err.message += "\nPlease report this to https://github.com/arcosoph/sophmark.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escapeHtml(err.message + "", true) + "</pre>";
        return async ? Promise.resolve(msg) : msg;
      }
      if (async) return Promise.reject(err);
      throw err;
    };
  }
}

// ─────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────

const _engine = new SophMark();

/**
 * Parse Markdown and return HTML.
 * @param {string} src - Markdown source
 * @param {object} [options]
 * @returns {string|Promise<string>}
 */
function sophmark(src, options) {
  return _engine.parse(src, options);
}

sophmark.options = sophmark.setOptions = function (opts) {
  _engine.setOptions(opts);
  sophmark.defaults = _engine.defaults;
  applyConfig(sophmark.defaults);
  return sophmark;
};

sophmark.getDefaults = createDefaults;
sophmark.defaults = globalConfig;

sophmark.use = function (...extensions) {
  _engine.use(...extensions);
  sophmark.defaults = _engine.defaults;
  applyConfig(sophmark.defaults);
  return sophmark;
};

sophmark.walkTokens = function (tokens, fn) { return _engine.walkTokens(tokens, fn); };
sophmark.parseInline = _engine.parseInline.bind(_engine);

sophmark.Parser    = SophParser;
sophmark.parser    = SophParser.parse;
sophmark.Renderer  = SophRenderer;
sophmark.TextRenderer = SophTextRenderer;
sophmark.Lexer     = SophLexer;
sophmark.lexer     = SophLexer.lex;
sophmark.Tokenizer = SophTokenizer;
sophmark.Hooks     = SophHooks;
sophmark.parse     = sophmark;

  return sophmark;
}));
