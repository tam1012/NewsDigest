<script lang="ts">
  import { page } from '$app/state';

  let {
    title = 'NewsDigest — AI-Powered Tech News',
    description = 'Daily AI-curated tech news from RSS, Reddit, Hacker News, GitHub Trending and more. Summarized and scored by Gemini AI.',
    url = page.url.href,
    siteName = 'NewsDigest',
    locale = 'en_US',
    twitterCard = 'summary_large_image',
  }: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    locale?: string;
    twitterCard?: string;
  } = $props();
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />

  <!-- Open Graph -->
  <meta property="og:title" content={title} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={url} />
  <meta property="og:image" content={page.url.origin + '/og-image.jpg'} />
  <meta property="og:description" content={description} />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:locale" content={locale} />

  <!-- Twitter / X -->
  <meta name="twitter:card" content={twitterCard} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={page.url.origin + '/og-image.jpg'} />
</svelte:head>
