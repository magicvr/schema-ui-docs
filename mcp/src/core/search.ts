import { listSearchDocs, normalizeText, readMarkdown, splitSections, titleFromMarkdown, type DocEntry } from './protocol-index.js';

export type SearchResult = {
  title: string;
  path: string;
  section: string | null;
  snippet: string;
  reason: string;
};

type ScoredResult = SearchResult & {
  score: number;
  docOrder: number;
  sectionOrder: number;
};

export function searchProtocol(query: string, limit = 10): { results: SearchResult[] } {
  const normalizedLimit = Math.max(1, Math.min(limit || 10, 10));
  const docs = listSearchDocs();
  const results = rankSearchResults(query, docs).slice(0, normalizedLimit);
  return { results: results.map(({ score: _score, docOrder: _docOrder, sectionOrder: _sectionOrder, ...result }) => result) };
}

export function rankSearchResults(query: string, docs: DocEntry[]): ScoredResult[] {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [];

  const results: ScoredResult[] = [];
  for (const doc of docs) {
    let markdown: string;
    try {
      markdown = readMarkdown(doc);
    } catch {
      continue;
    }

    const documentTitle = titleFromMarkdown(markdown, doc.title);
    const sections = splitSections(markdown);
    sections.forEach((section, sectionOrder) => {
      const titleText = `${documentTitle} ${section.title}`;
      const titleNormalized = normalizeText(titleText);
      const bodyNormalized = normalizeText(section.content);
      const combined = `${titleNormalized} ${bodyNormalized}`;
      if (!terms.every(term => combined.includes(term))) return;

      const titleHits = terms.filter(term => titleNormalized.includes(term));
      const bodyHits = terms.filter(term => bodyNormalized.includes(term));
      const exactHits = terms.filter(term => hasWholeToken(titleNormalized, term) || hasWholeToken(bodyNormalized, term));
      const partialHits = terms.filter(term => !exactHits.includes(term) && combined.includes(term));
      const score = titleHits.length * 1000
        + bodyHits.length * 100
        + exactHits.length * 50
        + partialHits.length * 10
        - doc.order
        - sectionOrder / 100;

      results.push({
        title: documentTitle,
        path: doc.relativePath,
        section: section.title === '全文' ? null : section.title,
        snippet: makeSnippet(section.content, terms),
        reason: describeReason(titleHits, bodyHits, exactHits, partialHits),
        score,
        docOrder: doc.order,
        sectionOrder,
      });
    });
  }

  return results.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.docOrder !== right.docOrder) return left.docOrder - right.docOrder;
    return left.sectionOrder - right.sectionOrder;
  });
}

function hasWholeToken(normalizedText: string, term: string): boolean {
  return normalizedText.split(' ').includes(term);
}

function makeSnippet(content: string, terms: string[]): string {
  const normalizedContent = normalizeText(content);
  let normalizedIndex = -1;
  for (const term of terms) {
    normalizedIndex = normalizedContent.indexOf(term);
    if (normalizedIndex >= 0) break;
  }

  const compact = content.replace(/\s+/g, ' ').trim();
  if (normalizedIndex < 0) return compact.slice(0, 240);

  const firstTerm = terms.find(term => normalizedContent.includes(term)) ?? terms[0];
  const rawIndex = compact.toLowerCase().indexOf(firstTerm);
  const start = rawIndex >= 0 ? Math.max(0, rawIndex - 80) : 0;
  const snippet = compact.slice(start, start + 260);
  return `${start > 0 ? '...' : ''}${snippet}${start + 260 < compact.length ? '...' : ''}`;
}

function describeReason(titleHits: string[], bodyHits: string[], exactHits: string[], partialHits: string[]): string {
  const parts: string[] = [];
  if (titleHits.length > 0) parts.push(`标题/章节命中 ${titleHits.join(' ')}`);
  if (bodyHits.length > 0) parts.push(`正文命中 ${bodyHits.join(' ')}`);
  if (exactHits.length > 0) parts.push(`完全词命中 ${exactHits.join(' ')}`);
  if (partialHits.length > 0) parts.push(`部分子串命中 ${partialHits.join(' ')}`);
  return parts.join('；') || '关键词命中';
}
