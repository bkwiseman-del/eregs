import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const sec = await db.cachedSection.findUnique({ where: { section: '393.11' } });
  if (!sec) { console.log('NOT FOUND'); return; }

  const xml = sec.rawXml;
  
  // Search for any table-like tags
  const tags = ['TABLE', 'table', 'GPOTABLE', 'BOXHD', 'ROW', 'ENT', 'CHED'];
  for (const tag of tags) {
    const count = (xml.match(new RegExp(`<${tag}`, 'gi')) || []).length;
    if (count > 0) console.log(`<${tag}>: ${count} occurrences`);
  }

  // Show a sample of what's around any table content
  const tableIdx = xml.search(/<table|<TABLE|<GPOTABLE/i);
  if (tableIdx >= 0) {
    console.log('\nTable context:', xml.slice(Math.max(0, tableIdx - 50), tableIdx + 400));
  } else {
    console.log('\nNo table tags found. Checking for other patterns...');
    // Maybe tables are in a different format
    const divIdx = xml.indexOf('<DIV');
    console.log('First 2000 chars of XML:');
    console.log(xml.slice(0, 2000));
  }

  // Also check a section known to have tables
  for (const s of ['391.41', '395.1', '393.5']) {
    const sec2 = await db.cachedSection.findUnique({ where: { section: s } });
    if (!sec2) continue;
    const xml2 = sec2.rawXml;
    const hasTbl = xml2.includes('<GPOTABLE') || xml2.includes('<table');
    const content2 = JSON.parse(sec2.contentJson);
    const tbls = content2.filter((n: any) => n.type === 'table');
    console.log(`\n${s}: XML has table=${hasTbl}, parsed tables=${tbls.length}, xml length=${xml2.length}`);
    if (hasTbl) {
      const idx = xml2.search(/<GPOTABLE|<table/i);
      console.log('  Sample:', xml2.slice(idx, idx + 300));
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());
