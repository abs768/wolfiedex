// ═══════════════════════════════════════════════════════════════════════════════
// MongoDB Atlas Connection Utility
// ═══════════════════════════════════════════════════════════════════════════════

import { MongoClient, Db } from "mongodb";
import tls from "tls";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB ?? "campus_events";

if (!MONGODB_URI) {
  throw new Error(
    "MONGODB_URI environment variable is not set. " +
    "Get your connection string from https://cloud.mongodb.com"
  );
}

/** Module-level cache — survives across warm serverless invocations */
let cached: { client: MongoClient; db: Db } | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cached) return cached;

  // Node 25 ships OpenSSL 3.6 which has TLS handshake issues with MongoDB Atlas.
  // Create a custom secureContext that forces TLS 1.2 compatibility.
  const secureContext = tls.createSecureContext({
    secureProtocol: "TLSv1_2_method",
  });

  const client = await MongoClient.connect(MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    // @ts-expect-error — pass custom secure context for Node 25 compat
    secureContext,
  });

  const db = client.db(DB_NAME);
  cached = { client, db };
  return cached;
}
