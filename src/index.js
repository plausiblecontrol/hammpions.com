export default {
  async scheduled(event, env, ctx) {
    const targets = [
      { name: 'tiktok', url: 'https://www.tiktok.com/tag/hammpion', filter: '/video/' },
      { name: 'instagram', url: 'https://www.instagram.com/explore/tags/hammpion/', filter: '/p/' }
    ];

    let allLinks = [];

    for (const target of targets) {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCT_ID}/browser-rendering/crawl`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.CF_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: target.url,
              output: "json",
              extract: {
                links: `Return all URLs containing '${target.filter}'`
              }
            }),
          }
        );

        const data = await response.json();
        if (data.success && data.result.links) {
          const labeled = data.result.links.slice(0, 3).map(link => ({
            url: link,
            platform: target.name
          }));
          allLinks = [...allLinks, ...labeled];
        }
      } catch (err) {
        console.error(`Failed to crawl ${target.name}:`, err);
      }
    }

    const now = new Date();
    const timestamp = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZoneName: 'short'
    }).format(now);

    if (allLinks.length > 0) {
      const finalHtml = generateHTML(allLinks, timestamp);
      await env.HAMMPIONS_KV.put("site_index", finalHtml);
    }
  },

  async fetch(request, env) {
    const cachedPage = await env.HAMMPIONS_KV.get("site_index");
    return new Response(cachedPage || "Chilling the beer... (Site is initializing)", {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
};

function generateHTML(links, timestamp) {
  const cards = links.map(item => {
    if (item.platform === 'tiktok') {
      const id = item.url.split('/').pop();
      return `
        <div class="card bg-black/20 p-4 rounded-xl border border-white/5 overflow-hidden">
          <blockquote class="tiktok-embed" cite="${item.url}" data-video-id="${id}" style="width:100%">
            <section></section>
          </blockquote>
        </div>`;
    } else {
      return `
        <div class="card bg-black/20 p-4 rounded-xl border border-white/5 overflow-hidden">
          <blockquote class="instagram-media" data-instgrm-permalink="${item.url}" data-instgrm-version="14" style="width:100%; border:0; margin:0;">
          </blockquote>
        </div>`;
    }
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>The Hammpions | Daily Hub</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { background: #002D56; color: #F5F5F5; font-family: 'Georgia', serif; }
        .card { transition: transform 0.2s ease-in-out; }
        .card:hover { transform: translateY(-5px); }
      </style>
    </head>
    <body class="p-6 md:p-12">
      <div class="max-w-7xl mx-auto">

        <header class="text-center mb-16 border-b border-white/10 pb-12">
          <h1 class="text-7xl font-black italic uppercase tracking-tighter text-white">The Hammpions</h1>
          <p class="text-blue-300 mt-4 text-xl tracking-wide uppercase font-sans">Freshly Curated from the Land of Sky Blue Waters</p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${cards}
        </div>

        <footer class="mt-24 pt-12 border-t border-white/10 text-center">
          <p class="text-blue-200 text-sm mb-6">
            <strong>Last Updated:</strong> ${timestamp}
          </p>
          <div class="max-w-2xl mx-auto opacity-30 text-[10px] leading-relaxed uppercase tracking-widest">
            The Hammpions is a fan community hub. Not affiliated with, endorsed by, or sponsored by
            Molson Coors or Hamm's Brewing Co. Links are curated automatically from #hammpion social activity.
          </div>
        </footer>
      </div>

      <script async src="https://www.tiktok.com/embed.js"></script>
      <script async src="https://www.instagram.com/embed.js"></script>
    </body>
    </html>
  `;
}
