import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentTable } from "../../database/schema";

async function getDocument(id: string) {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.id, id))
    .limit(1);
  if (!doc) {
    throw new HTTPException(404, { message: "Document not found" });
  }
  return doc;
}

export default getDocument;
