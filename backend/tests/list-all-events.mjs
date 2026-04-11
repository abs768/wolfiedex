import { MongoClient } from "mongodb";
const MONGO_URI = "mongodb+srv://abhavanishankar2002_db_user:ig7yaiY3xTJJ6v4M@cluster0.g8popj2.mongodb.net/?appName=Cluster0";
const client = new MongoClient(MONGO_URI);
await client.connect();
const events = await client.db("campus_events").collection("events")
  .find({}, { projection: { _id: 0, title: 1, location: 1, organization: 1, date: 1, benefits: 1, categories: 1 } })
  .sort({ date: 1 }).toArray();
console.log(`\n📦 Total events in database: ${events.length}\n`);
events.forEach((e, i) => {
  const d = new Date(e.date).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  console.log(`${(i+1).toString().padStart(2)}. ${e.title}`);
  console.log(`    📅 ${d} | 📍 ${e.location} | 🏢 ${e.organization}`);
  console.log(`    🎁 ${(e.benefits||[]).join(", ") || "—"} | 🏷️  ${(e.categories||[]).join(", ") || "—"}`);
});
await client.close();
