class GameManager {
    /**
     * @param {Object} config
     * @param {Skier} skier
     * @param {ObstacleCoordinator} obstacleCoordinator
     * @param {AssetManager} assetManager
     * @param {Object} saveManager
     */
    constructor(config, skier, obstacleCoordinator, assetManager, saveManager) {
        this.config = config;
        this.ctx = config.ctx;
        this.skier = skier;
        this.obstacleCoordinator = obstacleCoordinator;
        this.assetManager = assetManager;
        this.saveManager = saveManager;
        this.score = 0;
        this.lowestCoordinates = {x: 0, y: 0};
        this.isPaused = false;
        this.ripMe = false;
    }

    /**
     * Performs a check for collision and set skier's state accordingly
     */
    checkIfSkierHitObstacle() {
        if (this.obstacleCoordinator.isSkierColliding(this.skier)) {
            if (this.skier.state !== Skier.STATES.CRASH) {
                this.score -= 150;
            }

            this.skier.state = Skier.STATES.CRASH;
        }
    }

    /**
     * Draw skeeboi
     */
    drawSkier() {
        const skierAsset = this.skier.currentAsset;
        const skierImage = this.assetManager.loadedAssets[skierAsset];
        const x = (this.config.width - skierImage.width) / 2;
        const y = (this.config.height - skierImage.height) / 2;

        this.ctx.drawImage(skierImage, x, y, skierImage.width, skierImage.height);
    }

    /**
     * Draw the obstacles
     */
    drawObstacles() {
        const obstacles = this.obstacleCoordinator.spawnControl(this.skier.coordinates);
        obstacles.forEach(obstacle => {
            this.ctx.drawImage(obstacle.image, obstacle.x, obstacle.y, obstacle.image.width, obstacle.image.height);
        });
    }

    /**
     * Initialise skier control
     *
     * @param {Document} document
     */
    setUpKeyHandler(document) {
        const self = this;
        document.addEventListener('keydown', function handler(event) {
            event.preventDefault();

            switch (event.which) {
                case GameManager.CONTROLS.RESTART:
                    // Remove
                    document.removeEventListener('keydown', handler);
                    self.ripMe = true;
                    document.defaultView.skeeboi();
                    break;
                case GameManager.CONTROLS.PAUSE:
                    self.isPaused = !self.isPaused;
                    break;
            }

            if (!self.isPaused) {
                self.skier.control(event.which);
            }
        });
    }

    /**
     * Add some points as skier goes down the hill
     */
    addScore() {
        const coordinates = this.skier.coordinates;

        if (coordinates.y > this.lowestCoordinates.y) {
            this.score += coordinates.y - this.lowestCoordinates.y;
            this.lowestCoordinates = Object.assign({}, coordinates);
        }

        if (this.score > this.saveManager.getItem('highScore')) {
            this.saveManager.setItem('highScore', this.score);
        }
    }

    /**
     * Draws the high score onto the game screen
     */
    drawScore() {
        const score = this.saveManager.getItem('highScore') || 0;
        this.ctx.fillText('Highest Score: ' + score, 0, 10);
        this.ctx.fillText('Current Score: ' + this.score, 0, 20);
    }

    /**
     * Draws a grayscale overlay on top of the game in addition to the paused text
     */
    drawPauseOverlay() {
        const pausedText = 'PAUSED';
        const metrics = this.ctx.measureText(pausedText);
        this.ctx.fillText(pausedText, (this.config.width - metrics.width) / 2, this.config.height / 2);

        const imageData = this.ctx.getImageData(0, 0, this.config.width, this.config.height);

        const red = 0.34;
        const green = 0.5;
        const blue = 0.16;
        const redIntensity = 1;
        const greenIntensity = 1;
        const blueIntensity = 1;

        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const brightness = red * data[i] + green * data[i + 1] + blue * data[i + 2];

            data[i] = redIntensity * brightness;
            data[i + 1] = greenIntensity * brightness;
            data[i + 2] = blueIntensity * brightness;
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Main game loop
     *
     * @param {Window} window
     */
    loop(window) {
        if (this.ripMe) {
            // Breaking the loop so that this instance can be garbage collected
            return;
        }

        this.ctx.save();

        // Retina support
        this.ctx.scale(this.config.devicePixelRatio, this.config.devicePixelRatio);

        this.ctx.clearRect(0, 0, this.config.width, this.config.height);

        if (!this.isPaused) {
            this.skier.move();
            this.checkIfSkierHitObstacle();
            this.addScore();
        }

        this.drawSkier();

        this.drawObstacles();

        this.drawScore();

        if (this.isPaused) {
            this.drawPauseOverlay();
        }

        this.ctx.restore();

        window.requestAnimationFrame(this.loop.bind(this, window));
    }

    /**
     * Start the game
     *
     * @param {Window} window
     * @param {Document} document
     */
    async init(window, document) {
        this.setUpKeyHandler(document);

        this.skier.addListener('control', this.obstacleCoordinator.skierControlListener.bind(this.obstacleCoordinator));
        this.skier.addListener('move', this.obstacleCoordinator.skierMoveListener.bind(this.obstacleCoordinator));

        await this.assetManager.loadAssets();

        this.obstacleCoordinator.placeInitialObstacles();

        window.requestAnimationFrame(this.loop.bind(this, window));
    }
}
GameManager.CONTROLS = {
    RESTART: 113,
    PAUSE: 114
};

class AssetManager {
    constructor() {
        this.assets = {
            'skierCrash' : 'img/skier_crash.png',
            'skierLeft' : 'img/skier_left.png',
            'skierLeftDown' : 'img/skier_left_down.png',
            'skierDown' : 'img/skier_down.png',
            'skierRightDown' : 'img/skier_right_down.png',
            'skierRight' : 'img/skier_right.png',
            'tree' : 'img/tree_1.png',
            'treeCluster' : 'img/tree_cluster.png',
            'rock1' : 'img/rock_1.png',
            'rock2' : 'img/rock_2.png'
        };

        this.loadedAssets = {};
    }

    /**
     * Loads the game assets
     *
     * @return {Promise}
     */
    async loadAssets() {
        const promises = [];

        Object.entries(this.assets).forEach(asset => {
            const assetName = asset[0];
            const assetPath = asset[1];
            const image = new Image();
            const promise = new Promise(resolve => {
                image.onload = () => {
                    image.width /= 2;
                    image.height /= 2;

                    this.loadedAssets[assetName] = image;
                    resolve();
                };
            });

            image.src = assetPath;

            promises.push(promise);
        });

        return await Promise.all(promises);
    }
}

class ObstacleCoordinator {
    /**
     * @param {Object} config
     * @param {AssetManager} assetManager
     */
    constructor(config, assetManager) {
        this.config = config;
        this.assetManager = assetManager;
        this.obstacles = [];
        this.defaultOffset = 50;
        this.obstacleTypes = [
            'tree',
            'treeCluster',
            'rock1',
            'rock2'
        ];
    }

    /**
     * Place the initial obstacles at the start of the game
     */
    placeInitialObstacles() {
        // lmao all these numbers
        const widthRatio = this.config.width / 800;
        const heightRatio = this.config.height / 500;
        const numberObstacles = Math.ceil(Helper.random(5, 7) /*???*/ * widthRatio * heightRatio);

        const minX = -this.defaultOffset;
        const maxX = this.config.width + this.defaultOffset;
        const minY = this.config.height / 2 + 100;
        const maxY = this.config.height + this.defaultOffset;

        for (let i = 0; i < numberObstacles; i++) {
            this.placeRandomObstacle(minX, maxX, minY, maxY);
        }

        this.obstacles.sort((obstacleA, obstacleB) => {
            // There's probably a better way to do this (?)
            const imageA = this.assetManager.loadedAssets[obstacleA.type];
            const imageB = this.assetManager.loadedAssets[obstacleB.type];
            const yCoordA = obstacleA.y + imageA.height;
            const yCoordB = obstacleB.y + imageB.height;

            if (yCoordA < yCoordB) {
                return -1;
            }

            if (yCoordB < yCoordA) {
                return 1;
            }

            return 0;
        });
    }

    /**
     * Given a location, place a new obstacle
     *
     * @param {Number} location Any values defined in ObstacleCoordinator.LOCATIONS
     * @param {Object} skierCoordinates Current location of the skier
     */
    placeNewObstacle(location, skierCoordinates) {
        const shouldPlaceObstacle = Helper.random(1, 8);

        if (shouldPlaceObstacle !== 8) {
            return;
        }

        const leftEdge = skierCoordinates.x;
        const rightEdge = skierCoordinates.x + this.config.width;
        const topEdge = skierCoordinates.y;
        const bottomEdge = skierCoordinates.y + this.config.height;

        switch (location) {
            case ObstacleCoordinator.LOCATIONS.LEFT:
                this.placeRandomObstacle(leftEdge - this.defaultOffset, leftEdge, topEdge, bottomEdge);
                break;
            case ObstacleCoordinator.LOCATIONS.LEFT_DOWN:
                this.placeRandomObstacle(leftEdge - this.defaultOffset, leftEdge, topEdge, bottomEdge);
                this.placeRandomObstacle(leftEdge, rightEdge, bottomEdge, bottomEdge + this.defaultOffset);
                break;
            case ObstacleCoordinator.LOCATIONS.DOWN:
                this.placeRandomObstacle(leftEdge, rightEdge, bottomEdge, bottomEdge + this.defaultOffset);
                break;
            case ObstacleCoordinator.LOCATIONS.RIGHT_DOWN:
                this.placeRandomObstacle(rightEdge, rightEdge + this.defaultOffset, topEdge, bottomEdge);
                this.placeRandomObstacle(leftEdge, rightEdge, bottomEdge, bottomEdge + this.defaultOffset);
                break;
            case ObstacleCoordinator.LOCATIONS.RIGHT:
                this.placeRandomObstacle(rightEdge, rightEdge + this.defaultOffset, topEdge, bottomEdge);
                break;
            case ObstacleCoordinator.LOCATIONS.UP:
                this.placeRandomObstacle(leftEdge, rightEdge, topEdge - this.defaultOffset, topEdge);
                break;
        }
    }

    /**
     * Given a space to work with, randomly place an obstacle
     *
     * @param {Number} minX
     * @param {Number} maxX
     * @param {Number} minY
     * @param {Number} maxY
     */
    placeRandomObstacle(minX, maxX, minY, maxY) {
        const obstacleIndex = Helper.random(0, this.obstacleTypes.length - 1);

        const position = this.calculateOpenPosition(minX, maxX, minY, maxY);

        this.obstacles.push({
            type: this.obstacleTypes[obstacleIndex],
            x: position.x,
            y: position.y
        })
    }

    /**
     * Listens to the skier's control input
     *
     * @param {Number} controlKey See Skier.CONTROLS
     * @param {Skier} skier
     */
    skierControlListener(controlKey, skier) {
        if ([Skier.CONTROLS.LEFT, Skier.CONTROLS.RIGHT, Skier.CONTROLS.UP].includes(controlKey)) {
            if (skier.state === Skier.STATES.LEFT || skier.state === Skier.STATES.RIGHT) {
                let location;

                if (controlKey === Skier.CONTROLS.UP) {
                    location = ObstacleCoordinator.LOCATIONS.UP;
                } else {
                    location = Helper.skierStateToObstacleLocation(skier.state);
                }

                this.placeNewObstacle(location, Object.assign({}, skier.coordinates));
            }
        }
    }

    /**
     * Listens to the skier's movement
     *
     * @param {Number} state See Skier.STATES
     * @param {Skier} skier
     */
    skierMoveListener(state, skier) {
        if ([Skier.STATES.LEFT_DOWN, Skier.STATES.DOWN, Skier.STATES.RIGHT_DOWN].includes(state)) {
            this.placeNewObstacle(Helper.skierStateToObstacleLocation(state), Object.assign({}, skier.coordinates));
        }
    }

    /**
     * Returns a coordinate in an area for which an obstacle can be placed
     *
     * @param {Number} minX
     * @param {Number} maxX
     * @param {Number} minY
     * @param {Number} maxY
     */
    calculateOpenPosition(minX, maxX, minY, maxY) {
        let foundCollision = true;
        let x;
        let y;

        while (foundCollision) {
            x = Helper.random(minX, maxX);
            y = Helper.random(minY, maxY);

            foundCollision = this.obstacles.find(obstacle => {
                return x > (obstacle.x - this.defaultOffset) && x < (obstacle.x + this.defaultOffset) && y > (obstacle.y - this.defaultOffset) && y < (obstacle.y + this.defaultOffset);
            });
        }

        return {x, y};
    }

    /**
     * Check if the given skier collides with any of the obstacles
     *
     * @param {Skier} skier
     * @return {Boolean}
     */
    isSkierColliding(skier) {
        const skierAsset = skier.currentAsset;
        const skierImage = this.assetManager.loadedAssets[skierAsset];
        const skierRect = {
            left: skier.coordinates.x + this.config.width / 2,
            right: skier.coordinates.x + skierImage.width + this.config.width / 2,
            top: skier.coordinates.y + skierImage.height - 5 + this.config.height / 2,
            bottom: skier.coordinates.y + skierImage.height + this.config.height / 2
        };

        return Boolean(this.obstacles.find(obstacle => {
            const obstacleImage = this.assetManager.loadedAssets[obstacle.type];
            const obstacleRect = {
                left: obstacle.x,
                right: obstacle.x + obstacleImage.width,
                top: obstacle.y + obstacleImage.height - 5,
                bottom: obstacle.y + obstacleImage.height
            };

            return this.intersect(skierRect, obstacleRect);
        }));
    }

    /**
     * Returns true if the two rectangles intersect
     *
     * @param {Object} r1
     * @param {Object} r2
     * @return {Boolean}
     */
    intersect(r1, r2) {
        return !(r2.left > r1.right ||
            r2.right < r1.left ||
            r2.top > r1.bottom ||
            r2.bottom < r1.top);
    }

    /**
     * Determines which obstacles should stay and which should despawn based on the current skier coordinates.
     * Returns a list of obstacle images that stay spawned along with their coordinates.
     *
     * @param {Object} skierCoord
     * @return {Object[]}
     */
    spawnControl(skierCoord) {
        const newObstacles = [];
        const obstacleDrawings = [];

        this.obstacles.forEach(obstacle => {
            const image = this.assetManager.loadedAssets[obstacle.type];
            const x = obstacle.x - skierCoord.x - image.width / 2;
            const y = obstacle.y - skierCoord.y - image.height / 2;

            if (x < -this.defaultOffset * 2 ||
                x > this.config.width + this.defaultOffset ||
                y < -this.defaultOffset * 2 ||
                y > this.config.height + this.defaultOffset) {
                return;
            }

            newObstacles.push(obstacle);
            obstacleDrawings.push({image, x, y});
        });

        this.obstacles = newObstacles;

        return obstacleDrawings;
    }
}
ObstacleCoordinator.LOCATIONS = {
    LEFT: 1,
    LEFT_DOWN: 2,
    DOWN: 3,
    RIGHT_DOWN: 4,
    RIGHT: 5,
    UP: 6
};

class Skier {
    constructor() {
        this.state = Skier.STATES.RIGHT;
        this.coordinates = {x: 0, y: 0};
        this.speed = 8;
        this.vectorNormalizer = 1.1412;
        this.listeners = {
            move: [],
            control: []
        };
        this.assetNames = {
            [Skier.STATES.CRASH]: 'skierCrash',
            [Skier.STATES.LEFT]: 'skierLeft',
            [Skier.STATES.LEFT_DOWN]: 'skierLeftDown',
            [Skier.STATES.DOWN]: 'skierDown',
            [Skier.STATES.RIGHT_DOWN]: 'skierRightDown',
            [Skier.STATES.RIGHT]: 'skierRight'
        };
    }

    /**
     * Register a callback for an event
     *
     * @param {String} event Either "move" or "control"
     * @param {Function} callback
     */
    addListener(event, callback) {
        if (Object.keys(this.listeners).includes(event)) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Move the skier according to its current state
     */
    move() {
        switch (this.state) {
            case Skier.STATES.LEFT_DOWN:
                this.coordinates.x -= Math.round(this.speed / this.vectorNormalizer);
                this.coordinates.y += Math.round(this.speed / this.vectorNormalizer);
                break;
            case Skier.STATES.DOWN:
                this.coordinates.y += this.speed;
                break;
            case Skier.STATES.RIGHT_DOWN:
                this.coordinates.x += Math.round(this.speed / this.vectorNormalizer);
                this.coordinates.y += Math.round(this.speed / this.vectorNormalizer);
                break;
        }

        this.listeners.move.forEach(callback => {
            callback(this.state, this);
        });
    }

    /**
     * Controls the skier
     *
     * @param {Number} controlKey Any value defined in Skier.CONTROLS
     */
    control(controlKey) {
        switch (controlKey) {
            case Skier.CONTROLS.LEFT:
                if (this.state === Skier.STATES.CRASH) {
                    // Fixes invalid state when pressing left after a crash
                    this.state++;
                }

                if (this.state === Skier.STATES.LEFT) {
                    this.coordinates.x -= this.speed;
                } else {
                    this.state--;
                }

                break;
            case Skier.CONTROLS.RIGHT:
                if (this.state === Skier.STATES.CRASH) {
                    // Fixes not being able to move to the right after a crash
                    this.state = Skier.STATES.RIGHT;
                }

                if (this.state === Skier.STATES.RIGHT) {
                    this.coordinates.x += this.speed;
                } else {
                    this.state++;
                }

                break;
            case Skier.CONTROLS.UP:
                if (this.state === Skier.STATES.LEFT || this.state === Skier.STATES.RIGHT) {
                    this.coordinates.y -= this.speed;
                }

                break;
            case Skier.CONTROLS.DOWN:
                this.state = Skier.STATES.DOWN;
                break;
        }

        this.listeners.control.forEach(callback => {
            callback(controlKey, this);
        });
    }

    /**
     * Returns the current asset name according to its state
     *
     * @return {String}
     */
    get currentAsset() {
        return this.assetNames[this.state];
    }
}
Skier.CONTROLS = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40
};
Skier.STATES = {
    CRASH: 0,
    LEFT: 1,
    LEFT_DOWN: 2,
    DOWN: 3,
    RIGHT_DOWN: 4,
    RIGHT: 5,
};

class Helper {
    /**
     * Returns a random integer between min and max
     *
     * @param {Number} min
     * @param {Number} max
     * @return {Number}
     */
    static random(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Translate some of the skier's states to the obstacle locations.
     * Returns null for values that aren't directions or have no overlapping equivalents.
     *
     * @param {Number} skierState
     * @return {Number}
     */
    static skierStateToObstacleLocation(skierState) {
        switch (skierState) {
            case Skier.STATES.LEFT:
                return ObstacleCoordinator.LOCATIONS.LEFT;
            case Skier.STATES.LEFT_DOWN:
                return ObstacleCoordinator.LOCATIONS.LEFT_DOWN;
            case Skier.STATES.DOWN:
                return ObstacleCoordinator.LOCATIONS.DOWN;
            case Skier.STATES.RIGHT_DOWN:
                return ObstacleCoordinator.LOCATIONS.RIGHT_DOWN;
            case Skier.STATES.RIGHT:
                return ObstacleCoordinator.LOCATIONS.RIGHT;
            default:
                return null;
        }
    }
}

function skeeboi() {
    const gameWidth = window.innerWidth;
    const gameHeight = window.innerHeight;
    let canvas = document.querySelector('canvas');

    if (! canvas) {
        canvas = document.createElement('canvas');
        canvas.width = gameWidth * window.devicePixelRatio;
        canvas.height = gameHeight * window.devicePixelRatio;
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';
        document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');

    const assetManager = new AssetManager();
    const obstacleCoordinator = new ObstacleCoordinator({
        width: gameWidth,
        height: gameHeight
    }, assetManager);
    const skier = new Skier();
    const gameManager = new GameManager({
        ctx,
        devicePixelRatio: window.devicePixelRatio,
        width: gameWidth,
        height: gameHeight
    }, skier, obstacleCoordinator, assetManager, window.localStorage);
    gameManager.init(window, document);
}

document.addEventListener('DOMContentLoaded', skeeboi);
