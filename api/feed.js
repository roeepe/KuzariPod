// מייצר את קובץ ה-RSS בכל בקשה, וכולל רק פרקים שתאריך הפרסום שלהם כבר עבר.
// זו הסיבה שאין כאן שום תהליך רקע: הפרק "מופיע" מפני שמישהו ביקש את הפיד
// אחרי התאריך שנקבע לו, ולא מפני שמשהו רץ בלילה ופרסם אותו.
const episodes = require('../episodes.json');
const info = require('../podcast_info.json');

const cdata = (s) => `<![CDATA[${String(s == null ? '' : s).replace(/]]>/g, ']]&gt;')}]]>`;
// ערכי מאפיין חייבים בריחה - '&' לא חוקי ב-XML, ו-'Religion & Spirituality' שבר את הפיד.
const attr = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rfc822 = (iso) => new Date(iso).toUTCString();

module.exports = (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const base = `https://${host}`;
  const now = Date.now();

  const live = episodes
    .filter((e) => new Date(e.publish_at).getTime() <= now)
    .sort((a, b) => new Date(b.publish_at) - new Date(a.publish_at) || b.n - a.n);

  const cover = `${base}${info.cover}`;
  const items = live.map((e) => `    <item>
      <title>${cdata(e.title)}</title>
      <description>${cdata(e.description_html)}</description>
      <itunes:summary>${cdata(e.description_html)}</itunes:summary>
      <link>${attr(base)}/#ep${e.n}</link>
      <guid isPermaLink="false">${attr(e.guid)}</guid>
      <pubDate>${rfc822(e.publish_at)}</pubDate>
      <enclosure url="${attr(e.url)}" length="${e.size}" type="audio/mpeg"/>
      <itunes:duration>${e.duration}</itunes:duration>
      <itunes:author>${cdata(info.author)}</itunes:author>
      <itunes:image href="${attr(cover)}"/>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${cdata(info.title)}</title>
    <description>${cdata(info.description)}</description>
    <link>${base}/</link>
    <language>${info.language}</language>
    <copyright>${cdata(info.author)}</copyright>
    <lastBuildDate>${rfc822(new Date().toISOString())}</lastBuildDate>
    <atom:link href="${attr(base)}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${cover}</url>
      <title>${cdata(info.title)}</title>
      <link>${base}/</link>
    </image>
    <itunes:author>${cdata(info.author)}</itunes:author>
    <itunes:summary>${cdata(info.description)}</itunes:summary>
    <itunes:image href="${attr(cover)}"/>
    <itunes:category text="${attr(info.category)}">
      <itunes:category text="${attr(info.subcategory)}"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>${cdata(info.author)}</itunes:name>
      <itunes:email>${info.owner_email}</itunes:email>
    </itunes:owner>
${items}
  </channel>
</rss>
`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  // מטמון קצר בכוונה. עם s-maxage ארוך, פרק שאמור לעלות ב-15:00 היה מוגש
  // מהמטמון עוד רבע שעה אחרי - ו-stale-while-revalidate היה מאריך את זה עוד.
  // הפונקציה זולה (קריאת JSON והרכבת מחרוזת), אז אין מה לחסוך כאן.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  res.status(200).send(xml);
};
