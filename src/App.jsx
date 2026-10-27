import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

function NavigateToBlank() {
    window.location.href = "about:blank";
    return null;
}

export default function App() {
  return (
    <Routes>
      {/* Link gốc "/" sẽ bị đá ra about:blank */}
      <Route path="/" element={<NavigateToBlank />} />
      
      {/* Link "/live" sẽ hiện trang chủ */}
      <Route path="/live" element={<Home />} />
    </Routes>
  );
}