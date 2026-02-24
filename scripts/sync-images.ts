import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  await db.$connect();
  console.log("DB connected");

  // 1. Find all unique image paths from cached sections
  const sections = await db.cachedSection.findMany({ select: { contentJson: true } });
  const imagePaths = new Set<string>();

  for (const sec of sections) {
    const content = JSON.parse(sec.contentJson);
    for (const node of content) {
      if (node.type === "image" && node.imageSrc) {
        imagePaths.add(node.imageSrc);
      }
    }
  }

  console.log(`Found ${imagePaths.size} unique images`);

  // 2. Check which are already cached
  const existing = await db.cachedImage.findMany({ select: { path: true } });
  const existingPaths = new Set(existing.map(e => e.path));
  const toFetch = [...imagePaths].filter(p => !existingPaths.has(p));
  console.log(`Already cached: ${existingPaths.size}, need to fetch: ${toFetch.length}`);

  // 3. Download and cache each image
  let ok = 0, fail = 0;
  for (const imgPath of toFetch) {
    const url = imgPath.startsWith("http")
      ? imgPath
      : `https://www.ecfr.gov${imgPath}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "image/*,*/*",
        },
        redirect: "follow",
      });

      if (!res.ok) {
        console.log(`  ✗ ${imgPath}: HTTP ${res.status}`);
        fail++;
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/gif";

      // Skip if we got an HTML page (block page)
      if (contentType.includes("text/html")) {
        console.log(`  ✗ ${imgPath}: blocked (got HTML)`);
        fail++;
        continue;
      }

      await db.cachedImage.upsert({
        where: { path: imgPath },
        create: { path: imgPath, contentType, data: buffer },
        update: { contentType, data: buffer },
      });

      ok++;
      if (ok % 10 === 0) console.log(`  ... ${ok} cached`);
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.log(`  ✗ ${imgPath}: ${e}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} cached, ${fail} failed`);
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
