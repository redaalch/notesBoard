import Note from "../models/Note.js";

export const getAllNotes = async (_, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    console.log("Error in getAllNotes", error);

    res.status(500).json({ message: "Internal server error" });
  }
};

export async function getNodeById(req, res) {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.status(200).json(note);
  } catch (error) {
    console.log("Error in getNodeById", error);

    res.status(500).json({ message: "Internal server error" });
  }
}

export const createNote = async (req, res) => {
  try {
    const { title, content } = req.body;
    const note = new Note.create({ title, content });
    const savedNote = await note.save();
    res.status(201).json(savedNote);
  } catch (error) {
    console.log("Error in createNote", error);

    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateNote = async (req, res) => {
  try {
    const { title, content } = req.body;
    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      { title, content },
      {
        new: true,
      }
    );
    if (!updatedNote)
      return res.status(404).json({ message: "note not found" });

    res.status(200).json(updatedNote);
  } catch (error) {
    console.error("Error in updateNote", error);

    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteNote = async (req, res) => {
  try {
    const deletedNote = await Note.findByIdAndDelete(req.params.id);
    if (!deleteNote) return res.status(404).json({ message: "note not found" });

    res.status(200).json({ message: "deleted" });
  } catch (error) {
    console.error("Error in deleteNote", error);

    res.status(500).json({ message: "Internal server error" });
  }
};
