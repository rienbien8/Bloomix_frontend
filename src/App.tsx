import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SpotsList from "./pages/SpotsList";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/spots" element={<SpotsList />} />
      </Routes>
    </Router>
  );
}

export default App;
