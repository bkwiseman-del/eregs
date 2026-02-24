import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const sec = await db.cachedSection.findUnique({ where: { section: '393.11' } });
  if (!sec) { console.log('NOT FOUND'); return; }

  const content = JSON.parse(sec.contentJson);
  const special = content.filter((n: any) => n.type !== 'paragraph');
  console.log('Special nodes:', special.length);
  special.forEach((n: any) => console.log(JSON.stringify(n).slice(0, 300)));

  const xml = sec.rawXml;
  console.log('\nXML has GPH:', xml.includes('<GPH'));
  console.log('XML has GPOTABLE:', xml.includes('<GPOTABLE'));
  console.log('XML has img:', xml.includes('<img'));
  console.log('XML length:', xml.length);

  const gphIdx = xml.indexOf('<GPH');
  if (gphIdx >= 0) console.log('\nGPH sample:', xml.slice(gphIdx, gphIdx + 200));

  const tblIdx = xml.indexOf('<GPOTABLE');
  if (tblIdx >= 0) console.log('\nTable sample:', xml.slice(tblIdx, tblIdx + 300));
}

main().catch(console.error).finally(() => db.$disconnect());
