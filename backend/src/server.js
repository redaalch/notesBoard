import express from "express";
import notesRoutes from "./routes/notesRoutes.js";
import { connectDb } from "./config/db.js";
import dotenv from "dotenv";
import rateLimiter from "./middleware/rateLimiter.js";
import cors from "cors";

dotenv.config();

const PORT = process.env.PORT || 5001;
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
connectDb().then(() => {
  app.listen(5001, () => {
    console.log("server started on port :", PORT);
  });
});
