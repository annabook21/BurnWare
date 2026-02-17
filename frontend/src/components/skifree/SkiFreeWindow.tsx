/**
 * SkiFree Game Window
 * Integrates SkiFreeButItsNoem into the BurnWare dashboard as a WindowFrame.
 * Keyboard events are scoped to the game container to avoid conflicts.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { WindowFrame } from '../aim-ui/WindowFrame';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SKIER_MAX_SPEED } from './game/constants.js';
import { createGameState, updateGame, getSpeedLabel } from './game/engine.js';
import { render } from './game/renderer.js';
import {
  initAudio, startSwoosh, updateSwoosh, stopSwoosh,
  playCrash, playJump, playBoost, playSnowmanAppear, playGameOver,
} from './game/sounds.js';

/* ── Styled ─────────────────────────────────────────── */

const GameBody = styled.div`
  padding: 0 !important;
  margin: 0 !important;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const CanvasContainer = styled.div`
  position: relative;
  width: ${CANVAS_WIDTH}px;
  height: ${CANVAS_HEIGHT}px;
  overflow: hidden;
  outline: none;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  z-index: 10;
`;

const DialogBox = styled.div`
  width: 300px;
`;

const StatusBar = styled.div`
  display: flex;
  & > p {
    font-size: 12px;
    flex: 1;
    text-align: center;
  }
`;

/* ── Game State Type ─────────────────────────────────── */

interface SkiGameState {
  status: string;
  skier: {
    x: number; y: number; speed: number; direction: number;
    crashed: boolean; crashTime: number;
    jumping: boolean; jumpStart: number;
    boosting: boolean; boostStart: number; boostCooldownEnd: number;
  };
  camera: { y: number };
  obstacles: any[];
  snowman: { x: number; y: number } | null;
  distance: number;
  score: number;
  frame: number;
  snowParticles: any[];
  keys: Record<string, boolean>;
  lastObstacleY: number;
}

/* ── Game Info ───────────────────────────────────────── */

interface GameInfo {
  status: string;
  distance: number;
  score: number;
  speed: string;
  snowmanActive: boolean;
}

/* ── GameCanvas ──────────────────────────────────────── */

interface GameCanvasProps {
  onStatusChange: (info: GameInfo) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onStatusChange, containerRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SkiGameState | null>(null);
  const rafRef = useRef<number>(0);
  const soundFlags = useRef({ snowmanOnScreen: false, wasPlaying: false });

  const startGame = useCallback(() => {
    initAudio();
    startSwoosh();
    soundFlags.current = { snowmanOnScreen: false, wasPlaying: true };
    stateRef.current = createGameState();
    stateRef.current.status = 'playing';
    onStatusChange({ status: 'playing', distance: 0, score: 0, speed: 'Medium', snowmanActive: false });
  }, [onStatusChange]);

  const restartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  // Expose for overlay buttons
  useEffect(() => {
    (window as any).__skifreeStart = startGame;
    (window as any).__skifreeRestart = restartGame;
    return () => {
      delete (window as any).__skifreeStart;
      delete (window as any).__skifreeRestart;
    };
  }, [startGame, restartGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    stateRef.current = createGameState();
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const el = containerRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      const state = stateRef.current;
      if (!state) return;
      if (state.status === 'start' && (e.key === ' ' || e.key === 'Enter')) { startGame(); return; }
      if (state.status === 'over' && (e.key === ' ' || e.key === 'Enter')) { restartGame(); return; }
      if (state.status === 'playing') state.keys[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (state) state.keys[e.key] = false;
    };

    // Scope key listeners to the container div, not window
    el?.addEventListener('keydown', handleKeyDown);
    el?.addEventListener('keyup', handleKeyUp);

    let prevCrashed = false;
    let prevJumping = false;
    let prevBoosting = false;

    function gameLoop() {
      const state = stateRef.current;
      if (!state) return;
      const now = performance.now();

      if (state.status === 'playing') {
        updateGame(state, now);
        const sk = state.skier;
        updateSwoosh(sk.speed, SKIER_MAX_SPEED);
        if (sk.crashed && !prevCrashed) playCrash();
        prevCrashed = sk.crashed;
        if (sk.jumping && !prevJumping) playJump();
        prevJumping = sk.jumping;
        if (sk.boosting && !prevBoosting) playBoost();
        prevBoosting = sk.boosting;

        if (state.snowman) {
          const smScreenY = state.snowman.y - state.camera.y;
          const smOnScreen = smScreenY > -30 && smScreenY < CANVAS_HEIGHT + 30;
          if (smOnScreen && !soundFlags.current.snowmanOnScreen) playSnowmanAppear();
          soundFlags.current.snowmanOnScreen = smOnScreen;
        }

        onStatusChange({
          status: state.status,
          distance: Math.floor(state.distance),
          score: Math.floor(state.distance) + state.score,
          speed: getSpeedLabel(state.skier.speed, state.skier.boosting),
          snowmanActive: !!state.snowman,
        });
      }

      if (state.status === 'over' && soundFlags.current.wasPlaying) {
        soundFlags.current.wasPlaying = false;
        stopSwoosh();
        playGameOver();
      }

      render(ctx, state, now);
      rafRef.current = requestAnimationFrame(gameLoop);
    }

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => {
      el?.removeEventListener('keydown', handleKeyDown);
      el?.removeEventListener('keyup', handleKeyUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopSwoosh();
    };
  }, [onStatusChange, startGame, restartGame, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{ display: 'block', imageRendering: 'pixelated' }}
    />
  );
};

/* ── StartScreen ─────────────────────────────────────── */

const StartScreen: React.FC = () => (
  <Overlay>
    <DialogBox className="window">
      <div className="title-bar">
        <div className="title-bar-text">Welcome to SkiFreeButItsNoem!</div>
      </div>
      <div className="window-body" style={{ padding: 12 }}>
        <p style={{ textAlign: 'center', margin: '8px 0', fontSize: 32 }}>🐕</p>
        <p style={{ margin: '8px 0' }}>Help your dog ski down the mountain!</p>
        <ul style={{ margin: '8px 0', padding: '4px 8px', listStyle: 'none' }}>
          <li style={{ margin: '4px 0', fontSize: 12 }}><b>←→</b> Steer left/right</li>
          <li style={{ margin: '4px 0', fontSize: 12 }}><b>↓</b> Speed up</li>
          <li style={{ margin: '4px 0', fontSize: 12 }}><b>↑</b> Slow down</li>
          <li style={{ margin: '4px 0', fontSize: 12 }}>Hit ramps to jump for bonus points</li>
          <li style={{ margin: '4px 0', fontSize: 12 }}>Watch out for Kristi Noem!</li>
        </ul>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button onClick={() => (window as any).__skifreeStart?.()} style={{ padding: '4px 24px' }}>
            Start Game
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 8 }}>
          Press Space or Enter to start
        </p>
      </div>
    </DialogBox>
  </Overlay>
);

/* ── GameOver ────────────────────────────────────────── */

const GameOverScreen: React.FC<{ score: number; bestScore: number }> = ({ score, bestScore }) => {
  const isNewBest = score >= bestScore;
  return (
    <Overlay>
      <DialogBox className="window">
        <div className="title-bar">
          <div className="title-bar-text">Game Over</div>
        </div>
        <div className="window-body" style={{ padding: 12 }}>
          <p style={{ textAlign: 'center', margin: '8px 0', fontSize: 32 }}>☠️</p>
          <p style={{ textAlign: 'center', fontWeight: 'bold', margin: '4px 0' }}>
            Kristi Noem caught your dog!
          </p>
          <fieldset style={{ margin: '8px 0' }}>
            <legend>Results</legend>
            <p>Score: <b>{score}</b>{isNewBest && ' — New Best!'}</p>
            <p>Best: <b>{bestScore}</b></p>
          </fieldset>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={() => (window as any).__skifreeRestart?.()} style={{ padding: '4px 24px' }}>
              Play Again
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 8 }}>
            Press Space or Enter to restart
          </p>
        </div>
      </DialogBox>
    </Overlay>
  );
};

/* ── SkiFreeWindow ───────────────────────────────────── */

interface SkiFreeWindowProps {
  onClose: () => void;
  initialX?: number;
  initialY?: number;
  zIndex?: number;
  onFocus?: () => void;
}

export const SkiFreeWindow: React.FC<SkiFreeWindowProps> = ({
  onClose,
  initialX = 80,
  initialY = 20,
  zIndex = 500,
  onFocus,
}) => {
  const [gameInfo, setGameInfo] = useState<GameInfo>({
    status: 'start', distance: 0, score: 0, speed: 'Medium', snowmanActive: false,
  });
  const bestScoreRef = useRef(0);
  const [bestScore, setBestScore] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStatusChange = useCallback((info: GameInfo) => {
    setGameInfo(prev => {
      if (info.status === 'over' && prev.status !== 'over') {
        if (info.score > bestScoreRef.current) {
          bestScoreRef.current = info.score;
          setBestScore(info.score);
        }
      }
      if (prev.status === info.status && prev.distance === info.distance && prev.score === info.score) return prev;
      return info;
    });
  }, []);

  // Auto-focus the container so keyboard works immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <WindowFrame
      title="SkiFreeButItsNoem"
      icon="🐕"
      width={CANVAS_WIDTH + 10}
      height={CANVAS_HEIGHT + 88}
      initialX={initialX}
      initialY={initialY}
      onClose={onClose}
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <GameBody>
        <CanvasContainer ref={containerRef} tabIndex={0}>
          <GameCanvas onStatusChange={handleStatusChange} containerRef={containerRef} />
          {gameInfo.status === 'start' && <StartScreen />}
          {gameInfo.status === 'over' && <GameOverScreen score={gameInfo.score} bestScore={bestScore} />}
        </CanvasContainer>
        <StatusBar className="status-bar">
          <p className="status-bar-field">Distance: {gameInfo.distance}m</p>
          <p className="status-bar-field">Score: {gameInfo.score}</p>
          <p className="status-bar-field">Speed: {gameInfo.speed}</p>
          <p className="status-bar-field">{gameInfo.snowmanActive ? '🏔️ ⚠️' : '🐕'}</p>
        </StatusBar>
      </GameBody>
    </WindowFrame>
  );
};
