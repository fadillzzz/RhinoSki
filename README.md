I've majorly refactored the codebase and basically broke it down into multiple components. I tried to separate and isolate all the different logics into their own component. I've also removed the previously loaded dependencies because I didn't feel like they were used enough to warrant the inclusion, with jQuery being the serious offender.

* AssetManager
This class is responsible for loading the assets. Since jQuery was removed, I resorted to using Promises coupled with async/await.

* ObstacleCoordinator
This class is responsible for managing the obstacles throughout the entire game. Because the logic for placing these obstacles are kinda related to the skier's movement, it's got two methods that are listening to events fired by the Skier class.

* Skier
A relatively simple class that updates the skier's position according to the button presses and skier's state. Fires an event whenever the skier moves from one position to another, and also when it's reacting to the player's input.

* GameManager
The main class that is responsible for the game's execution. It initialises pretty much everything to make the game start, and allows the player to pause or restart the game.

* I implemented a scoring system although unfortunately I didn't implement any jump tricks. So instead, the scoring system works based on how far the player has traveled down the mountain instead. Additionally crashing into an obstacle reduces the score by just a little bit. The highest score is saved into the localStorage so that it persists across refreshes.

* Game can be restarted by pressing the F2 key, and can be paused by pressing the F3 key.

You can check out the game at http://fad.no-ip.org:5000/