export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const DATABASE_ID = "179b8029-4567-4a87-aa3d-ee40f375f023";
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

    // Transform pages into clean company objects
    const companies = allResults
      .filter(page => !page.in_trash && !page.archived)
      .map(page => {
        const p = page.properties;
        return {
          id: page.id,
          name: p.Company?.title?.[0]?.plain_text || "",
          categories: p.Category?.multi_select?.map(c => c.name) || [],
          what: p["What they do"]?.rich_text?.[0]?.plain_text || "",
          how: p["How / Methodology"]?.rich_text?.[0]?.plain_text || "",
          brazil: p.Brazil?.rich_text?.[0]?.plain_text || "",
          status: p.Status?.select?.name || "",
          url: p.URL?.rich_text?.[0]?.plain_text || "",
          comments: p.Comments?.rich_text?.[0]?.plain_text || "",
        };
      })
      .filter(c => c.name); // remove empty entries

    return res.status(200).json({ companies, total: companies.length });

  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
