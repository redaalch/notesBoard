import { Route, Routes } from "react-router-dom";

import HomePage from "./pages/HomePage.jsx";
import CreatePage from "./pages/CreatePage.jsx";
import NoteDetailPage from "./pages/NoteDetailPage.jsx";

const App = () => {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-base-200">
      <div className="pointer-events-none absolute inset-0 -z-10 h-full w-full bg-gradient-to-b from-base-300/20 via-base-200/40 to-base-200 sm:[background:radial-gradient(125%_125%_at_50%_10%,#000000_60%,#00FF9D40_100%)]" />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/note/:id" element={<NoteDetailPage />} />
      </Routes>
    </div>
  );
};
export default App;
