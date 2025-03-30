import React from "react";
import "./index.css";

const Navbar = () => (
  <header className="nav-header h-[48px] backdrop-blur-md bg-white/10 border border-gray-600/50 text-white p-4 mx-2 mt-2 flex items-center rounded-xl transition-all duration-300 shadow-lg shadow-black/10 overflow-hidden hover:border-emerald-400/30 group">
    <span className="text-xl font-bold text-white/90 tracking-wider relative z-10">
      DroneNav
    </span>

    {/* 烟雾背景元素 */}
    <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
      {/* 基础烟雾层 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,30,15,0.4)_0%,_transparent_70%)] animate-smoke-1" />

      {/* 流动纹理层 */}
      <div className="absolute inset-0 bg-[linear-gradient(30deg,_transparent_45%,_rgba(0,255,200,0.05)_50%,_transparent_55%)] animate-smoke-2" />

      {/* 高光闪烁层 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,255,255,0.03)_10%,_transparent_30%)] animate-twinkle" />
    </div>
  </header>
);

export default Navbar;
