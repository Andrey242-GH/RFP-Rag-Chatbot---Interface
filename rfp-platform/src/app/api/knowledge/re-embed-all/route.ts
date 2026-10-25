/**
 * POST /api/knowledge/re-embed-all
 *
 * Iterates all knowledge records without embeddings and re-indexes them.
 * Runs synchronously for demo; in production use SQS/Step Functions.
 */
import { type NextRequest } from "next/server";
import { listKnowledge, updateKnowledgeEmbeddingId } from "@/lib/dal/knowledge";
import { generateEmbedding } from "@/lib/bedrock";
import { indexDocument, ensureIndexExists } from "@/lib/opensearch";

export async function POST(_request: NextRequest) {
  try {
    await ensureIndexExists();

    const { items } = await listKnowledge({ pageSize: 500 });
    const pending = items.filter((k) => !k.embeddingId);

    let indexed = 0;
    let failed = 0;

    for (const record of pending) {
      try {
        const embeddingText = `${record.question}\n\n${record.answer}`;
        const embedding = await generateEmbedding(embeddingText);

        await indexDocument({
          id: record.id,
          question: record.question,
          answer: record.answer,
          industry: record.industry,
          customer: record.customer,
          region: record.region,
          domain: record.domain,
          proposalStatus: record.proposalStatus,
          qualityLevel: record.qualityLevel,
          isStrategicCustomer: record.isStrategicCustomer ?? false,
          embedding,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });

        await updateKnowledgeEmbeddingId(record.id, record.id);
        indexed++;
      } catch (err) {
        console.error(`Failed to embed record ${record.id}:`, err);
        failed++;
      }
    }

    return Response.json({
      success: true,
      data: {
        total: pending.length,
        indexed,
        failed,
        alreadyIndexed: items.length - pending.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Re-embed failed";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
