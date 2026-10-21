import { describe, it, expect } from 'vitest';
import { markdownToHtml } from './markdown';

describe('markdownToHtml', () => {
  it('returns an empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
    expect(markdownToHtml(null)).toBe('');
    expect(markdownToHtml(undefined)).toBe('');
  });

  it('renders headings, emphasis, and line breaks', () => {
    expect(markdownToHtml('# Title')).toBe('<h1>Title</h1>');
    expect(markdownToHtml('## Subtitle')).toBe('<h2>Subtitle</h2>');
    expect(markdownToHtml('### Section')).toBe('<h3>Section</h3>');
    expect(markdownToHtml('**bold** and *italic*')).toBe('<strong>bold</strong> and <em>italic</em>');
    expect(markdownToHtml('line one\nline two')).toBe('line one<br />line two');
  });

  it('renders safe http and https links', () => {
    expect(markdownToHtml('[example](https://example.com)')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">example</a>'
    );
    expect(markdownToHtml('[example](http://example.com)')).toContain('href="http://example.com"');
  });

  it('does not render javascript links', () => {
    expect(markdownToHtml('[bad](javascript:alert(1))')).toBe('[bad](javascript:alert(1))');
  });

  it('escapes HTML before formatting to prevent XSS', () => {
    expect(markdownToHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    expect(markdownToHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
    expect(markdownToHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });

  it('does not turn escaped markup into HTML elements', () => {
    expect(markdownToHtml('<h1>not a heading</h1>')).not.toContain('<h1>');
    expect(markdownToHtml('<strong>not bold</strong>')).not.toContain('<strong>not bold</strong>');
  });
});
