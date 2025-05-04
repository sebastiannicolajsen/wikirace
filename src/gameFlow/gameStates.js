// Define valid game states
const GameStates = {
    LOBBY: "lobby",
    RUNNING: "running",
    WAITING: "waiting",
    PAUSED: "paused",
    HANDOUT: "handout",
    FINISHED: "finished",
};

// Define valid state transitions
const StateTransitions = {
    [GameStates.LOBBY]: [GameStates.RUNNING],
    [GameStates.RUNNING]: [GameStates.WAITING, GameStates.FINISHED],
    [GameStates.WAITING]: [GameStates.PAUSED, GameStates.FINISHED, GameStates.HANDOUT, GameStates.RUNNING],
    [GameStates.PAUSED]: [GameStates.HANDOUT, GameStates.RUNNING],
    [GameStates.HANDOUT]: [GameStates.RUNNING],
    [GameStates.FINISHED]: [GameStates.LOBBY], // No transitions from finished state
};

// Validate state transition
function isValidStateTransition(currentState, newState) {
    return StateTransitions[currentState]?.includes(newState) || false;
}

module.exports = {
    GameStates,
    StateTransitions,
    isValidStateTransition
}; 