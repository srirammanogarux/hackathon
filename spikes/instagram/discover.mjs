// Business Discovery: read another business/creator account's recent posts and rank the top 5.
// Read-only. Needs the Facebook Login token from SETUP.md (does not work on graph.instagram.com).
//
//   node --env-file-if-exists=../../.env discover.mjs <username> [--limit 30] [--json]
//
// GET /{IG_USER_ID}?fields=business_discovery.username(<username>){followers_count,media_count,media.limit(N){...}}
// Docs: developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
import { writeFile, mkdir } from 'node:fs/promises';
import { graph, requireEnv, parseArgs } from './graph.mjs';

const args = parseArgs(process.argv.slice(2));
const username = args._[0]?.replace(/^@/, '');
if (!username) {
  console.error('usage: discover.mjs <instagram_username> [--limit 30] [--json]');
  process.exit(1);
}
const { userId } = requireEnv();
const limit = Number(args.limit ?? 30);

const MEDIA_FIELDS = ['id', 'caption', 'like_count', 'comments_count', 'media_type', 'media_product_type', 'permalink', 'timestamp'];

async function fetchProfile(withViews) {
  const mf = withViews ? [...MEDIA_FIELDS, 'view_count'] : MEDIA_FIELDS;
  const fields = `business_discovery.username(${username}){username,name,followers_count,media_count,media.limit(${limit}){${mf.join(',')}}}`;
  return (await graph('GET', `/${userId}`, { fields })).business_discovery;
}

let bd;
try {
  bd = await fetchProfile(true);
} catch (e) {
  // view_count is newer; if this API version rejects it, retry without.
  if (/view_count|nonexisting field|\(#100\)/i.test(e.message)) bd = await fetchProfile(false);
  else throw e;
}

const followers = bd.followers_count || 0;
const posts = (bd.media?.data ?? []).map((m) => {
  const likes = m.like_count ?? 0; // null/absent when the owner hides like counts
  const comments = m.comments_count ?? 0;
  const score = likes + 3 * comments; // comments signal more intent than likes
  return {
    ...m,
    likes,
    comments,
    score,
    er: followers ? ((likes + comments) / followers) * 100 : null,
    likes_hidden: m.like_count == null,
  };
});
const top = [...posts].sort((a, b) => b.score - a.score).slice(0, 5);

console.log(`@${bd.username} ${bd.name ?? ''}  followers=${followers}  posts=${bd.media_count}  scanned=${posts.length}\n`);
console.table(
  top.map((p, i) => ({
    rank: i + 1,
    type: p.media_product_type === 'REELS' ? 'REEL' : p.media_type,
    likes: p.likes_hidden ? 'hidden' : p.likes,
    comments: p.comments,
    views: p.view_count ?? '',
    'eng %': p.er == null ? '' : p.er.toFixed(2),
    date: p.timestamp?.slice(0, 10),
    caption: (p.caption ?? '').replace(/\s+/g, ' ').slice(0, 50),
  })),
);
top.forEach((p, i) => console.log(`${i + 1}. ${p.permalink}`));

const byType = {};
for (const p of posts) {
  const t = p.media_product_type === 'REELS' ? 'REEL' : p.media_type;
  (byType[t] ??= []).push(p.score);
}
console.log('\navg score by format:', Object.fromEntries(Object.entries(byType).map(([t, s]) => [t, Math.round(s.reduce((a, b) => a + b, 0) / s.length)])));

await mkdir('out', { recursive: true });
const out = `out/discover-${username}.json`;
await writeFile(out, JSON.stringify({ profile: { username: bd.username, name: bd.name, followers, media_count: bd.media_count }, top, posts }, null, 2));
console.log(`\nwrote ${out}`);
if (args.json) console.log(JSON.stringify(top, null, 2));
