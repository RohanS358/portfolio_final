"use client";
import { useRef, useState, useEffect } from 'react';
import Matter from 'matter-js';
import { Outfit } from "next/font/google";

const outfit = Outfit({
  variable: "--font-sans",
});

interface FallingTextProps {
  text?: string;
  highlightWords?: string[];
  trigger?: 'auto' | 'scroll' | 'click' | 'hover' | boolean | 0 | 1;
  backgroundColor?: string;
  wireframes?: boolean;
  gravity?: number;
  mouseConstraintStiffness?: number;
  launchPower?: number;
  fontSize?: string;
}

const FallingText: React.FC<FallingTextProps> = ({
  text = '',
  highlightWords = [],
  trigger = 'auto',
  backgroundColor = 'transparent',
  wireframes = false,
  gravity = 1,
  mouseConstraintStiffness = 0.2,
  launchPower = 1,
  fontSize = '1rem'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const predictionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [effectStarted, setEffectStarted] = useState(false);

  useEffect(() => {
    if (!textRef.current) return;
    const words = text.split(' ');

    const newHTML = words
      .map(word => {
        const isHighlighted = highlightWords.some(hw => word.startsWith(hw));
        return `<span
          class="inline-block mx-[2px] ${outfit.variable}  select-none ${isHighlighted ? 'font-normal' : ''}"
        >
          ${word}
        </span>`;
      })
      .join(' ');

    textRef.current.innerHTML = newHTML;
  }, [text, highlightWords]);

  useEffect(() => {
    if (trigger === true || trigger === 1) {
      setEffectStarted(true);
      return;
    }

    if (trigger === false || trigger === 0) {
      setEffectStarted(false);
      return;
    }

    if (trigger === 'auto') {
      setEffectStarted(true);
      return;
    }

    if (trigger === 'scroll' && containerRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setEffectStarted(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [trigger]);

  useEffect(() => {
    if (!effectStarted) return;

    const { Engine, Render, World, Bodies, Runner, Query, Body } = Matter;

    if (!containerRef.current || !canvasContainerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    if (width <= 0 || height <= 0) return;

    const engine = Engine.create();
    engine.world.gravity.y = gravity;

    const safeLaunchPower = Math.max(0, launchPower);
    const launchStrength = Math.max(0.015, 0.03 + mouseConstraintStiffness * 0.1) * safeLaunchPower;
    const maxLaunchSpeed = Math.max(4, 18 * safeLaunchPower);

    const render = Render.create({
      element: canvasContainerRef.current,
      engine,
      options: {
        width,
        height,
        background: backgroundColor,
        wireframes
      }
    });

    const boundaryOptions = {
      isStatic: true,
      render: { fillStyle: 'transparent' }
    };
    const floor = Bodies.rectangle(width / 2, height, width, 50, boundaryOptions);
    const leftWall = Bodies.rectangle(-25, height / 2, 50, height, boundaryOptions);
    const rightWall = Bodies.rectangle(width + 25, height / 2, 50, height, boundaryOptions);
    const ceiling = Bodies.rectangle(width / 2, -25, width, 50, boundaryOptions);

    const predictionEngine = Engine.create();
    predictionEngine.world.gravity.x = engine.world.gravity.x;
    predictionEngine.world.gravity.y = engine.world.gravity.y;
    predictionEngine.world.gravity.scale = engine.world.gravity.scale;

    const predictionBoundaryOptions = {
      isStatic: true,
      render: { visible: false }
    };
    const predictionFloor = Bodies.rectangle(width / 2, height, width, 50, predictionBoundaryOptions);
    const predictionLeftWall = Bodies.rectangle(-25, height / 2, 50, height, predictionBoundaryOptions);
    const predictionRightWall = Bodies.rectangle(width + 25, height / 2, 50, height, predictionBoundaryOptions);
    const predictionCeiling = Bodies.rectangle(width / 2, -25, width, 50, predictionBoundaryOptions);
    World.add(predictionEngine.world, [predictionFloor, predictionLeftWall, predictionRightWall, predictionCeiling]);

    if (!textRef.current) return;
    const wordSpans = textRef.current.querySelectorAll('span');
    const wordBodies = [...wordSpans].map(elem => {
      const rect = elem.getBoundingClientRect();

      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      const body = Bodies.rectangle(x, y, rect.width, rect.height, {
        render: { fillStyle: 'transparent' },
        restitution: 0.8,
        frictionAir: 0.01,
        friction: 0.2
      });
      Matter.Body.setVelocity(body, {
        x: 0,
        y: 0
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);

      return { elem, body };
    });

    const predictionCanvas = predictionCanvasRef.current;
    if (predictionCanvas) {
      predictionCanvas.width = width;
      predictionCanvas.height = height;
    }
    const predictionCtx = predictionCanvas?.getContext('2d') ?? null;

    type Vec2 = { x: number; y: number };
    const draggingBodyRef: { current: any | null } = { current: null };
    const mousePosRef = { current: { x: 0, y: 0 } };

    const getLaunchVelocity = (bodyPosition: Vec2, cursorPosition: Vec2) => {
      const rawVelocity = {
        x: (bodyPosition.x - cursorPosition.x) * launchStrength,
        y: (bodyPosition.y - cursorPosition.y) * launchStrength
      };

      const speed = Math.hypot(rawVelocity.x, rawVelocity.y);
      if (speed <= maxLaunchSpeed) return rawVelocity;

      const scale = maxLaunchSpeed / speed;
      return {
        x: rawVelocity.x * scale,
        y: rawVelocity.y * scale
      };
    };

    const clearPrediction = () => {
      if (!predictionCtx) return;
      predictionCtx.clearRect(0, 0, width, height);
    };

    const drawPrediction = () => {
      if (!predictionCtx) return;
      clearPrediction();

      const draggingBody = draggingBodyRef.current;
      if (!draggingBody) return;

      const launchVelocity = getLaunchVelocity(draggingBody.position, mousePosRef.current);
      const bodyWidth = draggingBody.bounds.max.x - draggingBody.bounds.min.x;
      const bodyHeight = draggingBody.bounds.max.y - draggingBody.bounds.min.y;

      const predictionBody = Bodies.rectangle(
        draggingBody.position.x,
        draggingBody.position.y,
        bodyWidth,
        bodyHeight,
        {
          restitution: draggingBody.restitution,
          frictionAir: draggingBody.frictionAir,
          friction: draggingBody.friction,
          density: draggingBody.density,
          render: { visible: false }
        }
      );

      Body.setAngle(predictionBody, draggingBody.angle);
      Body.setAngularVelocity(predictionBody, draggingBody.angularVelocity);
      Body.setVelocity(predictionBody, launchVelocity);
      World.add(predictionEngine.world, predictionBody);

      predictionCtx.beginPath();
      predictionCtx.moveTo(predictionBody.position.x, predictionBody.position.y);

      for (let i = 0; i < 70; i += 1) {
        Engine.update(predictionEngine, 1000 / 60);
        predictionCtx.lineTo(predictionBody.position.x, predictionBody.position.y);

        if (predictionBody.position.y > height + bodyHeight) {
          break;
        }
      }

      World.remove(predictionEngine.world, predictionBody);

      predictionCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      predictionCtx.lineWidth = 2;
      predictionCtx.setLineDash([6, 6]);
      predictionCtx.stroke();
      predictionCtx.setLineDash([]);

      predictionCtx.beginPath();
      predictionCtx.moveTo(draggingBody.position.x, draggingBody.position.y);
      predictionCtx.lineTo(mousePosRef.current.x, mousePosRef.current.y);
      predictionCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      predictionCtx.lineWidth = 1.5;
      predictionCtx.stroke();
    };

    wordBodies.forEach(({ elem, body }) => {
      elem.style.position = 'absolute';
      elem.style.left = `${body.position.x - body.bounds.max.x + body.bounds.min.x / 2}px`;
      elem.style.top = `${body.position.y - body.bounds.max.y + body.bounds.min.y / 2}px`;
      elem.style.transform = 'none';
    });

    const getLocalPoint = (event: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    };

    const handlePointerDown = (event: MouseEvent) => {
      const point = getLocalPoint(event);
      const bodies = wordBodies.map(wb => wb.body);
      const targetBody = Query.point(bodies, point)[0] ?? null;
      if (!targetBody) return;

      draggingBodyRef.current = targetBody;
      mousePosRef.current = point;
      Body.setStatic(targetBody, true);
      drawPrediction();
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (!draggingBodyRef.current) return;
      mousePosRef.current = getLocalPoint(event);
      drawPrediction();
    };

    const handlePointerUp = () => {
      const draggingBody = draggingBodyRef.current;
      if (!draggingBody) return;

      const launchVelocity = getLaunchVelocity(draggingBody.position, mousePosRef.current);
      Body.setStatic(draggingBody, false);
      Body.setVelocity(draggingBody, launchVelocity);
      Body.setAngularVelocity(draggingBody, (Math.random() - 0.5) * 0.08);
      draggingBodyRef.current = null;
      clearPrediction();
    };

    containerRef.current.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    World.add(engine.world, [floor, leftWall, rightWall, ceiling, ...wordBodies.map(wb => wb.body)]);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    let animationFrameId = 0;
    const updateLoop = () => {
      wordBodies.forEach(({ body, elem }) => {
        const { x, y } = body.position;
        elem.style.left = `${x}px`;
        elem.style.top = `${y}px`;
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      });

      if (draggingBodyRef.current) {
        drawPrediction();
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };
    updateLoop();

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      containerRef.current?.removeEventListener('mousedown', handlePointerDown);
      cancelAnimationFrame(animationFrameId);
      clearPrediction();
      World.clear(predictionEngine.world, false);
      Engine.clear(predictionEngine);

      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas && canvasContainerRef.current) {
        canvasContainerRef.current.removeChild(render.canvas);
      }
      World.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [effectStarted, gravity, wireframes, backgroundColor, mouseConstraintStiffness, launchPower]);

  const handleTrigger = () => {
    if (!effectStarted && (trigger === 'click' || trigger === 'hover')) {
      setEffectStarted(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative z-[1] w-full h-full cursor-pointer text-center pt-8 overflow-hidden"
      onClick={trigger === 'click' ? handleTrigger : undefined}
      onMouseEnter={trigger === 'hover' ? handleTrigger : undefined}
    >
      <div
        ref={textRef}
        className="inline-block"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize,
          fontWeight: 100,
          lineHeight: 1.4
        }}
      />

      <div className="absolute top-0 left-0 z-0" ref={canvasContainerRef} />
      <canvas className="absolute top-0 left-0 w-full h-full z-[2] pointer-events-none" ref={predictionCanvasRef} />
    </div>
  );
};

export default FallingText;
