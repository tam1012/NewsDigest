import { Source, ArticleInput } from '../../types';
import { NetworkError, RateLimitError } from '../../errors';

export async function fetchVoz(source: Source): Promise<ArticleInput[]> {
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'NewsDigest/1.0.0' }
  });
  if (!response.ok) {
    if (response.status === 429) throw new RateLimitError(`VOZ rate-limited: ${response.status}`, source.url);
    throw new NetworkError(`VOZ failed: ${response.status}`, response.status, source.url);
  }

  const results: ArticleInput[] = [];
  let currentTitle = "";
  let currentUrl = "";

  class TitleHandler {
    text(text: Text) {
      if (text.text.trim()) {
         currentTitle += text.text;
      }
    }
  }
  
  class LinkHandler {
    element(element: Element) {
      const href = element.getAttribute("href");
      if (href && href.startsWith('/t/')) {
        currentUrl = `https://voz.vn${href}`;
      }
    }
  }

  class ItemHandler {
    element(element: Element) {
      if (currentTitle && currentUrl) {
        results.push({
          title: currentTitle.trim(),
          url: currentUrl,
          published_at: new Date().toISOString()
        });
      }
      currentTitle = "";
      currentUrl = "";
    }
  }

  const rewriter = new HTMLRewriter()
    .on('.structItem-title a', new LinkHandler())
    .on('.structItem-title a', new TitleHandler())
    .on('.structItem', new ItemHandler());
    
  await rewriter.transform(response).text();

  if (currentTitle && currentUrl && !results.find(r => r.url === currentUrl)) {
    results.push({
      title: currentTitle.trim(),
      url: currentUrl,
      published_at: new Date().toISOString()
    });
  }

  return results.filter(r => r.url && r.title);
}
