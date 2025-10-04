import React from "react";

function Navbar() {
  return (
    <header className="bg-base-300 border-b border-base-content/10">
      <div className="mx-auto mx-w-6xl p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary font-mono tracking-tight">
            NotesBoard
          </h1>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
