// מייצר את קובץ ה-RSS בכל בקשה, וכולל רק פרקים שתאריך הפרסום שלהם כבר עבר.
// זו הסיבה שאין כאן שום תהליך רקע: הפרק "מופיע" מפני שמישהו ביקש את הפיד
// אחרי התאריך שנקבע לו, ולא מפני שמשהו רץ בלילה ופרסם אותו.
const crypto = require('crypto');
const episodes = require('../episodes.json');
const info = require('../podcast_info.json');

// 🚨 31/10/2026 (בקשת הרב אוריאל מס' 37, באישור רועי — באותם תנאים כמו שאר הפודקאסטים של הרב
//    ב-uriel-emuna, מ-21/10): קובץ השמע בפיד עובר קודם דרך OP3 — שירות ספירה חינמי ופתוח
//    (op3.dev) שמפנה מיד לאותו קובץ בגיטהאב ורושם כל בקשה: איזו אפליקציה, ומאזין ייחודי ביום.
//    הספירה עצמה — ~/uriel-emuna/stats_op3.py. הפרק לא משתנה: אותו guid, אותו קובץ, אותו גודל.
//    🚨 OP3 נפל → האזנה באפליקציות נעצרת. מכבים כאן ('') ופורסים — וחוזרים לכתובת הישירה.
const OP3 = 'https://op3.dev/e';
// מזהה הפודקאסט (podcast:guid): UUIDv5 של כתובת הפיד בלי https://, לפי התקן של podcastindex.
// קבוע ולא לפי הכתובת שממנה הגיעה הבקשה — OP3 משייך לפיו כל הורדה לפודקאסט, ואותו חישוב
// בדיוק ב-stats_op3.feed_guid.
const CANON = 'kuzari-pod.vercel.app/feed.xml';
const PODCAST_NS = 'ead4c236-bf58-58c6-a2c6-a6b28d128cb6';
function uuidv5(name, ns) {
  const h = crypto.createHash('sha1')
    .update(Buffer.from(ns.replace(/-/g, ''), 'hex')).update(name, 'utf8').digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const PG = uuidv5(CANON, PODCAST_NS);
const media = (url) => (OP3 && /^https:\/\//.test(url) ? `${OP3},pg=${PG}/${url.slice(8)}` : url);

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
      <enclosure url="${attr(media(e.url))}" length="${e.size}" type="audio/mpeg"/>
      <itunes:duration>${e.duration}</itunes:duration>
      <itunes:author>${cdata(info.author)}</itunes:author>
      <itunes:image href="${attr(cover)}"/>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
    </item>`).join('\n');

  // 🚨 31/10/2026 (בקשה 37): lastBuildDate היה «עכשיו» בכל בקשה, ולכן הפיד נראה חדש בכל משיכה,
  //    והפלטפורמות בדקו שוב ושוב את הפרק האחרון — 120–250 «הורדות» ביום בגיטהאב לפרק שאיש לא
  //    שמע (כמו שהיה בפידים של uriel-emuna עד 21/10). עכשיו: הפרק האחרון שיצא. הפיד זהה לעצמו
  //    עד שיש בו באמת משהו חדש.
  const newest = live.length ? rfc822(live[0].publish_at) : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>${cdata(info.title)}</title>
    <podcast:guid>${PG}</podcast:guid>
    <description>${cdata(info.description)}</description>
    <link>${base}/</link>
    <language>${info.language}</language>
    <copyright>${cdata(info.author)}</copyright>
    ${newest ? `<lastBuildDate>${newest}</lastBuildDate>` : ''}
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

module.exports._test = { uuidv5, PG, media, OP3, CANON };
