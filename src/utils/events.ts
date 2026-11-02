import { Awaitable, Client, ClientEvents } from 'discord.js'

export type LogMethod = (...args: unknown[]) => void
export type EventKeys = keyof ClientEvents // only wants keys of ClientEvents object

// Event properties
export interface EventProps {
    client: Client,
    log: LogMethod
}

/**
 * Format for the callback function tied to an event
 * @param props the properties of the event
 * @param args the arguments of the event
 */
export type EventCallback<T extends EventKeys> = (
    props: EventProps,
    ...args: ClientEvents[T]
) => Awaitable<unknown> // Method can be synchronous or async, unknown so we can return anything

// Event interface
export interface Event<T extends EventKeys = EventKeys> {
    key: T
    callback: EventCallback<T>
}


/**
 * Method to create an event object
 * @param key type of event
 * @param callback function to run when event is triggered
 * @returns event object
 */
export function event<T extends EventKeys>(key: T, callback: EventCallback<T>): Event<T> {
    return { key, callback }
}

/**
 * Method to register events to the bot per file in the events directory
 * @param client initialized bot client
 * @param events all the exported events from the index.ts in the events dir
 */
export function registerEvents(
    client: Client,
    events: Event[]
): void {
    for (const { key, callback } of events) {
        client.on(key, (...args) => {
            const log = console.log.bind(console, `[Event: ${key}]`)
            
            try {
                callback({ client, log }, ...args)
            } catch (error) {
                log('[Error]', error)
            }
        })
    }
}