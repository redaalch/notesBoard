import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

import notesRoutes from "./routes/notesRoutes.js";
import { connectDb } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

dotenv.config();

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

app.use(rateLimiter);

// app.use((req,res,next)=> {
//     console.log("new request"+req.method);
//     next();

// })

app.use("/api/notes", notesRoutes);

app.use(express.static(path.join(__dirname,"../frontend/dist")));

app.get("*",(req,res)=> {
  res.sendFile(path.join(__dirname,"../frontend","dist","index.html"))
})

connectDb().then(() => {
  app.listen(5001, () => {
    console.log("server started on port :", PORT);
  });
});
