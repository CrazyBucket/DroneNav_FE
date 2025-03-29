import "./index.css";
import Home from "./pages/Home";

function App() {
  return (
    <div className="h-full">
      <div className="absolute inset-0 bg-[linear-gradient(-30deg,_#1a3a1a_20%,_#000_80%)] backdrop-blur-[2px] z-0" />
      <div className="relative z-10">
        <Home />
      </div>
    </div>
  );
}

export default App;
