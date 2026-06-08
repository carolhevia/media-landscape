export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const notionRes = await fetch(
      "https://api.notion.com/v1/databases/179b8029-4567-4a87-aa3d-ee40f375f023/query",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 100 }),
      }
    );

    const text = await notionRes.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    return res.status(notionRes.status).json(payload);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
