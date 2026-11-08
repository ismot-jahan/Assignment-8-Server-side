import { Router } from "express";
import { joinsCol } from "../db";
import { verifyJWT } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { parseId } from "../validate";

const router = Router();

// GET /api/joins/mine -> events joined by the logged-in user, sorted by event date
router.get("/mine", verifyJWT, asyncHandler(async (req, res) => {
  try {
    const list = await joinsCol()
      .aggregate([
        { $match: { userEmail: req.user!.email } },
        { $lookup: { from: "events", localField: "eventId", foreignField: "_id", as: "event" } },
        { $unwind: "$event" },
        { $replaceRoot: { newRoot: { $mergeObjects: ["$event", { joinedAt: "$joinedAt" }] } } },
        { $sort: { eventDate: 1 } },
      ])
      .toArray();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load your joined events." });
  }
}));

// DELETE /api/joins/:eventId -> leave an event
router.delete("/:eventId", verifyJWT, asyncHandler(async (req, res) => {
  const eventId = parseId(req.params.eventId);
  if (!eventId) return res.status(400).json({ message: "Invalid event id." });
  try {
    const result = await joinsCol().deleteOne({ eventId, userEmail: req.user!.email });
    if (!result.deletedCount) return res.status(404).json({ message: "You have not joined this event." });
    res.json({ message: "You left the event." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not leave the event." });
  }
}));

export default router;
