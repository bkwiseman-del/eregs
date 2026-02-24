import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  await db.$connect();
  console.log("DB connected");

  // 1. Find all image paths referenced in cached sections
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
  console.log(`Found ${imagePaths.size} unique image references`);

  // 2. Load from local extracted ZIP
  const graphicsDir = "/tmp/ecfr-graphics";
  let ok = 0, missing = 0;

  for (const imgPath of imagePaths) {
    // imgPath is like "/graphics/er15au05.005.gif"
    const filename = path.basename(imgPath);
    const localFile = path.join(graphicsDir, filename);

    if (!fs.existsSync(localFile)) {
      console.log(`  missing: ${filename}`);
      missing++;
      continue;
    }

    const data = fs.readFileSync(localFile);
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === ".gif" ? "image/gif"
      : ext === ".png" ? "image/png"
      : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : "image/gif";

    await db.cachedImage.upsert({
      where: { path: imgPath },
      create: { path: imgPath, contentType, data },
      update: { contentType, data },
    });
    ok++;
    if (ok % 10 === 0) console.log(`  ... ${ok} loaded`);
  }

  console.log(`\nDone: ${ok} loaded, ${missing} missing`);
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
