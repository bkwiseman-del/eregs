import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Setting up search database extensions and indexes...\n");

  // ── Full-Text Search (built-in PostgreSQL, always available) ───────────────

  // 1. Add tsvector column to SearchDocument
  await db.$executeRawUnsafe(`
    ALTER TABLE "SearchDocument"
    ADD COLUMN IF NOT EXISTS "searchVector" tsvector;
  `);
  console.log("  ✓ searchVector column added to SearchDocument");

  // 2. Create GIN index on tsvector column
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "SearchDocument_searchVector_idx"
    ON "SearchDocument" USING GIN ("searchVector");
  `);
  console.log("  ✓ GIN index created on SearchDocument.searchVector");

  // 3. Create trigger to auto-update tsvector on INSERT/UPDATE
  //    Weights: title=A (highest), section=B, plainText=C
  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION search_document_trigger() RETURNS trigger AS $$
    BEGIN
      NEW."searchVector" :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.section, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW."plainText", '')), 'C');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS "search_document_tsvector_update" ON "SearchDocument";
  `);
  await db.$executeRawUnsafe(`
    CREATE TRIGGER "search_document_tsvector_update"
    BEFORE INSERT OR UPDATE ON "SearchDocument"
    FOR EACH ROW EXECUTE FUNCTION search_document_trigger();
  `);
  console.log("  ✓ Trigger created for auto-updating searchVector");

  // ── pgvector for AI Embeddings (optional — may not be available on all hosts) ─

  let hasVector = false;
  try {
    await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    hasVector = true;
    console.log("  ✓ pgvector extension enabled");
  } catch {
    console.log("  ⚠ pgvector not available on this host — AI embeddings will use text storage fallback");
  }

  if (hasVector) {
    await db.$executeRawUnsafe(`
      ALTER TABLE "Embedding"
      ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
    `);
    console.log("  ✓ embedding vector(1536) column added to Embedding");

    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Embedding_embedding_idx"
      ON "Embedding" USING hnsw ("embedding" vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);
    console.log("  ✓ HNSW index created on Embedding.embedding");
  } else {
    // Fallback: store embeddings as a text column (JSON array of floats)
    // Cosine similarity will be computed in application code
    await db.$executeRawUnsafe(`
      ALTER TABLE "Embedding"
      ADD COLUMN IF NOT EXISTS "embeddingJson" text;
    `);
    console.log("  ✓ embeddingJson text column added to Embedding (fallback mode)");
  }

  console.log("\nDone! Database is ready for search" + (hasVector ? " + AI." : " (AI in fallback mode)."));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
