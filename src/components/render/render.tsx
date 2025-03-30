import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { SceneManager } from "@/core/SceneManager";

export type RenderHandle = {
  resize: (width: number, height: number) => void;
};

const Render = forwardRef<RenderHandle>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);

  // 暴露 resize 方法给父组件
  useImperativeHandle(ref, () => ({
    resize: (width: number, height: number) => {
      sceneManagerRef.current?.resize(width, height);
    },
  }));

  // 初始化场景
  useEffect(() => {
    if (!containerRef.current) return;

    const manager = SceneManager.getInstance(containerRef.current);
    sceneManagerRef.current = manager;

    // 添加测试立方体
    const cubeGeometry = new THREE.BoxGeometry(10, 10, 10);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0x004400,
      emissiveIntensity: 0.5,
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.castShadow = true;
    cube.receiveShadow = true;

    manager.addObject({
      id: "test-cube",
      object: cube,
      selectable: true,
    });

    return () => {
      manager.removeObject("test-cube");
      sceneManagerRef.current = null;
    };
  }, []);

  return (
    <div
      id="scene-container"
      ref={containerRef}
      className="rounded-xl overflow-hidden h-full w-full"
    />
  );
});

Render.displayName = "Render";

export default Render;
