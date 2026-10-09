export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Market Landscape → "Companies & Vendors" (replaces the legacy Digital Media Landscape DB, Oct 2026)
    const DATABASE_ID = "96fc7d86-3498-4140-bd80-41f5af39bb86";
    const headers = {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    };

    // Fetch all pages with pagination
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const body = { page_size: 100 };
      if (startCursor) body.start_cursor = startCursor;

      const notionRes = await fetch(
        `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
        { method: "POST", headers, body: JSON.stringify(body) }
      );

      const text = await notionRes.text();
      let data;
      try { data = JSON.parse(text); } catch {
        return res.status(500).json({ error: "Failed to parse Notion response", raw: text });
      }

      if (!notionRes.ok) {
        return res.status(notionRes.status).json(data);
      }

      allResults = allResults.concat(data.results || []);
      hasMore = data.has_more || false;
      startCursor = data.next_cursor || undefined;
    }

    // Join every rich-text segment (the old code kept only the first one, which cut long fields)
    const rt = (prop) => (prop?.rich_text || []).map(t => t.plain_text).join("");
    const sel = (prop) => prop?.select?.name || "";
    const multi = (prop) => prop?.multi_select?.map(o => o.name) || [];

    // Transform pages into clean company objects
    const companies = allResults
      .filter(page => !page.in_trash && !page.archived)
      .map(page => {
        const p = page.properties;
        const rawComments = rt(p.Comments);

        // Legacy "Brazil: …" notes were moved into Comments during the migration — split them back out
        const lines = rawComments.split("\n");
        const brazilNote = lines
          .filter(l => /^brazil:/i.test(l.trim()))
          .map(l => l.trim().replace(/^brazil:\s*/i, ""))
          .join(" ");
        const comments = lines.filter(l => !/^brazil:/i.test(l.trim())).join("\n").trim();

        const presence = sel(p["BR/LATAM Presence"]);

        return {
          id: page.id,
          name: p.Company?.title?.map(t => t.plain_text).join("") || "",
          categories: multi(p.Category),
          type: multi(p.Type),
          what: rt(p["What they do"]),
          how: rt(p["How / Methodology"]),
          relevance: rt(p.Relevance),     // why the company matters to Carol; empty for most rows
          presence,                       // Brazilian | LATAM-born | Office in Brazil | Office in LATAM | Sells remotely | Not available
          brazil: brazilNote,             // free-text detail, may be empty
          hq: sel(p["HQ Country"]),
          aiLayer: sel(p["AI Layer"]),
          status: sel(p.Status),
          url: p.Website?.url || rt(p.Website),
          comments,
        };
      })
      .filter(c => c.name)
      // The directory shows marketing/adtech vendors. Startups tracked only as investment context
      // (fintech, proptech, etc.) have no Category and stay in Notion but off the public site.
      .filter(c => c.categories.length > 0);

    return res.status(200).json({ companies, total: companies.length });

  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
