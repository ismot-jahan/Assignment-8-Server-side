import { Router } from "express";
import { Filter } from "mongodb";
import { EventDoc, eventsCol, joinsCol } from "../db";
import { verifyJWT } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { EVENT_TYPES, parseId, validateEvent } from "../validate";

const router = Router();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/events  -> upcoming events only (public). ?limit=6&type=Cleanup&search=dhaka
router.get("/", asyncHandler(async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "")) || 0, 100);
    const type = String(req.query.type ?? "");
    const search = String(req.query.search ?? "").trim();

    const filter: Filter<EventDoc> = { eventDate: { $gt: new Date() } };
    if (type && EVENT_TYPES.includes(type)) filter.eventType = type;
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ title: rx }, { location: rx }];
    }

    let cursor = eventsCol().find(filter).sort({ eventDate: 1 });
    if (limit) cursor = cursor.limit(limit);
    res.json(await cursor.toArray());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load events." });
  }
}));

// GET /api/events/mine -> events created by the logged-in user
router.get("/mine", verifyJWT, asyncHandler(async (req, res) => {
  try {
    const list = await eventsCol().find({ creatorEmail: req.user!.email }).sort({ eventDate: 1 }).toArray();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load your events." });
  }
}));

// GET /api/events/:id -> event details (public) with participant count
router.get("/:id", asyncHandler(async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) return res.status(400).json({ message: "Invalid event id." });
  try {
    const event = await eventsCol().findOne({ _id });
    if (!event) return res.status(404).json({ message: "Event not found." });
    const participantsCount = await joinsCol().countDocuments({ eventId: _id });
    res.json({ ...event, participantsCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load the event." });
  }
}));

// POST /api/events -> create (private)
router.post("/", verifyJWT, asyncHandler(async (req, res) => {
  const { errors, value } = validateEvent(req.body ?? {});
  if (!value) return res.status(400).json({ message: Object.values(errors)[0], errors });
  try {
    const doc: EventDoc = {
      ...value,
      creatorEmail: req.user!.email,
      creatorName: req.user!.name,
      createdAt: new Date(),
    };
    const result = await eventsCol().insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not create the event." });
  }
}));

// PUT /api/events/:id -> update (private, owner only)
router.put("/:id", verifyJWT, asyncHandler(async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) return res.status(400).json({ message: "Invalid event id." });
  const { errors, value } = validateEvent(req.body ?? {});
  if (!value) return res.status(400).json({ message: Object.values(errors)[0], errors });
  try {
    const existing = await eventsCol().findOne({ _id });
    if (!existing) return res.status(404).json({ message: "Event not found." });
    if (existing.creatorEmail !== req.user!.email) {
      return res.status(403).json({ message: "You can only update events you created." });
    }
    await eventsCol().updateOne({ _id }, { $set: { ...value, updatedAt: new Date() } });
    res.json({ message: "Event updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not update the event." });
  }
}));

// DELETE /api/events/:id -> delete (private, owner only)
router.delete("/:id", verifyJWT, asyncHandler(async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) return res.status(400).json({ message: "Invalid event id." });
  try {
    const existing = await eventsCol().findOne({ _id });
    if (!existing) return res.status(404).json({ message: "Event not found." });
    if (existing.creatorEmail !== req.user!.email) {
      return res.status(403).json({ message: "You can only delete events you created." });
    }
    await eventsCol().deleteOne({ _id });
    await joinsCol().deleteMany({ eventId: _id });
    res.json({ message: "Event deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not delete the event." });
  }
}));

// GET /api/events/:id/joined -> has the logged-in user joined this event?
router.get("/:id/joined", verifyJWT, asyncHandler(async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) return res.status(400).json({ message: "Invalid event id." });
  try {
    const found = await joinsCol().findOne({ eventId: _id, userEmail: req.user!.email });
    res.json({ joined: !!found });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not check your sign-up status." });
  }
}));

// POST /api/events/:id/join -> join an event (private)
router.post("/:id/join", verifyJWT, asyncHandler(async (req, res) => {
  const _id = parseId(req.params.id);
  if (!_id) return res.status(400).json({ message: "Invalid event id." });
  try {
    const event = await eventsCol().findOne({ _id });
    if (!event) return res.status(404).json({ message: "Event not found." });
    if (event.eventDate.getTime() <= Date.now()) {
      return res.status(400).json({ message: "This event has already taken place." });
    }
    await joinsCol().insertOne({
      eventId: _id,
      eventTitle: event.title,
      eventThumbnail: event.thumbnail,
      eventLocation: event.location,
      eventType: event.eventType,
      eventDate: event.eventDate,
      userEmail: req.user!.email,
      userName: req.user!.name,
      joinedAt: new Date(),
    });
    res.status(201).json({ message: "You have joined this event." });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return res.status(409).json({ message: "You have already joined this event." });
    }
    console.error(err);
    res.status(500).json({ message: "Could not join the event." });
  }
}));

export default router;
