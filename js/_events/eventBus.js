// js/_events/eventBus.js

const events = new Map();

/**
 * A simple publish-subscribe event bus to decouple application components.
 */
export const eventBus = {
    /**
     * Subscribes to an event.
     * @param {string} event The name of the event to subscribe to.
     * @param {Function} listener The callback function to execute.
     */
    on(event, listener) {
        if (!events.has(event)) {
            events.set(event, []);
        }
        events.get(event).push(listener);
    },

    /**
     * Emits an event, calling all subscribed listeners.
     * @param {string} event The name of the event to emit.
     * @param {*} [data] Optional data to pass to the listeners.
     */
    emit(event, data) {
        if (events.has(event)) {
            // Use a copy in case a listener modifies the array
            [...events.get(event)].forEach(listener => listener(data));
        }
    },
};
