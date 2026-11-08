import { MongoClient, Db, Collection, ObjectId } from "mongodb";

export interface EventDoc {
  _id?: ObjectId;
  title: string;
  description: string;
  eventType: string;
  thumbnail: string;
  location: string;
  eventDate: Date;
  creatorEmail: string;
  creatorName: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface JoinDoc {
  _id?: ObjectId;
  eventId: ObjectId;
  eventTitle: string;
  eventThumbnail: string;
  eventLocation: string;
  eventType: string;
  eventDate: Date;
  userEmail: string;
  userName: string;
  joinedAt: Date;
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing. Add it to your .env file.");

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.DB_NAME || "shomaj");

  await db.collection("events").createIndex({ eventDate: 1 });
  await db.collection("events").createIndex({ creatorEmail: 1 });
  // A person can join a given event only once.
  await db.collection("joins").createIndex({ eventId: 1, userEmail: 1 }, { unique: true });
  await db.collection("joins").createIndex({ userEmail: 1 });

  console.log(`MongoDB connected -> database "${db.databaseName}"`);
  return db;
}

function getDb(): Db {
  if (!db) throw new Error("Database is not connected yet.");
  return db;
}

export const eventsCol = (): Collection<EventDoc> => getDb().collection<EventDoc>("events");
export const joinsCol = (): Collection<JoinDoc> => getDb().collection<JoinDoc>("joins");
