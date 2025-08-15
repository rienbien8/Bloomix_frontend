import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SpotsList from "./pages/SpotsList";
import HomeMap from "./pages/HomeMap";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/spots" element={<SpotsList />} />
        <Route path="/map" element={<HomeMap />} />
      </Routes>
    </Router>
  );
}

export default App;
