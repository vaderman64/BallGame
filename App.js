import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar
} from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import Matter from 'matter-js';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Physics constants
const BALL_SIZE = 20;
const PADDLE_HEIGHT = 20;
const PADDLE_WIDTH = 100;
const WALL_THICKNESS = 30;
const MAX_BALLS = 7;
const PHYSICS_TIME_STEP = 1000 / 60; // 60 fps fixed time step

// Game renderer components
const Wall = (props) => {
  const width = props.size[0];
  const height = props.size[1];
  const x = props.body.position.x - width / 2;
  const y = props.body.position.y - height / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: width,
        height: height,
        backgroundColor: props.color
      }}
    />
  );
};

const BottomSensor = () => {
  // Invisible sensor - no visual representation
  return null;
};

const Paddle = (props) => {
  const width = props.size[0];
  const height = props.size[1];
  const x = props.body.position.x - width / 2;
  const y = props.body.position.y - height / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: width,
        height: height,
        borderRadius: 10,
        backgroundColor: props.color
      }}
    />
  );
};

const Ball = (props) => {
  const radius = props.size[0] / 2;
  const x = props.body.position.x - radius;
  const y = props.body.position.y - radius;

  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: radius * 2,
        height: radius * 2,
        borderRadius: radius,
        backgroundColor: props.color
      }}
    />
  );
};

const BonusTarget = (props) => {
  const width = props.size[0];
  const height = props.size[1];
  const x = props.body.position.x - width / 2;
  const y = props.body.position.y - height / 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: width,
        height: height,
        backgroundColor: props.color,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <Text style={{ fontWeight: 'bold', color: '#222' }}>+25</Text>
    </View>
  );
};

const Obstacle = (props) => {
  const width = props.size[0];
  const height = props.size[1];
  const x = props.body.position.x - width / 2;
  const y = props.body.position.y - height / 2;
  const angle = props.body.angle;

  return (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: width,
        height: height,
        backgroundColor: props.color,
        transform: [{ rotate: angle + 'rad' }]
      }}
    />
  );
};

const ScoreDisplay = (props) => {
  return (
    <View style={styles.scoreContainer}>
      <Text style={styles.scoreText}>Score: {props.score}</Text>
    </View>
  );
};

// Create physics engine
const createPhysicsWorld = () => {
  const engine = Matter.Engine.create({
    enableSleeping: false,
    timing: {
      timeScale: 1,
      timestep: 1000 / 60
    },
    positionIterations: 10,  // More iterations for better collision resolution
    velocityIterations: 10,  // More iterations for smoother physics
    constraintIterations: 4  // Help with handling constraints
  });

  const world = engine.world;

  world.gravity.y = 0.5;   // Moderate gravity
  world.gravity.x = 0;     // No horizontal gravity

  // Enable better collision handling
  engine.detector.slop = 0.01; // Smaller slop value for more accurate collisions

  return { engine, world };
};

// Helper function to get random position for bonus target
const getRandomBonusPosition = () => {
  // Calculate safe margins to keep bonus target visible
  const bonusSizeHalf = 30; // Half size of the bonus target
  const safeMarginX = WALL_THICKNESS + bonusSizeHalf + 10;
  const safeMarginY = WALL_THICKNESS + bonusSizeHalf + 10;
  
  // Random position within the playable area (top half of screen)
  return {
    x: Math.random() * (width - 2 * safeMarginX) + safeMarginX,
    y: Math.random() * (height / 2 - safeMarginY) + safeMarginY
  };
};

// Helper function to get random angle for obstacle
const getRandomObstacleAngle = () => {
  // Random angle between -45 to 45 degrees (calculated in radians)
  return (Math.random() * Math.PI / 2 - Math.PI / 4);
};

// Force correction for near-stationary objects
const applyForceCorrection = (bodies) => {
  bodies.forEach(body => {
    if (body.label === 'ball') {
      const yVel = body.velocity.y;
      const xVel = body.velocity.x;

      // If the ball is nearly stationary or moving very slowly upward
      if (Math.abs(yVel) < 0.1 || (yVel < 0 && yVel > -0.3)) {
        // Apply small downward force
        Matter.Body.applyForce(body, body.position, {
          x: 0,
          y: 0.0005  // Small downward force
        });
      }

      // If ball is moving extremely slowly horizontally, dampen it
      if (Math.abs(xVel) < 0.1) {
        Matter.Body.setVelocity(body, {
          x: 0,
          y: body.velocity.y
        });
      }
    }
  });
};

// Game entities
const createEntities = () => {
  const { engine, world } = createPhysicsWorld();

  // Create walls
  const leftWall = Matter.Bodies.rectangle(
    WALL_THICKNESS / 2,
    height / 2,
    WALL_THICKNESS,
    height,
    { isStatic: true, label: 'leftWall', restitution: 1.0 }
  );

  const rightWall = Matter.Bodies.rectangle(
    width - WALL_THICKNESS / 2,
    height / 2,
    WALL_THICKNESS,
    height,
    { isStatic: true, label: 'rightWall', restitution: 1.0 }
  );

  const topWall = Matter.Bodies.rectangle(
    width / 2,
    WALL_THICKNESS / 2,
    width,
    WALL_THICKNESS,
    { isStatic: true, label: 'topWall', restitution: 1.0 }
  );

  const bottomSensor = Matter.Bodies.rectangle(
    width / 2,
    height + WALL_THICKNESS / 2,
    width,
    WALL_THICKNESS,
    {
      isStatic: true,
      isSensor: true,
      label: 'bottomSensor'
    }
  );

  // Create paddle
  const paddle = Matter.Bodies.rectangle(
    width / 2,
    height - 100,
    PADDLE_WIDTH,
    PADDLE_HEIGHT,
    {
      isStatic: true,
      label: 'paddle',
      chamfer: { radius: 10 },
      restitution: 1.0,
      friction: 0.05
    }
  );

  const defaultCategory = 0x0001;
  const ballCategory = 0x0002;
  const obstacleCategory = 0x0004;

  // Create initial ball
  const ball = Matter.Bodies.circle(
    width / 2,
    height / 3,
    BALL_SIZE,
    {
      restitution: 0.7,
      friction: 0.01,
      frictionAir: 0.0008,
      density: 0.015,
      label: 'ball',
      id: 1,
      slop: 0.01,
      collisionFilter: {
        category: ballCategory,
        mask: defaultCategory | obstacleCategory
      }
    }
  );

  // Apply initial velocity to the ball
  Matter.Body.setVelocity(ball, {
    x: 0,  // Start with purely vertical motion for predictability
    y: 3   // Consistent downward velocity
  });

  // Get random position for bonus target
  const bonusPosition = getRandomBonusPosition();
  
  // Create bonus target at random position
  const bonusTarget = Matter.Bodies.rectangle(
    bonusPosition.x,
    bonusPosition.y,
    60,
    60,
    {
      isStatic: true,
      isSensor: true,
      label: 'bonusTarget'
    }
  );

  // Get random angle for obstacle
  const obstacleAngle = getRandomObstacleAngle();
  
  // Create obstacle with random rotation
  const obstacle = Matter.Bodies.rectangle(
    width / 2,
    height / 2,
    150,
    20,
    {
      isStatic: true,
      angle: obstacleAngle,
      label: 'obstacle',
      restitution: 0.7,
      friction: 0.05,
      slop: 0.01,
      chamfer: { radius: 4 },
      collisionFilter: {
        category: obstacleCategory,
        mask: ballCategory
      }
    }
  );

  // Add all bodies to the world
  Matter.Composite.add(world, [
    leftWall,
    rightWall,
    topWall,
    bottomSensor,
    paddle,
    ball,
    bonusTarget,
    obstacle
  ]);

  // Create a collision detection event
  Matter.Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
      const { bodyA, bodyB } = pairs[i];

      // Ball hit obstacle case
      if ((bodyA.label === 'obstacle' && bodyB.label === 'ball') ||
        (bodyA.label === 'ball' && bodyB.label === 'obstacle')) {
        const ball = bodyA.label === 'ball' ? bodyA : bodyB;
        const obstacle = bodyA.label === 'obstacle' ? bodyA : bodyB;

        // Get the current velocity
        const vel = ball.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

        // Determine if ball is above or below obstacle
        const isAboveObstacle = ball.position.y < obstacle.position.y;

        // If ball is above and moving slowly upward, ensure it starts falling
        if (isAboveObstacle && vel.y > -1 && vel.y < 0.5) {
          Matter.Body.setVelocity(ball, {
            x: vel.x * 0.8,  // slow horizontal movement
            y: 0.5           // Small downward velocity
          });
        }

        // If ball is below obstacle and got trapped, give it a push down
        if (!isAboveObstacle && Math.abs(vel.y) < 0.5) {
          Matter.Body.setVelocity(ball, {
            x: vel.x * 0.8,
            y: 1.5  // Push downward more strongly
          });
        }

        // If the ball is moving too fast after obstacle collision, cap its velocity
        if (speed > 10) {
          const scaleFactor = 10 / speed;
          Matter.Body.setVelocity(ball, {
            x: vel.x * scaleFactor,
            y: vel.y * scaleFactor
          });
        }
      }

      // Ball hit bottom sensor = game over
      if ((bodyA.label === 'bottomSensor' && bodyB.label === 'ball') ||
        (bodyA.label === 'ball' && bodyB.label === 'bottomSensor')) {
        if (engine.gameStatus) {
          engine.gameStatus.over = true;
        }
      }

      // Ball hit bonus target = score points
      if ((bodyA.label === 'bonusTarget' && bodyB.label === 'ball') ||
        (bodyA.label === 'ball' && bodyB.label === 'bonusTarget')) {
        if (engine.gameStatus) {
          engine.gameStatus.score += 25;
          // Move bonus target to a new random location
          const newBonusPosition = getRandomBonusPosition();
          Matter.Body.setPosition(
            bodyA.label === 'bonusTarget' ? bodyA : bodyB,
            newBonusPosition
          );
        }
      }

      // Ball hit paddle = score points and add velocity
      if ((bodyA.label === 'paddle' && bodyB.label === 'ball') ||
        (bodyA.label === 'ball' && bodyB.label === 'paddle')) {
        const ball = bodyA.label === 'ball' ? bodyA : bodyB;
        const paddle = bodyA.label === 'paddle' ? bodyA : bodyB;

        if (engine.gameStatus) {
          engine.gameStatus.score += 10;

          // Calculate impact point relative to paddle center
          const impactPoint = ball.position.x - paddle.position.x;
          const paddleHalfWidth = PADDLE_WIDTH / 2;

          // Convert to a value between -1 and 1
          const relativeImpact = impactPoint / paddleHalfWidth;

          // Apply velocity based on where the ball hit the paddle
          Matter.Body.setVelocity(ball, {
            // Horizontal deflection based on impact point
            x: relativeImpact * 5,
            // Consistent vertical velocity with slight boost
            y: ball.velocity.y * -1.05
          });

          // 10% chance to spawn a new ball when hitting paddle
          // if (Math.random() < 0.1 && engine.gameStatus.ballCount < MAX_BALLS) {
          //   // New ball code would go here if we had time ;(
          // }
        }
      }
    }
  });

  engine.gameStatus = {
    score: 0,
    over: false,
    ballCount: 1
  };

  return {
    physics: { engine, world },
    leftWall: { body: leftWall, size: [WALL_THICKNESS, height], color: '#86C232', renderer: Wall },
    rightWall: { body: rightWall, size: [WALL_THICKNESS, height], color: '#86C232', renderer: Wall },
    topWall: { body: topWall, size: [width, WALL_THICKNESS], color: '#86C232', renderer: Wall },
    bottomSensor: { body: bottomSensor, size: [width, WALL_THICKNESS], renderer: BottomSensor },
    paddle: { body: paddle, size: [PADDLE_WIDTH, PADDLE_HEIGHT], color: '#61DBFB', renderer: Paddle },
    ball: { body: ball, size: [BALL_SIZE * 2], color: '#FF6B6B', renderer: Ball },
    bonusTarget: { body: bonusTarget, size: [60, 60], color: '#FFD166', renderer: BonusTarget },
    obstacle: { body: obstacle, size: [150, 20], color: '#F25F5C', renderer: Obstacle },
    scoreDisplay: { score: 0, renderer: ScoreDisplay }
  };
};

// Game update system
const Physics = (entities, { time }) => {
  const { engine, world } = entities.physics;

  applyForceCorrection(Matter.Composite.allBodies(world));
  
 
  const delta = Math.min(time.delta, 32);
  Matter.Engine.update(engine, delta);

  // Check balls for problematic velocities
  const bodies = Matter.Composite.allBodies(world);
  bodies.forEach(body => {
    if (body.label === 'ball') {
      const velocity = body.velocity;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      // Cap maximum speed
      if (speed > 15) {
        const scaleFactor = 15 / speed;
        Matter.Body.setVelocity(body, {
          x: velocity.x * scaleFactor,
          y: velocity.y * scaleFactor
        });
      }

      // Only boost balls that are nearly stopped
      if (speed < 0.2) {
        // Add a tiny downward boost to ensure gravity takes effect
        Matter.Body.setVelocity(body, {
          x: 0,
          y: 0.5
        });
      }

      // Remove slight upward movement when ball should be falling
      if (Math.abs(velocity.x) < 0.5 && velocity.y > -0.5 && velocity.y < 0.2) {
        Matter.Body.setVelocity(body, {
          x: velocity.x,
          y: 0.5
        });
      }
    }
  });

  // Update score display
  entities.scoreDisplay.score = engine.gameStatus.score;

  return entities;
};

// Welcome screen component
const WelcomeScreen = ({ onStart }) => {
  return (
    <View style={styles.welcomeContainer}>
      <Text style={styles.welcomeTitle}>Ball Bounce</Text>
      <Text style={styles.welcomeSubtitle}>A Matter.js Physics Game</Text>
      <Text style={styles.welcomeCreator}>Created by: AJ, Anjal and Chafik</Text>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>How to Play:</Text>
        <Text style={styles.instructionsText}>• Slide your finger to move the paddle</Text>
        <Text style={styles.instructionsText}>• Keep the balls from falling</Text>
        <Text style={styles.instructionsText}>• Hit the yellow bonus target for extra points</Text>
        <Text style={styles.instructionsText}>• Hitting the paddle with a ball scores 10 points</Text>
        <Text style={styles.instructionsText}>• Hitting the bonus target scores 25 points</Text>
        <Text style={styles.instructionsText}>• Adjust difficulty with the buttons at the bottom</Text>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={onStart}>
        <Text style={styles.startButtonText}>Start Game</Text>
      </TouchableOpacity>
    </View>
  );
};

// Main game component
const Game = () => {
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [entities, setEntities] = useState(null);
  const [difficulty, setDifficulty] = useState(0.5); // Default difficulty

  const gameEngineRef = useRef(null);
  const paddleRef = useRef(null);

  // Initialize the game world
  useEffect(() => {
    if (!showWelcome && !entities) {
      const gameEntities = createEntities();

      // Set initial difficulty
      if (gameEntities.physics && gameEntities.physics.world) {
        gameEntities.physics.world.gravity.y = difficulty;
      }

      setEntities(gameEntities);
      setRunning(true);
      setGameOver(false);
      setScore(0);
    }
  }, [showWelcome, entities, difficulty]);

  // Game event handling
  const onEvent = (e) => {
    if (e.type === 'game-over') {
      setRunning(false);
      setGameOver(true);
      if (entities && entities.physics && entities.physics.engine) {
        setScore(entities.physics.engine.gameStatus.score);
      }
    }
  };

  // Update function for game loop
  const updateHandler = (entities, { touches, dispatch, time }) => {
    if (!entities || !entities.physics || !entities.physics.engine) {
      return entities;
    }

    const { engine } = entities.physics;

    // Check for game over
    if (engine.gameStatus && engine.gameStatus.over) {
      dispatch({ type: 'game-over' });
    }

    // Update paddle position from touches
    touches.filter(t => t.type === 'move').forEach(t => {
      if (paddleRef.current && !gameOver && entities.paddle && entities.paddle.body) {
        const paddleBody = entities.paddle.body;
        const newX = Math.max(
          PADDLE_WIDTH / 2 + WALL_THICKNESS,
          Math.min(t.event.pageX, width - PADDLE_WIDTH / 2 - WALL_THICKNESS)
        );

        Matter.Body.setPosition(paddleBody, {
          x: newX,
          y: paddleBody.position.y
        });
      }
    });

    return Physics(entities, { time });
  };

  // Handle paddle movement with pan gesture
  const onPanGestureEvent = ({ nativeEvent }) => {
    if (gameEngineRef.current && !gameOver && entities &&
      entities.paddle && entities.paddle.body) {
      const paddleBody = entities.paddle.body;
      const newX = Math.max(
        PADDLE_WIDTH / 2 + WALL_THICKNESS,
        Math.min(nativeEvent.absoluteX, width - PADDLE_WIDTH / 2 - WALL_THICKNESS)
      );

      Matter.Body.setPosition(paddleBody, {
        x: newX,
        y: paddleBody.position.y
      });
    }
  };

  // Change difficulty
  const changeDifficulty = (change) => {
    if (entities && entities.physics && entities.physics.world) {
      const newGravity = Math.max(0.2, Math.min(1.0, entities.physics.world.gravity.y + change));
      entities.physics.world.gravity.y = newGravity;
      setDifficulty(newGravity);
    }
  };

  // Restart game
  const restartGame = () => {
    const newEntities = createEntities();

    // Set difficulty based on current setting
    if (newEntities.physics && newEntities.physics.world) {
      newEntities.physics.world.gravity.y = difficulty;
    }

    setEntities(newEntities);
    setRunning(true);
    setGameOver(false);
    setScore(0);

    if (gameEngineRef.current) {
      gameEngineRef.current.swap(newEntities);
    }
  };

  // Start game from welcome screen
  const startGame = () => {
    setShowWelcome(false);
  };

  // If on welcome screen, show welcome component
  if (showWelcome) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <WelcomeScreen onStart={startGame} />
      </GestureHandlerRootView>
    );
  }

  // If entities aren't ready yet, show loading
  if (!entities) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: 'white', fontSize: 18 }}>Loading game...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar hidden />

        <GameEngine
          ref={gameEngineRef}
          style={styles.gameContainer}
          systems={[updateHandler]}
          entities={entities}
          running={running}
          onEvent={onEvent}
        />

        <PanGestureHandler
          onGestureEvent={onPanGestureEvent}
          enabled={running && !gameOver}
        >
          <View style={styles.controlArea} ref={paddleRef} />
        </PanGestureHandler>

        {gameOver && (
          <View style={styles.gameOverContainer}>
            <Text style={styles.gameOverText}>Game Over</Text>
            <Text style={styles.finalScoreText}>Final Score: {score}</Text>
            <TouchableOpacity style={styles.button} onPress={restartGame}>
              <Text style={styles.buttonText}>Restart</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Difficulty adjustment controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.smallButton]}
            onPress={() => changeDifficulty(-0.1)}
          >
            <Text style={styles.buttonText}>Slower</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.smallButton]}
            onPress={() => changeDifficulty(0.1)}
          >
            <Text style={styles.buttonText}>Faster</Text>
          </TouchableOpacity>
        </View>

        {/* Display current difficulty level */}
        <View style={styles.difficultyContainer}>
          <Text style={styles.difficultyText}>
            Difficulty: {Math.round(difficulty * 10)}
          </Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222629',
  },
  gameContainer: {
    flex: 1,
  },
  controlArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  scoreContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
  },
  scoreText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  difficultyContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
  },
  difficultyText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  gameOverContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverText: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  finalScoreText: {
    color: 'white',
    fontSize: 24,
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#61DBFB',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  smallButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 5,
    marginVertical: 40,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#222629',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#61DBFB',
    marginBottom: 10,
  },
  welcomeSubtitle: {
    fontSize: 24,
    color: 'white',
    marginBottom: 5,
  },
  welcomeCreator: {
    fontSize: 16,
    color: '#86C232',
    marginBottom: 40,
  },
  instructionsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
    borderRadius: 10,
    marginBottom: 40,
    width: '100%',
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 8,
  },
  startButton: {
    backgroundColor: '#86C232',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
  },
  startButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
});

export default Game;