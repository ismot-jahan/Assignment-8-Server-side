import { ObjectId } from "mongodb";

export const EVENT_TYPES = [
  "Cleanup",
  "Plantation",
  "Donation",
  "Food Distribution",
  "Health Camp",
  "Blood Donation",
  "Education",
  "Other",
];

export interface EventInput {
  title: string;
  description: string;
  eventType: string;
  thumbnail: string;
  location: string;
  eventDate: Date;
}

export function parseId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}

export function validateEvent(body: Record<string, unknown>): { errors: Record<string, string>; value?: EventInput } {
  const errors: Record<string, string> = {};
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

  const title = str("title");
  const description = str("description");
  const eventType = str("eventType");
  const thumbnail = str("thumbnail");
  const location = str("location");
  const date = new Date(str("eventDate"));

  if (title.length < 5) errors.title = "Title must be at least 5 characters.";
  if (description.length < 20) errors.description = "Description must be at least 20 characters.";
  if (!EVENT_TYPES.includes(eventType)) errors.eventType = "Choose a valid event type.";
  if (!/^https?:\/\/.+/i.test(thumbnail)) errors.thumbnail = "Thumbnail must be a valid image URL.";
  if (location.length < 3) errors.location = "Location must be at least 3 characters.";
  if (isNaN(date.getTime())) errors.eventDate = "Enter a valid event date.";
  else if (date.getTime() <= Date.now()) errors.eventDate = "Event date must be in the future.";

  if (Object.keys(errors).length) return { errors };
  return { errors, value: { title, description, eventType, thumbnail, location, eventDate: date } };
}
