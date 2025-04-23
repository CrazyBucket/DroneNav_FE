import { ConfigProvider, theme } from "antd";
import "./index.css";
import Home from "./pages/Home";

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#11482a",
          colorBgContainer: "#1A2F1A",
          colorBorder: "#2D4A2D",
          colorText: "#E5FFE5",
          colorTextBase: "#E5FFE5",
        },
        components: {
          InputNumber: {
            colorBgContainer: "#1A2F1A",
            colorBorder: "#2D4A2D",
            hoverBorderColor: "#3CB371",
            activeBorderColor: "#4DD18D",
          },
        },
      }}
    >
      <div className="h-full">
        <div className="absolute inset-0 bg-[linear-gradient(-30deg,_#1a3a1a_20%,_#000_80%)] backdrop-blur-[2px] z-0" />
        <div className="relative z-10">
          <Home />
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
