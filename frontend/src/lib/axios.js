import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.MODE === "development"
    ? "http://localhost:5001/api"
    : "/api");

export default axios.create({ baseURL: BASE_URL });
